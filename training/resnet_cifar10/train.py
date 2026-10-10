"""The depth experiment from He et al. 2016, section 4.2, on CIFAR-10.

    .venv/Scripts/python training/resnet_cifar10/train.py            # all four runs
    .venv/Scripts/python training/resnet_cifar10/train.py resnet-56  # one run

Four networks with the same layers and the same parameter count, trained with the same recipe:
plain-20, plain-56, resnet-20, resnet-56. The only difference between a plain net and a ResNet is the
identity shortcut (option A: strided identity, zero-padded channels, no extra parameters).

During the first epoch it also records the gradient norm of every conv layer, to show why the plain
56-layer net trains worse: the signal that reaches the early layers is much weaker.

Writes:
  training/resnet_cifar10/<run>.csv          one row per epoch, per run
  training/resnet_cifar10/gradients.json     per-layer gradient norms, first epoch, per run
  public/models/resnet-cifar10/<run>.json    final results for each run
  public/models/resnet-cifar10/resnet-56.onnx   the best model, with class activation maps
  public/models/resnet-cifar10/meta.json
"""

import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
import cifar10 as C  # noqa: E402

OUT = C.SITE / "public" / "models" / "resnet-cifar10"
CONFIG = {"epochs": 50, "batch_size": 128, "max_lr": 0.1, "weight_decay": 1e-4, "seed": 0}
RUNS = {"plain-20": (3, False), "plain-56": (9, False), "resnet-20": (3, True), "resnet-56": (9, True)}
PROBE_STEPS = 50


class Block(nn.Module):
    def __init__(self, c_in, c_out, stride, residual):
        super().__init__()
        self.residual = residual
        self.conv1 = nn.Conv2d(c_in, c_out, 3, stride, 1, bias=False)
        self.bn1 = nn.BatchNorm2d(c_out)
        self.conv2 = nn.Conv2d(c_out, c_out, 3, 1, 1, bias=False)
        self.bn2 = nn.BatchNorm2d(c_out)
        self.stride = stride
        self.pad = c_out - c_in

    def shortcut(self, x):
        if self.stride == 1 and self.pad == 0:
            return x
        x = x[:, :, :: self.stride, :: self.stride]
        return F.pad(x, (0, 0, 0, 0, self.pad // 2, self.pad - self.pad // 2))

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        if self.residual:
            out = out + self.shortcut(x)
        return F.relu(out)


class Net(nn.Module):
    """6n+2 layers: one conv, three stages of n blocks at 16/32/64 channels, global average pool, linear."""

    def __init__(self, n, residual):
        super().__init__()
        self.conv = nn.Conv2d(3, 16, 3, 1, 1, bias=False)
        self.bn = nn.BatchNorm2d(16)
        layers, c = [], 16
        for stage, width in enumerate([16, 32, 64]):
            for i in range(n):
                layers.append(Block(c, width, 2 if stage > 0 and i == 0 else 1, residual))
                c = width
        self.blocks = nn.Sequential(*layers)
        self.fc = nn.Linear(64, 10)
        for m in self.modules():
            if isinstance(m, (nn.Conv2d, nn.Linear)):
                nn.init.kaiming_normal_(m.weight, nonlinearity="relu")

    def forward(self, x, cam=False):
        a = self.blocks(F.relu(self.bn(self.conv(C.normalise(x)))))
        logits = self.fc(a.mean(dim=(2, 3)))
        if not cam:
            return logits
        return logits, torch.einsum("ck,nkhw->nchw", self.fc.weight, a)


class Exported(nn.Module):
    def __init__(self, net):
        super().__init__()
        self.net = net

    def forward(self, image):
        logits, cam = self.net(image, cam=True)
        return F.softmax(logits, dim=1), cam


def conv_layers(net):
    return [m for m in net.modules() if isinstance(m, nn.Conv2d)]


def main():
    cfg = CONFIG
    names = sys.argv[1:] or list(RUNS)
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.backends.cudnn.benchmark = True
    xtr, ytr, xte, yte, (x_test_u8, y_test) = C.to_device(dev)
    OUT.mkdir(parents=True, exist_ok=True)
    grad_path = HERE / "gradients.json"
    grads_all = json.loads(grad_path.read_text()) if grad_path.exists() else {}

    for name in names:
        n, residual = RUNS[name]
        torch.manual_seed(cfg["seed"])
        net = Net(n, residual).to(dev).to(memory_format=torch.channels_last)
        params = sum(p.numel() for p in net.parameters())
        convs = conv_layers(net)
        sums = np.zeros(len(convs))

        def probe(net, epoch, step):
            if epoch == 1 and step < PROBE_STEPS:
                for j, m in enumerate(convs):
                    sums[j] += m.weight.grad.norm().item()

        rows = C.fit(net, (xtr, ytr, xte, yte), cfg, HERE / f"{name}.csv", probe=probe)
        grads_all[name] = [round(float(v), 6) for v in sums / PROBE_STEPS]
        grad_path.write_text(json.dumps(grads_all, indent=1))

        final = rows[-1]
        result = {
            "name": name,
            "depth": 6 * n + 2,
            "residual": residual,
            "params": int(params),
            "test_acc": final["test_acc"],
            "train_acc": final["train_acc"],
            "test_loss": final["test_loss"],
            "train_loss": final["train_loss"],
            "best_test_acc": max(r["test_acc"] for r in rows),
            "train_seconds": final["seconds"],
            "source": f"training/resnet_cifar10/{name}.csv",
        }
        (OUT / f"{name}.json").write_text(json.dumps(result, indent=1))

        if name == "resnet-56":
            net = net.float().cpu().eval().to(memory_format=torch.contiguous_format)
            onnx_path = OUT / "resnet-56.onnx"
            torch.onnx.export(
                Exported(net),
                torch.zeros(1, 3, 32, 32),
                str(onnx_path),
                input_names=["image"],
                output_names=["probs", "cam"],
                dynamic_axes={"image": {0: "n"}, "probs": {0: "n"}, "cam": {0: "n"}},
                opset_version=17,
                dynamo=False,
            )
            onnx_acc = C.onnx_accuracy(onnx_path, x_test_u8, y_test)
            meta = {
                "name": "ResNet-56",
                "classes": C.CLASSES,
                "config": cfg,
                "runs": list(RUNS),
                "onnx_test_acc": round(onnx_acc, 5),
                "onnx_bytes": onnx_path.stat().st_size,
                "hardware": C.hardware(),
                "commit": C.git_commit(),
                "command": "python training/resnet_cifar10/train.py",
            }
            (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
            print("onnx", onnx_acc)
        del net
        torch.cuda.empty_cache()


if __name__ == "__main__":
    main()
