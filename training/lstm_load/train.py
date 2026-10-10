"""Forecast Delhi's electricity demand one hour ahead with an LSTM, and export it to ONNX.

    .venv/Scripts/python training/lstm_load/train.py

Data: "Delhi 5-Minute Electricity Demand for Forecasting" (Kaggle, yug201, CC BY 4.0), 5-minute load
and weather, 2021-01-01 to 2024-12-12. Download it with
    kaggle datasets download yug201/delhi-5-minute-electricity-demand-for-forecasting -p training/data/delhi --unzip
The file labels demand in kW, but the values (1,300 to 8,600) are Delhi's demand in MW.

Task: from the previous 24 hours (288 steps) of load, temperature, humidity, time of day, day of week
and sun elevation, predict the next hour (12 steps). Train on 2021-2023, test on 2024: a time split,
so nothing from the test year leaks into training. Gaps up to one hour are interpolated; windows that
touch a longer gap are skipped.

Writes:
  training/lstm_load/log.csv
  public/models/lstm-load/model.onnx    x [N,288,8] raw features -> load [N,12] in MW
  public/models/lstm-load/days.bin      48 h of raw features for each demo day (float32)
  public/models/lstm-load/meta.json
"""

import csv
import datetime as dt
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from cifar10 import git_commit, hardware  # noqa: E402

SITE = HERE.parent.parent
OUT = SITE / "public" / "models" / "lstm-load"
DATA = HERE.parent / "data" / "delhi" / "powerdemand_5min_2021_to_2024_with weather.csv"
STEP = 300  # seconds
CONFIG = {
    "context": 288,
    "horizon": 12,
    "hidden": 128,
    "layers": 2,
    "epochs": 12,
    "batch_size": 512,
    "lr": 2e-3,
    "origin_stride_train": 3,
    "max_interp_steps": 12,
    "test_from": "2024-01-01",
    "seed": 0,
    "demo_days": 24,
}
FEATURES = ["load_mw", "temp_c", "rhum_pct", "hour_sin", "hour_cos", "dow_sin", "dow_cos", "sun_elevation_sin"]
LAT, LON = 28.61, 77.21  # Delhi


def sun_elevation_sin(ts):
    """Sine of the sun's elevation at Delhi for local (IST) timestamps, clipped at 0 below the horizon.
    Standard declination and equation-of-time approximations; accurate to well under a degree."""
    days = np.array([dt.datetime.fromtimestamp(t, dt.timezone.utc).timetuple().tm_yday for t in ts], dtype=np.float64)
    hours = (ts % 86400) / 3600.0  # timestamps are naive IST stored as UTC, see load()
    decl = np.radians(23.44) * np.sin(2 * np.pi * (284 + days) / 365)
    b = 2 * np.pi * (days - 81) / 364
    eot = 9.87 * np.sin(2 * b) - 7.53 * np.cos(b) - 1.5 * np.sin(b)  # minutes
    solar = hours + ((LON - 82.5) * 4 + eot) / 60  # IST meridian is 82.5 E
    h = np.radians(15 * (solar - 12))
    lat = np.radians(LAT)
    s = np.sin(lat) * np.sin(decl) + np.cos(lat) * np.cos(decl) * np.cos(h)
    return np.clip(s, 0, None)


