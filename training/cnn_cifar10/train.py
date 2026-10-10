"""Train a VGG-style CNN on CIFAR-10 and export it to ONNX with class activation maps.

    .venv/Scripts/python training/cnn_cifar10/train.py

The head is global average pooling + one linear layer, so the class activation map (Zhou et al. 2016)
is exact: cam_c = sum_k w_ck * A_k over the last feature maps. It is computed inside the exported graph.

Writes:
  training/cnn_cifar10/log.csv
  public/models/cnn-cifar10/model.onnx    inputs image [N,3,32,32] in [0,1]; outputs probs [N,10], cam [N,10,8,8]
  public/models/cnn-cifar10/samples.bin   120 test images, uint8 CHW
  public/models/cnn-cifar10/meta.json
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

OUT = C.SITE / "public" / "models" / "cnn-cifar10"

CONFIG = {"epochs": 40, "batch_size": 128, "max_lr": 0.1, "weight_decay": 5e-4, "seed": 0}


def block(c_in, c_out):
    return nn.Sequential(nn.Conv2d(c_in, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out), nn.ReLU(inplace=True))


class CifarCNN(nn.Module):
    """32 -> (32, 32) pool -> 16 -> (64, 64) pool -> 8 -> (128, 128) -> global average pool -> 10."""

    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            block(3, 32), block(32, 32), nn.MaxPool2d(2),
            block(32, 64), block(64, 64), nn.MaxPool2d(2),
            block(64, 128), block(128, 128),
        )
        self.fc = nn.Linear(128, 10)

    def forward(self, x, cam=False):
        a = self.features(C.normalise(x))
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


def main():
    cfg = CONFIG
    torch.manual_seed(cfg["seed"])
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.backends.cudnn.benchmark = True
    xtr, ytr, xte, yte, (x_test_u8, y_test) = C.to_device(dev)

    net = CifarCNN().to(dev).to(memory_format=torch.channels_last)
    params = sum(p.numel() for p in net.parameters())
    rows = C.fit(net, (xtr, ytr, xte, yte), cfg, HERE / "log.csv")

    OUT.mkdir(parents=True, exist_ok=True)
    net = net.float().cpu().eval().to(memory_format=torch.contiguous_format)
    onnx_path = OUT / "model.onnx"
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
    labels, indices = C.write_samples(OUT / "samples.bin", x_test_u8, y_test)

    final = rows[-1]
    meta = {
        "name": "CNN on CIFAR-10",
        "params": int(params),
        "classes": C.CLASSES,
        "config": cfg,
        "results": {
            "test_acc": final["test_acc"],
            "test_loss": final["test_loss"],
            "train_acc": final["train_acc"],
            "onnx_test_acc": round(onnx_acc, 5),
            "train_seconds": final["seconds"],
        },
        "source": "training/cnn_cifar10/log.csv",
        "hardware": C.hardware(),
        "commit": C.git_commit(),
        "command": "python training/cnn_cifar10/train.py",
        "onnx_bytes": onnx_path.stat().st_size,
        "samples": {"count": len(labels), "labels": labels, "test_indices": indices},
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta["results"], indent=1), params)


if __name__ == "__main__":
    main()
