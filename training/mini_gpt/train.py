"""Train a small character-level GPT on Tiny Shakespeare and export it to ONNX.

    .venv/Scripts/python training/mini_gpt/train.py

The model is sized for the browser: every generated character is one full forward pass over the
context in WebAssembly, with no KV cache, so it stays under a million parameters.

Writes:
  training/mini_gpt/log.csv                one row per evaluation
  public/models/mini-gpt/model.onnx        idx [1,T] int64 -> logits [1,T,V], attn [L,1,H,T,T]
  public/models/mini-gpt/meta.json         vocabulary, config, results, baselines
"""

import csv
import hashlib
import json
import math
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from cifar10 import git_commit, hardware  # noqa: E402

SITE = HERE.parent.parent
OUT = SITE / "public" / "models" / "mini-gpt"
DATA = HERE.parent / "data" / "text" / "tinyshakespeare.txt"
URL = "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt"
MD5 = "6fb458f1232090904fb40fe944165e91"

CONFIG = {
    "context": 128,
    "layers": 4,
    "heads": 4,
    "width": 128,
    "dropout": 0.1,
    "batch_size": 64,
    "steps": 6000,
    "lr": 2e-3,
    "warmup": 200,
    "weight_decay": 0.1,
    "eval_every": 250,
    "eval_batches": 40,
    "val_fraction": 0.1,
    "seed": 0,
}


def load_text():
    DATA.parent.mkdir(parents=True, exist_ok=True)
    if not DATA.exists():
        urllib.request.urlretrieve(URL, DATA)
    raw = DATA.read_bytes()
    digest = hashlib.md5(raw).hexdigest()
    if digest != MD5:
        raise RuntimeError(f"tinyshakespeare: md5 {digest} != {MD5}")
    return raw.decode("utf-8")