def load(cfg):
    """Read the CSV onto a full 5-minute grid. Returns timestamps, raw features [T,8], and a validity mask."""
    with open(DATA, encoding="utf-8", errors="replace") as f:
        rows = list(csv.reader(f))[1:]
    # Naive local timestamps, treated as UTC so day boundaries stay at local midnight.
    t = np.array([dt.datetime.fromisoformat(r[1]).replace(tzinfo=dt.timezone.utc).timestamp() for r in rows])
    vals = np.array([[float(r[2]), float(r[3]), float(r[5])] for r in rows])  # load, temp, rhum
    grid = np.arange(t[0], t[-1] + STEP, STEP)
    idx = np.round((t - t[0]) / STEP).astype(int)
    raw = np.full((len(grid), 3), np.nan)
    raw[idx] = vals
    known = ~np.isnan(raw[:, 0])
    # Interpolate gaps of at most max_interp_steps; longer gaps stay invalid.
    valid = known.copy()
    pos = np.flatnonzero(known)
    for a, b in zip(pos[:-1], pos[1:]):
        if 1 < b - a <= cfg["max_interp_steps"] + 1:
            w = (np.arange(a + 1, b) - a) / (b - a)
            raw[a + 1 : b] = raw[a] * (1 - w)[:, None] + raw[b] * w[:, None]
            valid[a + 1 : b] = True
    raw = np.nan_to_num(raw)
    hours = (grid % 86400) / 3600
    dow = ((grid // 86400 + 3) % 7).astype(np.float64)  # Monday = 0; 1970-01-01 was a Thursday
    feats = np.column_stack(
        [
            raw,
            np.sin(2 * np.pi * hours / 24),
            np.cos(2 * np.pi * hours / 24),
            np.sin(2 * np.pi * dow / 7),
            np.cos(2 * np.pi * dow / 7),
            sun_elevation_sin(grid),
        ]
    ).astype(np.float32)
    return grid, feats, valid


def origins(valid, lo, hi, cfg, stride):
    """Forecast origins o in [lo, hi): the 288 steps before o and the 12 after are all valid."""
    c, h = cfg["context"], cfg["horizon"]
    bad = np.concatenate([[0], np.cumsum(~valid)])
    o = np.arange(max(lo, c), min(hi, len(valid) - h), stride)
    return o[(bad[o + h] - bad[o - c]) == 0]


class Forecaster(nn.Module):
    def __init__(self, cfg, mean, std):
        super().__init__()
        self.register_buffer("mean", torch.tensor(mean, dtype=torch.float32))
        self.register_buffer("std", torch.tensor(std, dtype=torch.float32))
        self.lstm = nn.LSTM(len(FEATURES), cfg["hidden"], cfg["layers"], batch_first=True)
        self.head = nn.Linear(cfg["hidden"], cfg["horizon"])

    def forward(self, x):
        """x: raw features [N, T, 8]. Returns the next `horizon` loads in MW."""
        z = (x - self.mean) / self.std
        out, _ = self.lstm(z)
        # Predict the change from the last observed load, in normalised units.
        return (self.head(out[:, -1]) + z[:, -1:, 0]) * self.std[0] + self.mean[0]


def mape(pred, true):
    return float(np.mean(np.abs(pred - true) / true) * 100)


def main():
    cfg = CONFIG
    torch.manual_seed(cfg["seed"])
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    grid, feats, valid = load(cfg)
    split = int(np.searchsorted(grid, dt.datetime.fromisoformat(cfg["test_from"]).replace(tzinfo=dt.timezone.utc).timestamp()))
    tr_o = origins(valid, 0, split, cfg, cfg["origin_stride_train"])
    te_o = origins(valid, split, len(grid), cfg, 12)  # hourly origins over the test year
    mean = feats[:split][valid[:split]].mean(0)
    std = feats[:split][valid[:split]].std(0) + 1e-6
    c, h = cfg["context"], cfg["horizon"]

    X = torch.tensor(feats, device=dev)
    offs_in = torch.arange(-c, 0, device=dev)
    offs_out = torch.arange(0, h, device=dev)

    def batch(o):
        o = torch.as_tensor(o, device=dev)
        return X[o[:, None] + offs_in], X[o[:, None] + offs_out, 0]

    net = Forecaster(cfg, mean, std).to(dev)
    params = sum(p.numel() for p in net.parameters())
    opt = torch.optim.AdamW(net.parameters(), lr=cfg["lr"], weight_decay=1e-4)
    steps = int(np.ceil(len(tr_o) / cfg["batch_size"]))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=cfg["lr"], epochs=cfg["epochs"], steps_per_epoch=steps)
    rng = np.random.default_rng(cfg["seed"])

    @torch.no_grad()
    def evaluate(o):
        net.eval()
        preds = []
        for i in range(0, len(o), 2048):
            preds.append(net(batch(o[i : i + 2048])[0]).cpu().numpy())
        net.train()
        return np.concatenate(preds)

    true_te = feats[te_o[:, None] + np.arange(h), 0]
    rows = []
    t0 = time.time()
    for epoch in range(1, cfg["epochs"] + 1):
        order = rng.permutation(tr_o)
        tot = 0.0
        for i in range(0, len(order), cfg["batch_size"]):
            xb, yb = batch(order[i : i + cfg["batch_size"]])
            loss = ((net(xb) - yb) / net.std[0]).pow(2).mean()
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(net.parameters(), 1.0)
            opt.step()
            sched.step()
            tot += loss.item() * len(xb)
        pred = evaluate(te_o)
        row = {
            "epoch": epoch,
            "train_mse_norm": round(tot / len(order), 6),
            "test_mape": round(mape(pred, true_te), 4),
            "test_mae_mw": round(float(np.abs(pred - true_te).mean()), 3),
            "seconds": round(time.time() - t0, 1),
        }
        rows.append(row)
        print(row, flush=True)

    with open(HERE / "log.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    # Baselines on exactly the same origins and horizons.
    persistence = np.repeat(feats[te_o - 1, 0][:, None], h, axis=1)
    yesterday = feats[te_o[:, None] + np.arange(h) - 288, 0]
    pred = evaluate(te_o)
    per_h = [round(mape(pred[:, k], true_te[:, k]), 4) for k in range(h)]

    OUT.mkdir(parents=True, exist_ok=True)
    net = net.cpu().eval()
    torch.save(net.state_dict(), HERE / "model.pt")
    onnx_path = OUT / "model.onnx"
    torch.onnx.export(
        net, torch.zeros(1, c, len(FEATURES)), str(onnx_path), input_names=["x"], output_names=["load"],
        dynamic_axes={"x": {0: "n"}, "load": {0: "n"}}, opset_version=17, dynamo=False,
    )
    import onnxruntime as ort

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    probe = feats[te_o[:256, None] + np.arange(-c, 0)]
    onnx_pred = sess.run(["load"], {"x": probe})[0]
    max_diff = float(np.abs(onnx_pred - pred[:256]).max())
    assert max_diff < 0.05, max_diff  # MW

    # Demo days: complete test days (midnight to midnight) with a complete previous day, spread over the year.
    day0 = split + int((86400 - (grid[split] % 86400)) // STEP) % 288  # first local midnight in the test range
    starts = [s for s in range(day0 + 288, len(grid) - 288, 288) if valid[s - 288 : s + 288].all()]
    pick = [starts[int(i)] for i in np.linspace(0, len(starts) - 1, cfg["demo_days"])]
    (OUT / "days.bin").write_bytes(np.concatenate([feats[s - 288 : s + 288] for s in pick]).astype(np.float32).tobytes())
    dates = [dt.datetime.fromtimestamp(grid[s], dt.timezone.utc).strftime("%Y-%m-%d") for s in pick]

    final = rows[-1]
    meta = {
        "name": "LSTM forecaster",
        "params": int(params),
        "features": FEATURES,
        "config": cfg,
        "results": {
            "test_mape": final["test_mape"],
            "test_mae_mw": final["test_mae_mw"],
            "test_mape_by_horizon": per_h,
            "persistence_mape": round(mape(persistence, true_te), 4),
            "yesterday_mape": round(mape(yesterday, true_te), 4),
            "test_origins": int(len(te_o)),
            "train_origins": int(len(tr_o)),
            "train_seconds": final["seconds"],
            "onnx_max_abs_diff_mw": max_diff,
        },
        "demo": {"dates": dates, "steps_per_day": 288},
        "data": {
            "name": "Delhi 5-Minute Electricity Demand for Forecasting",
            "url": "https://www.kaggle.com/datasets/yug201/delhi-5-minute-electricity-demand-for-forecasting",
            "license": "CC BY 4.0",
            "range": [
                dt.datetime.fromtimestamp(grid[0], dt.timezone.utc).strftime("%Y-%m-%d"),
                dt.datetime.fromtimestamp(grid[-1], dt.timezone.utc).strftime("%Y-%m-%d"),
            ],
        },
        "source": "training/lstm_load/log.csv",
        "hardware": hardware(),
        "commit": git_commit(),
        "command": "python training/lstm_load/train.py",
        "onnx_bytes": onnx_path.stat().st_size,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta["results"], indent=1), params, dates[:3])


if __name__ == "__main__":
    main()
