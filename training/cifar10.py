"""CIFAR-10 loader and training loop shared by the CIFAR scripts.

Uses the binary release (no pickle): each record is one label byte and 3072 pixel bytes, channel-major.
Everything lives on the GPU; augmentation (pad-4 random crop + horizontal flip) is done per batch there.
"""

import csv
import hashlib
import platform
import subprocess
import tarfile
import time
import urllib.request
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F

DATA = Path(__file__).parent / "data" / "cifar10"
URL = "https://www.cs.toronto.edu/~kriz/cifar-10-binary.tar.gz"
MD5 = "c32a1d4ab5d03f1284b67883e8d87530"
CLASSES = ["airplane", "automobile", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck"]
MEAN = [0.4914, 0.4822, 0.4465]
STD = [0.2470, 0.2435, 0.2616]
SITE = Path(__file__).parent.parent


def _read(path: Path):
    raw = np.frombuffer(path.read_bytes(), dtype=np.uint8).reshape(-1, 3073)
    return raw[:, 1:].reshape(-1, 3, 32, 32), raw[:, 0].astype(np.int64)


def load():
    """Returns (x_train, y_train, x_test, y_test); images are uint8 [N, 3, 32, 32]."""
    DATA.mkdir(parents=True, exist_ok=True)
    tar = DATA / "cifar-10-binary.tar.gz"
    if not tar.exists():
        print("downloading CIFAR-10")
        urllib.request.urlretrieve(URL, tar)
    digest = hashlib.md5(tar.read_bytes()).hexdigest()
    if digest != MD5:
        tar.unlink()
        raise RuntimeError(f"cifar-10: md5 {digest} != {MD5}")
    root = DATA / "cifar-10-batches-bin"
    if not root.exists():
        with tarfile.open(tar) as t:
            t.extractall(DATA, filter="data")
    parts = [_read(root / f"data_batch_{i}.bin") for i in range(1, 6)]
    x_train = np.concatenate([p[0] for p in parts])
    y_train = np.concatenate([p[1] for p in parts])
    x_test, y_test = _read(root / "test_batch.bin")
    assert x_train.shape == (50000, 3, 32, 32) and x_test.shape == (10000, 3, 32, 32)
    return x_train, y_train, x_test, y_test


def normalise(x):
    """x in [0, 1], [N, 3, H, W]. Part of every model's forward pass so the browser feeds raw pixels."""
    mean = torch.tensor(MEAN, device=x.device, dtype=x.dtype).view(1, 3, 1, 1)
    std = torch.tensor(STD, device=x.device, dtype=x.dtype).view(1, 3, 1, 1)
    return (x - mean) / std


def augment(x, gen):
    """Pad by 4, crop a random 32x32 window, flip half the batch left-right."""
    n = x.shape[0]
    xp = F.pad(x, (4, 4, 4, 4))
    dy = torch.randint(0, 9, (n,), generator=gen, device=x.device)
    dx = torch.randint(0, 9, (n,), generator=gen, device=x.device)
    i = torch.arange(32, device=x.device)
    rows = (dy[:, None] + i)[:, None, :, None]
    cols = (dx[:, None] + i)[:, None, None, :]
    out = xp[torch.arange(n, device=x.device)[:, None, None, None], torch.arange(3, device=x.device)[None, :, None, None], rows, cols]
    flip = torch.rand(n, generator=gen, device=x.device) < 0.5
    return torch.where(flip[:, None, None, None], out.flip(3), out)


@torch.no_grad()
def evaluate(net, x, y, batch=1000):
    net.eval()
    loss, correct = 0.0, 0
    for i in range(0, len(x), batch):
        with torch.autocast("cuda", dtype=torch.bfloat16, enabled=x.is_cuda):
            logits = net(x[i : i + batch]).float()
        loss += F.cross_entropy(logits, y[i : i + batch], reduction="sum").item()
        correct += (logits.argmax(1) == y[i : i + batch]).sum().item()
    return loss / len(x), correct / len(x)


def to_device(dev):
    x_train, y_train, x_test, y_test = load()
    f = lambda a: torch.tensor(a, device=dev).float().div_(255)  # noqa: E731
    return f(x_train), torch.tensor(y_train, device=dev), f(x_test), torch.tensor(y_test, device=dev), (x_test, y_test)


def fit(net, data, cfg, log_path: Path, probe=None):
    """SGD + Nesterov with a one-cycle schedule, bf16 autocast. Writes one CSV row per epoch.

    probe(net, epoch, step) is called after each backward pass, before the optimiser step, so it can
    read gradients. Returns the list of rows.
    """
    xtr, ytr, xte, yte = data
    dev = xtr.device
    gen = torch.Generator(device=dev).manual_seed(cfg["seed"])
    opt = torch.optim.SGD(net.parameters(), lr=cfg["max_lr"], momentum=0.9, weight_decay=cfg["weight_decay"], nesterov=True)
    steps = int(np.ceil(len(xtr) / cfg["batch_size"]))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=cfg["max_lr"], epochs=cfg["epochs"], steps_per_epoch=steps, pct_start=0.15)
    rows = []
    t0 = time.time()
    for epoch in range(1, cfg["epochs"] + 1):
        net.train()
        order = torch.randperm(len(xtr), generator=gen, device=dev)
        run_loss = torch.zeros((), device=dev)
        run_correct = torch.zeros((), device=dev)
        for step, i in enumerate(range(0, len(order), cfg["batch_size"])):
            idx = order[i : i + cfg["batch_size"]]
            xb = augment(xtr[idx], gen)
            with torch.autocast("cuda", dtype=torch.bfloat16, enabled=xb.is_cuda):
                logits = net(xb)
                loss = F.cross_entropy(logits.float(), ytr[idx])
            opt.zero_grad(set_to_none=True)
            loss.backward()
            if probe:
                probe(net, epoch, step)
            opt.step()
            sched.step()
            run_loss += loss.detach() * len(idx)
            run_correct += (logits.argmax(1) == ytr[idx]).sum()
        test_loss, test_acc = evaluate(net, xte, yte)
        row = {
            "epoch": epoch,
            "train_loss": round(run_loss.item() / len(xtr), 5),
            "train_acc": round(run_correct.item() / len(xtr), 5),
            "test_loss": round(test_loss, 5),
            "test_acc": round(test_acc, 5),
            "lr_end": float(f"{sched.get_last_lr()[0]:.6g}"),
            "seconds": round(time.time() - t0, 1),
        }
        rows.append(row)
        print(log_path.parent.name, log_path.stem, row, flush=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    return rows


def onnx_accuracy(onnx_path: Path, x_test_u8, y_test, output="probs"):
    """Score the exported file itself on the full test set; that file is what visitors run."""
    import onnxruntime as ort

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    xs = x_test_u8.astype(np.float32) / 255
    preds = []
    for i in range(0, len(xs), 500):
        preds.append(sess.run([output], {"image": xs[i : i + 500]})[0].argmax(1))
    return float((np.concatenate(preds) == y_test).mean())


def write_samples(path: Path, x_test_u8, y_test, n=120, seed=0):
    """n test images, balanced across classes, as raw uint8 CHW bytes; labels go in meta.json."""
    rng = np.random.default_rng(seed)
    idx = np.concatenate([rng.choice(np.flatnonzero(y_test == c), n // 10, replace=False) for c in range(10)])
    rng.shuffle(idx)
    path.write_bytes(np.ascontiguousarray(x_test_u8[idx]).tobytes())
    return [int(y_test[i]) for i in idx], [int(i) for i in idx]


def git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=SITE, text=True).strip()
    except Exception:
        return "unknown"


def hardware():
    if torch.cuda.is_available():
        return f"{torch.cuda.get_device_name(0)}, PyTorch {torch.__version__}"
    return f"{platform.processor()}, CPU, PyTorch {torch.__version__}"
