"""Train a DCGAN on MNIST and export the generator to ONNX.

    .venv/Scripts/python training/dcgan_mnist/train.py

A GAN has no test loss to report, so the generator is judged with the small CNN from this zoo
(public/models/cnn-mnist/model.onnx), which never saw a generated image:
  - class coverage: how 10,000 samples spread over the ten digits (mode collapse shows up here),
  - confidence: how sure the CNN is about each sample,
  - a Frechet distance between real and generated images in the CNN's 16-channel conv4 features.
    This is the idea behind FID, but with a tiny MNIST network instead of Inception, so the
    number is only comparable within this page.

Writes:
  training/dcgan_mnist/log.csv
  public/models/dcgan-mnist/generator.onnx   z [N,64] -> image [N,1,28,28] in [0,1]
  public/models/dcgan-mnist/meta.json
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
OUT = SITE / "public" / "models" / "dcgan-mnist"
JUDGE = SITE / "public" / "models" / "cnn-mnist" / "model.onnx"
CONFIG = {"epochs": 30, "batch_size": 128, "lr": 2e-4, "betas": [0.5, 0.999], "z": 64, "seed": 0, "eval_samples": 10000}


class Generator(nn.Module):
    def __init__(self, z):
        super().__init__()
        self.fc = nn.Sequential(nn.Linear(z, 128 * 7 * 7, bias=False), nn.BatchNorm1d(128 * 7 * 7), nn.ReLU(True))
        self.net = nn.Sequential(
            nn.ConvTranspose2d(128, 64, 4, 2, 1, bias=False), nn.BatchNorm2d(64), nn.ReLU(True),  # 14x14
            nn.ConvTranspose2d(64, 1, 4, 2, 1),  # 28x28
        )

    def forward(self, z):
        return torch.tanh(self.net(self.fc(z).view(-1, 128, 7, 7)))


class Discriminator(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(1, 64, 4, 2, 1), nn.LeakyReLU(0.2, True),  # 14
            nn.Conv2d(64, 128, 4, 2, 1, bias=False), nn.BatchNorm2d(128), nn.LeakyReLU(0.2, True),  # 7
            nn.Flatten(), nn.Linear(128 * 7 * 7, 1),
        )

    def forward(self, x):
        return self.net(x).squeeze(1)


class Pixels(nn.Module):
    """[-1, 1] to [0, 1], so the page and the judge see what MNIST looks like."""

    def __init__(self, g):
        super().__init__()
        self.g = g

    def forward(self, z):
        return (self.g(z) + 1) / 2


def init(m):
    if isinstance(m, (nn.Conv2d, nn.ConvTranspose2d, nn.Linear)):
        nn.init.normal_(m.weight, 0.0, 0.02)
    elif isinstance(m, (nn.BatchNorm2d, nn.BatchNorm1d)):
        nn.init.normal_(m.weight, 1.0, 0.02)
        nn.init.zeros_(m.bias)


def judge(images):
    """Run the zoo's MNIST CNN on images [N,1,28,28] in [0,1]. Returns probs [N,10] and pooled conv4 features [N,16]."""
    import onnxruntime as ort

    sess = ort.InferenceSession(str(JUDGE), providers=["CPUExecutionProvider"])
    probs, feats = [], []
    for i in range(0, len(images), 1):
        p, _, c4 = sess.run(["probs", "conv1", "conv4"], {"image": images[i : i + 1]})
        probs.append(p)
        feats.append(c4.mean(axis=(2, 3)))
    return np.concatenate(probs), np.concatenate(feats)


def frechet(a, b):
    """Frechet distance between Gaussians fitted to two feature sets. tr(sqrt(S1 S2)) is the sum of the
    square roots of the eigenvalues of S1 S2, which are real and non-negative for covariance matrices."""
    mu1, mu2 = a.mean(0), b.mean(0)
    s1, s2 = np.cov(a, rowvar=False), np.cov(b, rowvar=False)
    tr_covmean = np.sqrt(np.clip(np.linalg.eigvals(s1 @ s2).real, 0, None)).sum()
    return float(((mu1 - mu2) ** 2).sum() + np.trace(s1) + np.trace(s2) - 2 * tr_covmean)