class Block(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        d, self.h = cfg["width"], cfg["heads"]
        self.ln1 = nn.LayerNorm(d)
        self.qkv = nn.Linear(d, 3 * d)
        self.proj = nn.Linear(d, d)
        self.ln2 = nn.LayerNorm(d)
        self.mlp = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d))
        self.drop = nn.Dropout(cfg["dropout"])

    def forward(self, x, mask):
        n, t, d = x.shape
        q, k, v = self.qkv(self.ln1(x)).split(d, dim=2)
        q, k, v = (z.view(n, t, self.h, d // self.h).transpose(1, 2) for z in (q, k, v))
        # Attention written out, not fused, so the weights can be returned and drawn.
        att = (q @ k.transpose(-2, -1)) / math.sqrt(d // self.h)
        att = att.masked_fill(mask[:t, :t] == 0, float("-inf")).softmax(dim=-1)
        y = (self.drop(att) @ v).transpose(1, 2).reshape(n, t, d)
        x = x + self.drop(self.proj(y))
        x = x + self.drop(self.mlp(self.ln2(x)))
        return x, att


class MiniGPT(nn.Module):
    def __init__(self, cfg, vocab):
        super().__init__()
        d = cfg["width"]
        self.tok = nn.Embedding(vocab, d)
        self.pos = nn.Embedding(cfg["context"], d)
        self.blocks = nn.ModuleList(Block(cfg) for _ in range(cfg["layers"]))
        self.ln = nn.LayerNorm(d)
        self.head = nn.Linear(d, vocab, bias=False)
        self.head.weight = self.tok.weight  # tied
        self.register_buffer("mask", torch.tril(torch.ones(cfg["context"], cfg["context"])), persistent=False)
        self.apply(self._init)

    @staticmethod
    def _init(m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, std=0.02)
        if isinstance(m, nn.Linear) and m.bias is not None:
            nn.init.zeros_(m.bias)

    def forward(self, idx, attn=False):
        t = idx.shape[1]
        x = self.tok(idx) + self.pos(torch.arange(t, device=idx.device))
        maps = []
        for b in self.blocks:
            x, a = b(x, self.mask)
            maps.append(a)
        logits = self.head(self.ln(x))
        return (logits, torch.stack(maps)) if attn else logits


class Exported(nn.Module):
    def __init__(self, net):
        super().__init__()
        self.net = net

    def forward(self, idx):
        return self.net(idx, attn=True)


def batches(data, cfg, gen, dev):
    ix = torch.randint(len(data) - cfg["context"] - 1, (cfg["batch_size"],), generator=gen, device=dev)
    offs = torch.arange(cfg["context"], device=dev)
    return data[ix[:, None] + offs], data[ix[:, None] + offs + 1]


@torch.no_grad()
def estimate(net, data, cfg, gen, dev):
    net.eval()
    losses = []
    for _ in range(cfg["eval_batches"]):
        x, y = batches(data, cfg, gen, dev)
        with torch.autocast("cuda", dtype=torch.bfloat16, enabled=dev.type == "cuda"):
            logits = net(x)
        losses.append(F.cross_entropy(logits.float().view(-1, logits.shape[-1]), y.view(-1)).item())
    net.train()
    return float(np.mean(losses))


@torch.no_grad()
def full_val_loss(net, data, cfg, dev):
    """Exact mean loss over the whole validation split, in non-overlapping windows, last position of each predicted with full context too."""
    net.eval()
    t = cfg["context"]
    n = (len(data) - 1) // t
    x = data[: n * t].view(n, t)
    y = data[1 : n * t + 1].view(n, t)
    total = 0.0
    for i in range(0, n, 256):
        logits = net(x[i : i + 256]).float()
        total += F.cross_entropy(logits.view(-1, logits.shape[-1]), y[i : i + 256].reshape(-1), reduction="sum").item()
    return total / (n * t)


def ngram_baselines(train, val, vocab):
    """Cross-entropy (nats/char) of add-one unigram and bigram models fitted on train, scored on val."""
    uni = np.bincount(train, minlength=vocab) + 1.0
    uni /= uni.sum()
    big = np.ones((vocab, vocab))
    np.add.at(big, (train[:-1], train[1:]), 1)
    big /= big.sum(1, keepdims=True)
    return float(-np.log(uni[val]).mean()), float(-np.log(big[val[:-1], val[1:]]).mean())


def main():
    cfg = CONFIG
    torch.manual_seed(cfg["seed"])
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    gen = torch.Generator(device=dev).manual_seed(cfg["seed"])
    text = load_text()
    chars = sorted(set(text))
    stoi = {c: i for i, c in enumerate(chars)}
    ids = np.array([stoi[c] for c in text], dtype=np.int64)
    split = int(len(ids) * (1 - cfg["val_fraction"]))
    train_np, val_np = ids[:split], ids[split:]
    train, val = torch.tensor(train_np, device=dev), torch.tensor(val_np, device=dev)

    net = MiniGPT(cfg, len(chars)).to(dev)
    params = sum(p.numel() for p in net.parameters())
    decay = [p for n, p in net.named_parameters() if p.dim() >= 2]
    no_decay = [p for n, p in net.named_parameters() if p.dim() < 2]
    opt = torch.optim.AdamW(
        [{"params": decay, "weight_decay": cfg["weight_decay"]}, {"params": no_decay, "weight_decay": 0.0}],
        lr=cfg["lr"], betas=(0.9, 0.99),
    )

    def lr_at(step):
        if step < cfg["warmup"]:
            return cfg["lr"] * (step + 1) / cfg["warmup"]
        p = (step - cfg["warmup"]) / (cfg["steps"] - cfg["warmup"])
        return cfg["lr"] * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * p)))

    rows = []
    t0 = time.time()
    for step in range(1, cfg["steps"] + 1):
        for g in opt.param_groups:
            g["lr"] = lr_at(step - 1)
        x, y = batches(train, cfg, gen, dev)
        with torch.autocast("cuda", dtype=torch.bfloat16, enabled=dev.type == "cuda"):
            logits = net(x)
        loss = F.cross_entropy(logits.float().view(-1, len(chars)), y.view(-1))
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(net.parameters(), 1.0)
        opt.step()
        if step % cfg["eval_every"] == 0 or step == 1:
            row = {
                "step": step,
                "train_loss": round(estimate(net, train, cfg, gen, dev), 4),
                "val_loss": round(estimate(net, val, cfg, gen, dev), 4),
                "lr": float(f"{lr_at(step - 1):.6g}"),
                "seconds": round(time.time() - t0, 1),
            }
            rows.append(row)
            print(row, flush=True)

    with open(HERE / "log.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    val_loss = full_val_loss(net, val, cfg, dev)
    uni, big = ngram_baselines(train_np, val_np, len(chars))

    OUT.mkdir(parents=True, exist_ok=True)
    net = net.float().cpu().eval()
    onnx_path = OUT / "model.onnx"
    torch.onnx.export(
        Exported(net),
        torch.zeros(1, 16, dtype=torch.int64),
        str(onnx_path),
        input_names=["idx"],
        output_names=["logits", "attn"],
        dynamic_axes={"idx": {1: "t"}, "logits": {1: "t"}, "attn": {3: "t", 4: "t"}},
        opset_version=17,
        dynamo=False,
    )

    # The exported file must give the same next-character distribution as PyTorch.
    import onnxruntime as ort

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    probe = val_np[: cfg["context"]][None]
    onnx_logits = sess.run(["logits"], {"idx": probe})[0]
    with torch.no_grad():
        torch_logits = net(torch.tensor(probe)).numpy()
    max_diff = float(np.abs(onnx_logits - torch_logits).max())
    assert max_diff < 1e-3, max_diff

    # A sample from the exported model, so the page can show one without running anything.
    rng = np.random.default_rng(cfg["seed"])
    ctx = [stoi[c] for c in "ROMEO:\n"]
    for _ in range(400):
        window = np.array(ctx[-cfg["context"] :], dtype=np.int64)[None]
        logit = sess.run(["logits"], {"idx": window})[0][0, -1] / 0.8
        p = np.exp(logit - logit.max())
        ctx.append(int(rng.choice(len(chars), p=p / p.sum())))
    sample = "".join(chars[i] for i in ctx)

    meta = {
        "name": "Mini-GPT",
        "params": int(params),
        "vocab": "".join(chars),
        "config": cfg,
        "results": {
            "val_loss": round(val_loss, 4),
            "val_bits_per_char": round(val_loss / math.log(2), 4),
            "train_loss_last_eval": rows[-1]["train_loss"],
            "unigram_val_loss": round(uni, 4),
            "bigram_val_loss": round(big, 4),
            "train_seconds": rows[-1]["seconds"],
            "onnx_max_abs_diff": max_diff,
        },
        "data": {"chars": len(text), "train_chars": len(train_np), "val_chars": len(val_np)},
        "sample": {"prompt": "ROMEO:\n", "temperature": 0.8, "text": sample},
        "source": "training/mini_gpt/log.csv",
        "hardware": hardware(),
        "commit": git_commit(),
        "command": "python training/mini_gpt/train.py",
        "onnx_bytes": onnx_path.stat().st_size,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(meta["results"], indent=1), params)
    print(sample)


if __name__ == "__main__":
    main()
