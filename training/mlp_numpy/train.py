"""Train the NumPy MLP on MNIST and export it for the site.

    python training/mlp_numpy/train.py

Writes:
  training/mlp_numpy/log.csv            one row per epoch: the source of every number shown
  public/models/mlp/weights.bin         int8 weights + float32 biases (layout in meta.json)
  public/models/mlp/samples.bin         real MNIST test digits the hero cycles through
  public/models/mlp/meta.json           architecture, results, quantisation scales, provenance
"""

import csv
import json
import platform
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from mnist import load  # noqa: E402

from model import MLP  # noqa: E402

SITE = HERE.parent.parent
OUT = SITE / "public" / "models" / "mlp"

CONFIG = {
    "sizes": [784, 128, 64, 10],
    "epochs": 20,
    "batch_size": 128,
    "lr": 0.05,
    "momentum": 0.9,
    "weight_decay": 5e-5,
    "max_shift": 2,
    "seed": 0,
}


def shift_batch(x, rng, max_shift):
    """Random translation by up to max_shift pixels, zero filled. Hand-drawn digits are never centred exactly."""
    out = np.zeros_like(x)
    n = len(x)
    dx = rng.integers(-max_shift, max_shift + 1, n)
    dy = rng.integers(-max_shift, max_shift + 1, n)
    for i in range(n):
        sx, sy = dx[i], dy[i]
        src = x[i, max(0, -sy) : 28 - max(0, sy), max(0, -sx) : 28 - max(0, sx)]
        out[i, max(0, sy) : max(0, sy) + src.shape[0], max(0, sx) : max(0, sx) + src.shape[1]] = src
    return out


def evaluate(net, x, y, batch=2000):
    loss, correct = 0.0, 0
    for i in range(0, len(x), batch):
        logits, _ = net.forward(x[i : i + batch])
        l, _ = MLP.loss(logits, y[i : i + batch])
        loss += l * len(logits)
        correct += (logits.argmax(1) == y[i : i + batch]).sum()
    return loss / len(x), correct / len(x)


def quantise(W):
    """Symmetric int8 per output row: w ~= q * scale[row]."""
    scale = np.abs(W).max(axis=1) / 127
    scale[scale == 0] = 1
    q = np.clip(np.round(W / scale[:, None]), -127, 127).astype(np.int8)
    return q, scale.astype(np.float32)


def cpu_name():
    if platform.system() == "Windows":
        try:
            out = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor).Name"], text=True
            )
            return out.strip()
        except Exception:
            pass
    return platform.processor() or platform.machine()


def git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=SITE, text=True).strip()
    except Exception:
        return "unknown"


def main():
    c = CONFIG
    rng = np.random.default_rng(c["seed"])
    x_train, y_train, x_test, y_test = load()
    xt = x_test.reshape(-1, 784).astype(np.float32) / 255

    net = MLP(tuple(c["sizes"]), seed=c["seed"])
    velocity = [np.zeros_like(p) for p in net.params()]
    steps_per_epoch = int(np.ceil(len(x_train) / c["batch_size"]))
    total = c["epochs"] * steps_per_epoch
    step = 0
    rows = []
    t0 = time.time()

    for epoch in range(1, c["epochs"] + 1):
        order = rng.permutation(len(x_train))
        run_loss, run_correct, seen = 0.0, 0, 0
        for i in range(0, len(order), c["batch_size"]):
            idx = order[i : i + c["batch_size"]]
            xb = shift_batch(x_train[idx], rng, c["max_shift"]).reshape(-1, 784).astype(np.float32) / 255
            yb = y_train[idx]
            # Cosine decay from lr to 0 over the whole run.
            lr = 0.5 * c["lr"] * (1 + np.cos(np.pi * step / total))
            logits, cache = net.forward(xb)
            loss, dlogits = MLP.loss(logits, yb)
            grads = net.backward(dlogits, cache)
            for p, g, v in zip(net.params(), grads, velocity):
                g = g + c["weight_decay"] * p if p.ndim == 2 else g
                v *= c["momentum"]
                v -= lr * g
                p += v
            run_loss += loss * len(yb)
            run_correct += (logits.argmax(1) == yb).sum()
            seen += len(yb)
            step += 1

        test_loss, test_acc = evaluate(net, xt, y_test)
        row = {
            "epoch": epoch,
            "train_loss": round(run_loss / seen, 5),
            "train_acc": round(run_correct / seen, 5),
            "test_loss": round(float(test_loss), 5),
            "test_acc": round(float(test_acc), 5),
            "lr_end": float(f"{lr:.6g}"),
            "seconds": round(time.time() - t0, 1),
        }
        rows.append(row)
        print(row, flush=True)

    with open(HERE / "log.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    # Export: int8 weights then float32 biases, layer by layer, little endian.
    OUT.mkdir(parents=True, exist_ok=True)
    blob = bytearray()
    layers = []
    qnet = MLP(tuple(c["sizes"]))
    for li, (W, b) in enumerate(zip(net.W, net.b)):
        q, scale = quantise(W)
        layers.append({"in": int(W.shape[1]), "out": int(W.shape[0]), "w_offset": len(blob), "scale": [float(s) for s in scale]})
        blob += q.tobytes()
        layers[-1]["b_offset"] = len(blob)
        blob += b.astype("<f4").tobytes()
        qnet.W[li] = q.astype(np.float32) * scale[:, None]
        qnet.b[li] = b.copy()
    (OUT / "weights.bin").write_bytes(bytes(blob))
    _, int8_acc = evaluate(qnet, xt, y_test)

    # The first three test images of each class, as they come in the file. No picking.
    picked = [int(i) for d in range(10) for i in np.flatnonzero(y_test == d)[:3]]
    (OUT / "samples.bin").write_bytes(x_test[picked].astype(np.uint8).tobytes())

    params = sum(p.size for p in net.params())
    final = rows[-1]
    best = max(rows, key=lambda r: r["test_acc"])
    meta = {
        "name": "MLP, NumPy, from scratch",
        "arch": c["sizes"],
        "params": int(params),
        "config": c,
        "results": {
            "test_acc": final["test_acc"],
            "test_loss": final["test_loss"],
            "train_acc": final["train_acc"],
            "best_test_acc": best["test_acc"],
            "best_epoch": best["epoch"],
            "int8_test_acc": round(float(int8_acc), 5),
            "train_seconds": final["seconds"],
        },
        "source": "training/mlp_numpy/log.csv",
        "hardware": f"{cpu_name()}, CPU only, NumPy {np.__version__}",
        "commit": git_commit(),
        "command": "python training/mlp_numpy/train.py",
        "layers": layers,
        "samples": {"count": len(picked), "test_indices": picked, "labels": [int(y_test[i]) for i in picked]},
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta["results"], indent=1))


if __name__ == "__main__":
    main()