def main():
    cfg = CONFIG
    torch.manual_seed(cfg["seed"])
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    gen = torch.Generator(device=dev).manual_seed(cfg["seed"])
    x_train, _, x_test, _ = load()
    xtr = torch.tensor(x_train, device=dev).float().div_(127.5).sub_(1).unsqueeze(1)

    G, D = Generator(cfg["z"]).to(dev), Discriminator().to(dev)
    G.apply(init)
    D.apply(init)
    params = sum(p.numel() for p in G.parameters())
    opt_g = torch.optim.Adam(G.parameters(), lr=cfg["lr"], betas=tuple(cfg["betas"]))
    opt_d = torch.optim.Adam(D.parameters(), lr=cfg["lr"], betas=tuple(cfg["betas"]))

    rows = []
    t0 = time.time()
    for epoch in range(1, cfg["epochs"] + 1):
        order = torch.randperm(len(xtr), generator=gen, device=dev)
        ld, lg, d_real, d_fake, n = 0.0, 0.0, 0.0, 0.0, 0
        for i in range(0, len(order), cfg["batch_size"]):
            real = xtr[order[i : i + cfg["batch_size"]]]
            b = len(real)
            z = torch.randn(b, cfg["z"], generator=gen, device=dev)
            fake = G(z)
            # Discriminator: real -> 1, fake -> 0.
            out_r, out_f = D(real), D(fake.detach())
            loss_d = F.binary_cross_entropy_with_logits(out_r, torch.ones_like(out_r)) + F.binary_cross_entropy_with_logits(
                out_f, torch.zeros_like(out_f)
            )
            opt_d.zero_grad(set_to_none=True)
            loss_d.backward()
            opt_d.step()
            # Generator: make the discriminator say 1 (non-saturating loss).
            out = D(fake)
            loss_g = F.binary_cross_entropy_with_logits(out, torch.ones_like(out))
            opt_g.zero_grad(set_to_none=True)
            loss_g.backward()
            opt_g.step()
            ld += loss_d.item() * b
            lg += loss_g.item() * b
            d_real += torch.sigmoid(out_r).sum().item()
            d_fake += torch.sigmoid(out_f).sum().item()
            n += b
        row = {
            "epoch": epoch,
            "loss_d": round(ld / n, 4),
            "loss_g": round(lg / n, 4),
            "d_real": round(d_real / n, 4),
            "d_fake": round(d_fake / n, 4),
            "seconds": round(time.time() - t0, 1),
        }
        rows.append(row)
        print(row, flush=True)

    with open(HERE / "log.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    OUT.mkdir(parents=True, exist_ok=True)
    G = G.cpu().eval()
    torch.save(G.state_dict(), HERE / "generator.pt")
    onnx_path = OUT / "generator.onnx"
    torch.onnx.export(
        Pixels(G).eval(), torch.zeros(1, cfg["z"]), str(onnx_path), input_names=["z"], output_names=["image"],
        dynamic_axes={"z": {0: "n"}, "image": {0: "n"}}, opset_version=17, dynamo=False,
    )

    # Judge samples from the exported generator.
    import onnxruntime as ort

    rng = np.random.default_rng(cfg["seed"])
    zs = rng.standard_normal((cfg["eval_samples"], cfg["z"])).astype(np.float32)
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    fake = np.concatenate([sess.run(["image"], {"z": zs[i : i + 1000]})[0] for i in range(0, len(zs), 1000)])
    with torch.no_grad():
        ref = Pixels(G)(torch.tensor(zs[:1000])).numpy()
    max_diff = float(np.abs(fake[:1000] - ref).max())
    assert max_diff < 1e-3, max_diff
    real = (x_test.astype(np.float32) / 255)[:, None][: cfg["eval_samples"]]
    p_fake, f_fake = judge(fake)
    p_real, f_real = judge(real)
    counts = np.bincount(p_fake.argmax(1), minlength=10)
    meta = {
        "name": "DCGAN",
        "params": int(params),
        "config": cfg,
        "results": {
            "class_counts": [int(c) for c in counts],
            "class_entropy_bits": round(float(-(counts / counts.sum() * np.log2(np.maximum(counts / counts.sum(), 1e-12))).sum()), 4),
            "mean_confidence_generated": round(float(p_fake.max(1).mean()), 4),
            "mean_confidence_real": round(float(p_real.max(1).mean()), 4),
            "frechet_cnn_generated": round(frechet(f_real, f_fake), 4),
            "frechet_cnn_real_halves": round(frechet(f_real[:5000], f_real[5000:]), 4),
            "train_seconds": rows[-1]["seconds"],
            "onnx_max_abs_diff": max_diff,
        },
        "source": "training/dcgan_mnist/log.csv",
        "hardware": hardware(),
        "commit": git_commit(),
        "command": "python training/dcgan_mnist/train.py",
        "onnx_bytes": onnx_path.stat().st_size,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta["results"], indent=1), params)


if __name__ == "__main__":
    main()
