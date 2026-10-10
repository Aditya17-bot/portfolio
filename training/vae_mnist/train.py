"""Train a variational autoencoder with a 2-D latent space on MNIST and export both halves to ONNX.

    .venv/Scripts/python training/vae_mnist/train.py

A 2-D latent space is a deliberate limit: reconstructions are blurrier than with 16 or 32 dimensions,
but every point of it can be shown on a screen and dragged through.

Writes:
  training/vae_mnist/log.csv
  public/models/vae-mnist/encoder.onnx   image [N,1,28,28] in [0,1] -> mu [N,2]
  public/models/vae-mnist/decoder.onnx   z [N,2] -> image [N,1,28,28] in [0,1]
  public/models/vae-mnist/latent.json    mu and label of 2,000 test digits, for the map
  public/models/vae-mnist/meta.json
"""

import csv
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from cifar10 import git_commit, hardware  # noqa: E402
from mnist import load  # noqa: E402

SITE = HERE.parent.parent
OUT = SITE / "public" / "models" / "vae-mnist"
CONFIG = {"epochs": 40, "batch_size": 128, "lr": 2e-3, "latent": 2, "hidden": [512, 256], "seed": 0, "map_points": 2000}


class Encoder(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        h1, h2 = cfg["hidden"]
        self.body = nn.Sequential(nn.Flatten(), nn.Linear(784, h1), nn.ReLU(), nn.Linear(h1, h2), nn.ReLU())
        self.mu = nn.Linear(h2, cfg["latent"])
        self.logvar = nn.Linear(h2, cfg["latent"])

    def forward(self, x):
        h = self.body(x)
        return self.mu(h), self.logvar(h)


class Decoder(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        h1, h2 = cfg["hidden"]
        self.body = nn.Sequential(nn.Linear(cfg["latent"], h2), nn.ReLU(), nn.Linear(h2, h1), nn.ReLU(), nn.Linear(h1, 784))

    def forward(self, z):
        return self.body(z).view(-1, 1, 28, 28)  # logits


class MuOnly(nn.Module):
    def __init__(self, enc):
        super().__init__()
        self.enc = enc

    def forward(self, image):
        return self.enc(image)[0]


class Pixels(nn.Module):
    def __init__(self, dec):
        super().__init__()
        self.dec = dec

    def forward(self, z):
        return torch.sigmoid(self.dec(z))


def loss_fn(logits, x, mu, logvar):
    """Negative ELBO per image, in nats: Bernoulli reconstruction + KL to the unit Gaussian."""
    rec = F.binary_cross_entropy_with_logits(logits, x, reduction="sum") / len(x)
    kl = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp()) / len(x)
    return rec, kl


@torch.no_grad()
def evaluate(enc, dec, x):
    enc.eval()
    dec.eval()
    rec_t, kl_t = 0.0, 0.0
    for i in range(0, len(x), 2000):
        xb = x[i : i + 2000]
        mu, logvar = enc(xb)
        rec, kl = loss_fn(dec(mu), xb, mu, logvar)
        rec_t += rec.item() * len(xb)
        kl_t += kl.item() * len(xb)
    return rec_t / len(x), kl_t / len(x)


def main():
    cfg = CONFIG
    torch.manual_seed(cfg["seed"])
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    gen = torch.Generator(device=dev).manual_seed(cfg["seed"])
    x_train, _, x_test, y_test = load()
    xtr = torch.tensor(x_train, device=dev).float().div_(255).unsqueeze(1)
    xte = torch.tensor(x_test, device=dev).float().div_(255).unsqueeze(1)

    enc, dec = Encoder(cfg).to(dev), Decoder(cfg).to(dev)
    params = sum(p.numel() for m in (enc, dec) for p in m.parameters())
    opt = torch.optim.Adam([*enc.parameters(), *dec.parameters()], lr=cfg["lr"])
    steps = int(np.ceil(len(xtr) / cfg["batch_size"]))
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=cfg["epochs"] * steps)

    rows = []
    t0 = time.time()
    for epoch in range(1, cfg["epochs"] + 1):
        enc.train()
        dec.train()
        order = torch.randperm(len(xtr), generator=gen, device=dev)
        rec_s, kl_s = 0.0, 0.0
        for i in range(0, len(order), cfg["batch_size"]):
            xb = xtr[order[i : i + cfg["batch_size"]]]
            mu, logvar = enc(xb)
            z = mu + torch.randn(mu.shape, generator=gen, device=dev) * (0.5 * logvar).exp()
            rec, kl = loss_fn(dec(z), xb, mu, logvar)
            opt.zero_grad(set_to_none=True)
            (rec + kl).backward()
            opt.step()
            sched.step()
            rec_s += rec.item() * len(xb)
            kl_s += kl.item() * len(xb)
        test_rec, test_kl = evaluate(enc, dec, xte)
        row = {
            "epoch": epoch,
            "train_rec": round(rec_s / len(xtr), 3),
            "train_kl": round(kl_s / len(xtr), 3),
            "test_rec": round(test_rec, 3),
            "test_kl": round(test_kl, 3),
            "test_elbo": round(-(test_rec + test_kl), 3),
            "seconds": round(time.time() - t0, 1),
        }
        rows.append(row)
        print(row, flush=True)

    with open(HERE / "log.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    OUT.mkdir(parents=True, exist_ok=True)
    enc, dec = enc.cpu().eval(), dec.cpu().eval()
    for name, mod, arg, inp, out in [
        ("encoder", MuOnly(enc), torch.zeros(1, 1, 28, 28), "image", "mu"),
        ("decoder", Pixels(dec), torch.zeros(1, cfg["latent"]), "z", "image"),
    ]:
        torch.onnx.export(
            mod, arg, str(OUT / f"{name}.onnx"), input_names=[inp], output_names=[out],
            dynamic_axes={inp: {0: "n"}, out: {0: "n"}}, opset_version=17, dynamo=False,
        )

    # Check the exported files against PyTorch, and take the map points from the exported encoder.
    import onnxruntime as ort

    xs = (x_test.astype(np.float32) / 255)[:, None]
    e = ort.InferenceSession(str(OUT / "encoder.onnx"), providers=["CPUExecutionProvider"])
    d = ort.InferenceSession(str(OUT / "decoder.onnx"), providers=["CPUExecutionProvider"])
    mu_onnx = e.run(["mu"], {"image": xs})[0]
    with torch.no_grad():
        mu_torch = enc(torch.tensor(xs))[0].numpy()
        img_torch = torch.sigmoid(dec(torch.tensor(mu_torch))).numpy()
    img_onnx = d.run(["image"], {"z": mu_onnx})[0]
    max_mu_diff = float(np.abs(mu_onnx - mu_torch).max())
    max_img_diff = float(np.abs(img_onnx - img_torch).max())
    assert max_mu_diff < 1e-3 and max_img_diff < 1e-3, (max_mu_diff, max_img_diff)

    rng = np.random.default_rng(cfg["seed"])
    idx = rng.choice(len(xs), cfg["map_points"], replace=False)
    lo = np.percentile(mu_onnx, 0.5, axis=0)
    hi = np.percentile(mu_onnx, 99.5, axis=0)
    latent = {
        "points": [[round(float(a), 3), round(float(b), 3), int(y_test[i])] for i, (a, b) in zip(idx, mu_onnx[idx])],
        "extent": [[round(float(lo[0]), 2), round(float(hi[0]), 2)], [round(float(lo[1]), 2), round(float(hi[1]), 2)]],
    }
    (OUT / "latent.json").write_text(json.dumps(latent, separators=(",", ":")))

    final = rows[-1]
    meta = {
        "name": "Variational autoencoder",
        "params": int(params),
        "config": cfg,
        "results": {
            "test_rec": final["test_rec"],
            "test_kl": final["test_kl"],
            "test_elbo": final["test_elbo"],
            "train_seconds": final["seconds"],
            "onnx_max_abs_diff": {"mu": max_mu_diff, "image": max_img_diff},
        },
        "source": "training/vae_mnist/log.csv",
        "hardware": hardware(),
        "commit": git_commit(),
        "command": "python training/vae_mnist/train.py",
        "onnx_bytes": {n: (OUT / f"{n}.onnx").stat().st_size for n in ("encoder", "decoder")},
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta["results"], indent=1), params)


if __name__ == "__main__":
    main()
