"""MNIST loader shared by the training scripts. Downloads the four IDX files once."""

import gzip
import hashlib
import urllib.request
from pathlib import Path

import numpy as np

DATA = Path(__file__).parent / "data" / "mnist"
MIRROR = "https://ossci-datasets.s3.amazonaws.com/mnist/"
FILES = {
    "train_x": ("train-images-idx3-ubyte.gz", "f68b3c2dcbeaaa9fbdd348bbdeb94873"),
    "train_y": ("train-labels-idx1-ubyte.gz", "d53e105ee54ea40749a09fcbcd1e9432"),
    "test_x": ("t10k-images-idx3-ubyte.gz", "9fb629c4189551a2d022fa330f9573f3"),
    "test_y": ("t10k-labels-idx1-ubyte.gz", "ec29112dd5afa0611ce80d1b7f02629c"),
}


def _fetch(name: str, md5: str) -> Path:
    DATA.mkdir(parents=True, exist_ok=True)
    path = DATA / name
    if not path.exists():
        print(f"downloading {name}")
        urllib.request.urlretrieve(MIRROR + name, path)
    digest = hashlib.md5(path.read_bytes()).hexdigest()
    if digest != md5:
        path.unlink()
        raise RuntimeError(f"{name}: md5 {digest} != {md5}")
    return path


def _read(path: Path, offset: int) -> np.ndarray:
    with gzip.open(path, "rb") as f:
        return np.frombuffer(f.read(), dtype=np.uint8, offset=offset)


def load():
    """Returns (x_train, y_train, x_test, y_test); images are uint8 [N, 28, 28]."""
    p = {k: _fetch(*v) for k, v in FILES.items()}
    x_train = _read(p["train_x"], 16).reshape(-1, 28, 28)
    y_train = _read(p["train_y"], 8).astype(np.int64)
    x_test = _read(p["test_x"], 16).reshape(-1, 28, 28)
    y_test = _read(p["test_y"], 8).astype(np.int64)
    assert x_train.shape == (60000, 28, 28) and x_test.shape == (10000, 28, 28)
    return x_train, y_train, x_test, y_test
