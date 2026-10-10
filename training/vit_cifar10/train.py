"""Train a small Vision Transformer on CIFAR-10 from scratch and export it with attention rollout.

    .venv/Scripts/python training/vit_cifar10/train.py

Same data, augmentation and epoch budget as the ResNet runs, so the two can be compared. No pretraining
and no extra augmentation such as mixup or RandAugment: this measures what attention alone gets from
50,000 small images.

Writes:
  training/vit_cifar10/log.csv
  public/models/vit-cifar10/model.onnx   image [N,3,32,32] -> probs [N,10], cam [N,10,8,8] (rollout, same for every class)
  public/models/vit-cifar10/meta.json
"""

import json
import sys
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
import cifar10 as C  # noqa: E402

OUT = C.SITE / "public" / "models" / "vit-cifar10"
CONFIG = {
    "epochs": 50,
    "batch_size": 128,
    "optimizer": "adamw",
    "max_lr": 1e-3,
    "weight_decay": 0.05,
    "seed": 0,
    "patch": 4,
    "width": 192,
    "depth": 6,
    "heads": 3,
    "mlp": 384,
}


class Block(nn.Module):
    def __init__(self, d, heads, mlp):
        super().__init__()
        self.h = heads
        self.ln1 = nn.LayerNorm(d)
        self.qkv = nn.Linear(d, 3 * d)
        self.proj = nn.Linear(d, d)
        self.ln2 = nn.LayerNorm(d)
        self.mlp = nn.Sequential(nn.Linear(d, mlp), nn.GELU(), nn.Linear(mlp, d))

    def forward(self, x):
        n, t, d = x.shape
        q, k, v = self.qkv(self.ln1(x)).split(d, dim=2)
        q, k, v = (z.view(n, t, self.h, d // self.h).transpose(1, 2) for z in (q, k, v))
        att = ((q @ k.transpose(-2, -1)) * (d // self.h) ** -0.5).softmax(dim=-1)
        x = x + self.proj((att @ v).transpose(1, 2).reshape(n, t, d))
        return x + self.mlp(self.ln2(x)), att


class ViT(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        d, p = cfg["width"], cfg["patch"]
        self.grid = 32 // p
        self.embed = nn.Conv2d(3, d, p, p)
        self.cls = nn.Parameter(torch.zeros(1, 1, d))
        self.pos = nn.Parameter(torch.randn(1, self.grid**2 + 1, d) * 0.02)
        self.blocks = nn.ModuleList(Block(d, cfg["heads"], cfg["mlp"]) for _ in range(cfg["depth"]))
        self.ln = nn.LayerNorm(d)
        self.fc = nn.Linear(d, 10)

    def forward(self, x, cam=False):
        x = self.embed(C.normalise(x)).flatten(2).transpose(1, 2)
        x = torch.cat([self.cls.expand(len(x), -1, -1), x], 1) + self.pos
        maps = []
        for b in self.blocks:
            x, a = b(x)
            maps.append(a)
        logits = self.fc(self.ln(x[:, 0]))
        if not cam:
            return logits
        return logits, self.rollout(maps)

    def rollout(self, maps):
        """Attention rollout (Abnar & Zuidema, 2020): head-averaged attention plus identity for the residual, multiplied through the layers; the CLS row says how much each patch reached the classifier."""
        t = maps[0].shape[-1]
        eye = torch.eye(t, device=maps[0].device)
        r = eye.expand(maps[0].shape[0], t, t)
        for a in maps:
            a = 0.5 * a.mean(1) + 0.5 * eye
            r = (a / a.sum(-1, keepdim=True)) @ r
        m = r[:, 0, 1:].reshape(-1, 1, self.grid, self.grid)
        return m.expand(-1, 10, -1, -1)


class Exported(nn.Module):
    def __init__(self, net):
        super().__init__()
        self.net = net

    def forward(self, image):
        logits, cam = self.net(image, cam=True)
        return F.softmax(logits, dim=1), cam


def main():
    cfg = CONFIG
    torch.manual_seed(cfg["seed"])
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.backends.cudnn.benchmark = True
    xtr, ytr, xte, yte, (x_test_u8, y_test) = C.to_device(dev)

    net = ViT(cfg).to(dev)
    params = sum(p.numel() for p in net.parameters())
    rows = C.fit(net, (xtr, ytr, xte, yte), cfg, HERE / "log.csv")

    OUT.mkdir(parents=True, exist_ok=True)
    net = net.float().cpu().eval()
    torch.save(net.state_dict(), HERE / "model.pt")
    onnx_path = OUT / "model.onnx"
    torch.onnx.export(
        Exported(net).eval(),
        torch.zeros(1, 3, 32, 32),
        str(onnx_path),
        input_names=["image"],
        output_names=["probs", "cam"],
        dynamic_axes={"image": {0: "n"}, "probs": {0: "n"}, "cam": {0: "n"}},
        opset_version=17,
        dynamo=False,
    )
    onnx_acc = C.onnx_accuracy(onnx_path, x_test_u8, y_test)

    final = rows[-1]
    meta = {
        "name": "ViT-Tiny",
        "params": int(params),
        "classes": C.CLASSES,
        "config": cfg,
        "results": {
            "test_acc": final["test_acc"],
            "test_loss": final["test_loss"],
            "train_acc": final["train_acc"],
            "train_loss": final["train_loss"],
            "onnx_test_acc": round(onnx_acc, 5),
            "train_seconds": final["seconds"],
        },
        "source": "training/vit_cifar10/log.csv",
        "hardware": C.hardware(),
        "commit": C.git_commit(),
        "command": "python training/vit_cifar10/train.py",
        "onnx_bytes": onnx_path.stat().st_size,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta["results"], indent=1), params)


if __name__ == "__main__":
    main()
