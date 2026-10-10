"""Train a small CNN on MNIST and export it to ONNX for the browser.

    .venv/Scripts/python training/cnn_mnist/train.py

Writes:
  training/cnn_mnist/log.csv          one row per epoch
  public/models/cnn-mnist/model.onnx  outputs: logits, plus two feature-map taps for the page
  public/models/cnn-mnist/meta.json   architecture, results, provenance
"""

import csv
import json
import platform
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from mnist import load  # noqa: E402

SITE = HERE.parent.parent
OUT = SITE / "public" / "models" / "cnn-mnist"

CONFIG = {
    "epochs": 15,
    "batch_size": 128,
    "max_lr": 0.05,
    "momentum": 0.9,
    "weight_decay": 5e-4,
    "rotate_deg": 10,
    "translate": 0.1,
    "seed": 1,
}


def block(c_in, c_out, k=3):
    return nn.Sequential(nn.Conv2d(c_in, c_out, k, bias=False), nn.BatchNorm2d(c_out), nn.ReLU(inplace=True))


class SmallCNN(nn.Module):
    """28 -> 26 -> 24 -> pool 12 -> 10 -> 8 -> 6 -> 1x1 to 10 classes -> global average pool."""

    def __init__(self):
        super().__init__()
        self.c1 = block(1, 8)
        self.c2 = block(8, 12)
        self.pool = nn.MaxPool2d(2)
        self.c3 = block(12, 16)
        self.c4 = block(16, 16)
        self.c5 = block(16, 16)
        self.head = nn.Conv2d(16, 10, 1)

    def forward(self, x, taps=False):
        x = (x - 0.1307) / 0.3081
        a1 = self.c1(x)
        x = self.pool(self.c2(a1))
        x = self.c3(x)
        a4 = self.c4(x)
        x = self.head(self.c5(a4))
        logits = x.mean(dim=(2, 3))
        return (logits, a1, a4) if taps else logits


class Exported(nn.Module):
    def __init__(self, net):
        super().__init__()
        self.net = net

    def forward(self, x):
        logits, a1, a4 = self.net(x, taps=True)
        return F.softmax(logits, dim=1), a1, a4


def augment(x, cfg, gen):
    """Random rotation and translation for a whole batch at once, on the GPU."""
    n = x.shape[0]
    ang = (torch.rand(n, generator=gen, device=x.device) * 2 - 1) * cfg["rotate_deg"] * np.pi / 180
    t = (torch.rand(n, 2, generator=gen, device=x.device) * 2 - 1) * cfg["translate"] * 2
    cos, sin = torch.cos(ang), torch.sin(ang)
    theta = torch.stack([torch.stack([cos, -sin, t[:, 0]], 1), torch.stack([sin, cos, t[:, 1]], 1)], 1)
    grid = F.affine_grid(theta, x.shape, align_corners=False)
    return F.grid_sample(x, grid, align_corners=False, padding_mode="zeros")


@torch.no_grad()
def evaluate(net, x, y, batch=2000):
    net.eval()
    loss, correct = 0.0, 0
    for i in range(0, len(x), batch):
        logits = net(x[i : i + batch])
        loss += F.cross_entropy(logits, y[i : i + batch], reduction="sum").item()
        correct += (logits.argmax(1) == y[i : i + batch]).sum().item()
    return loss / len(x), correct / len(x)


def git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=SITE, text=True).strip()
    except Exception:
        return "unknown"


def main():
    cfg = CONFIG
    torch.manual_seed(cfg["seed"])
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    gen = torch.Generator(device=dev).manual_seed(cfg["seed"])

    x_train, y_train, x_test, y_test = load()
    to_t = lambda a: torch.tensor(a, dtype=torch.float32, device=dev).unsqueeze(1) / 255  # noqa: E731
    xtr, xte = to_t(x_train), to_t(x_test)
    ytr = torch.tensor(y_train, device=dev)
    yte = torch.tensor(y_test, device=dev)

    net = SmallCNN().to(dev)
    params = sum(p.numel() for p in net.parameters())
    opt = torch.optim.SGD(net.parameters(), lr=cfg["max_lr"], momentum=cfg["momentum"], weight_decay=cfg["weight_decay"], nesterov=True)
    steps = int(np.ceil(len(xtr) / cfg["batch_size"]))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=cfg["max_lr"], epochs=cfg["epochs"], steps_per_epoch=steps)

    rows = []
    t0 = time.time()
    for epoch in range(1, cfg["epochs"] + 1):
        net.train()
        order = torch.randperm(len(xtr), generator=gen, device=dev)
        run_loss, run_correct = 0.0, 0
        for i in range(0, len(order), cfg["batch_size"]):
            idx = order[i : i + cfg["batch_size"]]
            xb = augment(xtr[idx], cfg, gen)
            logits = net(xb)
            loss = F.cross_entropy(logits, ytr[idx])
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            run_loss += loss.item() * len(idx)
            run_correct += (logits.argmax(1) == ytr[idx]).sum().item()
        test_loss, test_acc = evaluate(net, xte, yte)
        row = {
            "epoch": epoch,
            "train_loss": round(run_loss / len(xtr), 5),
            "train_acc": round(run_correct / len(xtr), 5),
            "test_loss": round(test_loss, 5),
            "test_acc": round(test_acc, 5),
            "lr_end": float(f"{sched.get_last_lr()[0]:.6g}"),
            "seconds": round(time.time() - t0, 1),
        }
        rows.append(row)
        print(row, flush=True)

    with open(HERE / "log.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    # Export with two feature-map taps so the page can show what the filters respond to.
    OUT.mkdir(parents=True, exist_ok=True)
    net.eval().cpu()
    onnx_path = OUT / "model.onnx"
    torch.onnx.export(
        Exported(net),
        torch.zeros(1, 1, 28, 28),
        str(onnx_path),
        input_names=["image"],
        output_names=["probs", "conv1", "conv4"],
        opset_version=17,
        dynamo=False,
    )

    # The exported file, not the PyTorch model, is what visitors run: score it on the full test set.
    import onnxruntime as ort

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    xs = (x_test.astype(np.float32) / 255)[:, None]
    probs = np.concatenate([sess.run(["probs"], {"image": xs[i : i + 1]})[0] for i in range(len(xs))])
    onnx_acc = float((probs.argmax(1) == y_test).mean())

    gpu = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    final = rows[-1]
    meta = {
        "name": "Small CNN",
        "params": int(params),
        "config": cfg,
        "results": {
            "test_acc": final["test_acc"],
            "test_loss": final["test_loss"],
            "train_acc": final["train_acc"],
            "onnx_test_acc": round(onnx_acc, 5),
            "train_seconds": final["seconds"],
        },
        "source": "training/cnn_mnist/log.csv",
        "hardware": f"{gpu}, PyTorch {torch.__version__}" if gpu else f"{platform.processor()}, CPU, PyTorch {torch.__version__}",
        "commit": git_commit(),
        "command": "python training/cnn_mnist/train.py",
        "onnx_bytes": onnx_path.stat().st_size,
        "taps": {"conv1": [8, 26, 26], "conv4": [16, 8, 8]},
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta["results"], indent=1), params)


if __name__ == "__main__":
    main()
