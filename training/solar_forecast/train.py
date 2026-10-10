"""Does a solar proxy help forecast Delhi's demand? Tabular models with and without it, against the LSTM.

    .venv/Scripts/python training/solar_forecast/train.py

The idea of my SIPCOV-2026 paper, rerun on public data: rooftop solar is not metered, but the sun's
position is known in advance, so it can stand in for when solar lowers the demand the grid sees.
The paper's data and code are not public; this uses the same Delhi 5-minute dataset as the LSTM page
(Kaggle, yug201, CC BY 4.0), the same grid, gap handling, test year and forecast origins, so every
number here is comparable with training/lstm_load.

Task: at origin o, with load and weather known up to o-1, forecast load at o..o+11 (5 to 60 minutes).
Features use only the 24 hours before o (what the LSTM sees) plus the calendar at the target time.
The "solar" group adds the sun's elevation at the target time and its change since the last reading.

Models: persistence, same time yesterday, ridge regression and LightGBM (one per horizon, each with
and without the solar group), and the LSTM from training/lstm_load run through its ONNX export.
LightGBM's tree count is chosen by early stopping on 2023; the 2024 test year chooses nothing.

Writes:
  public/projects/solar/explorer.json   results table, error by hour of day, 24 demo days
  training/solar_forecast/log.txt       the printed run
"""

import datetime as dt
import json
import platform
import sys
import time
from pathlib import Path

import lightgbm as lgb
import numpy as np
import onnxruntime as ort
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).parent
SITE = HERE.parent.parent
sys.path.insert(0, str(HERE.parent / "lstm_load"))
sys.path.insert(0, str(HERE.parent))
from cifar10 import git_commit  # noqa: E402
from train import CONFIG, load, mape, origins  # noqa: E402  (training/lstm_load/train.py)

OUT = SITE / "public" / "projects" / "solar"
LSTM = SITE / "public" / "models" / "lstm-load"
H = CONFIG["horizon"]
DAY = 288
LGB = {
    "n_estimators": 3000,
    "learning_rate": 0.05,
    "num_leaves": 63,
    "min_child_samples": 50,
    "subsample": 0.8,
    "subsample_freq": 1,
    "colsample_bytree": 0.8,
    "reg_lambda": 1.0,
    "random_state": 0,
    "verbose": -1,
}
VAL_FROM = "2023-01-01"
BASE = [
    "last", "d1", "d2", "d5", "d11", "d23", "d47", "mean_1h", "mean_24h",
    "yday_target", "yday_change", "temp", "rhum", "temp_change_1h",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos", "doy_sin", "doy_cos",
]
SOLAR = ["sun_target", "sun_change"]


def ts_index(grid, day):
    return int(np.searchsorted(grid, dt.datetime.fromisoformat(day).replace(tzinfo=dt.timezone.utc).timestamp()))


def make_features(feats, grid, o, j):
    """Features for target o+j, using load and weather up to o-1. Returns (X with BASE+SOLAR columns, last)."""
    L = feats[:, 0]
    last = L[o - 1]
    win = np.cumsum(np.r_[0, L])
    cols = {"last": last}
    for k in (1, 2, 5, 11, 23, 47):
        cols[f"d{k}"] = L[o - 1 - k] - last
    cols["mean_1h"] = (win[o] - win[o - 12]) / 12 - last
    cols["mean_24h"] = (win[o] - win[o - DAY]) / DAY - last
    cols["yday_target"] = L[o + j - DAY] - last
    cols["yday_change"] = L[o + j - DAY] - L[o - 1 - DAY]
    cols["temp"] = feats[o - 1, 1]
    cols["rhum"] = feats[o - 1, 2]
    cols["temp_change_1h"] = feats[o - 1, 1] - feats[o - 13, 1]
    t = o + j
    for name, c in (("hour_sin", 3), ("hour_cos", 4), ("dow_sin", 5), ("dow_cos", 6)):
        cols[name] = feats[t, c]
    doy = np.array([dt.datetime.fromtimestamp(g, dt.timezone.utc).timetuple().tm_yday for g in grid[t]])
    cols["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    cols["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)
    cols["sun_target"] = feats[t, 7]
    cols["sun_change"] = feats[t, 7] - feats[o - 1, 7]
    X = np.column_stack([cols[k] for k in BASE + SOLAR]).astype(np.float32)
    return X, last


def main():
    t0 = time.time()
    cfg = CONFIG
    grid, feats, valid = load(cfg)
    split = ts_index(grid, cfg["test_from"])
    val_at = ts_index(grid, VAL_FROM)
    tr_o = origins(valid, 0, split, cfg, cfg["origin_stride_train"])
    te_o = origins(valid, split, len(grid), cfg, 12)  # the LSTM page's 4,088 hourly test origins
    dense_o = origins(valid, split, len(grid), cfg, 3)  # every 15 minutes, for error by hour of day
    print(f"train origins {len(tr_o):,}, test origins {len(te_o):,}, dense test origins {len(dense_o):,}", flush=True)

    # Demo days: 24 complete test days spread over the year, each forecast at every 5-minute step,
    # 60 minutes ahead. A day qualifies when every one of those 288 forecast windows is valid.
    lstm_meta = json.loads((LSTM / "meta.json").read_text())
    ok = np.zeros(len(grid), bool)
    ok[origins(valid, 0, len(grid), cfg, 1)] = True
    day0 = split + int((86400 - (grid[split] % 86400)) // 300) % DAY  # first local midnight in the test year
    starts = [s for s in range(day0, len(grid) - DAY, DAY) if ok[s - (H - 1) : s + DAY - (H - 1)].all()]
    starts = [starts[int(i)] for i in np.linspace(0, len(starts) - 1, 24)]
    dates = [dt.datetime.fromtimestamp(grid[s], dt.timezone.utc).strftime("%Y-%m-%d") for s in starts]
    demo_t = np.concatenate([np.arange(s, s + DAY) for s in starts])
    demo_o = demo_t - (H - 1)
    assert ok[demo_o].all()
    print(f"demo days: {len(dates)} from {dates[0]} to {dates[-1]}", flush=True)

    sets = {"test": te_o, "dense": dense_o, "demo": demo_o}
    n_cols = {"base": len(BASE), "solar": len(BASE) + len(SOLAR)}
    pred = {f"{m}_{v}": {k: np.zeros((len(o), H)) for k, o in sets.items()} for m in ("ridge", "lgbm") for v in n_cols}
    best_iters = {v: [] for v in n_cols}
    importance = None
    fit_lo = tr_o < val_at
    for j in range(H):
        Xtr, last_tr = make_features(feats, grid, tr_o, j)
        ytr = feats[tr_o + j, 0] - last_tr
        evals = {k: make_features(feats, grid, o, j) for k, o in sets.items()}
        for v, n in n_cols.items():
            sc = StandardScaler().fit(Xtr[:, :n])
            ridge = Ridge(alpha=1.0).fit(sc.transform(Xtr[:, :n]), ytr)
            probe = lgb.LGBMRegressor(**LGB).fit(
                Xtr[fit_lo, :n], ytr[fit_lo], eval_set=[(Xtr[~fit_lo, :n], ytr[~fit_lo])],
                callbacks=[lgb.early_stopping(100, verbose=False)],
            )
            it = int(probe.best_iteration_)
            best_iters[v].append(it)
            gbm = lgb.LGBMRegressor(**{**LGB, "n_estimators": it}).fit(Xtr[:, :n], ytr)
            for k, (X, last) in evals.items():
                pred[f"ridge_{v}"][k][:, j] = ridge.predict(sc.transform(X[:, :n])) + last
                pred[f"lgbm_{v}"][k][:, j] = gbm.predict(X[:, :n]) + last
            if v == "solar" and j == H - 1:
                gain = gbm.booster_.feature_importance("gain")
                importance = sorted(zip(BASE + SOLAR, (gain / gain.sum()).tolist()), key=lambda p: -p[1])
        print(f"horizon {5 * (j + 1)} min: trees base {best_iters['base'][-1]}, solar {best_iters['solar'][-1]} "
              f"({time.time() - t0:.0f} s)", flush=True)

    # The LSTM, through the same ONNX file the browser runs.
    sess = ort.InferenceSession(str(LSTM / "model.onnx"), providers=["CPUExecutionProvider"])
    ctx = np.arange(-cfg["context"], 0)
    pred["lstm"] = {}
    for k, o in sets.items():
        out = [sess.run(["load"], {"x": feats[o[i : i + 1024, None] + ctx]})[0] for i in range(0, len(o), 1024)]
        pred["lstm"][k] = np.concatenate(out)
    for k, o in sets.items():
        last = feats[o - 1, 0]
        pred.setdefault("persistence", {})[k] = np.repeat(last[:, None], H, axis=1)
        pred.setdefault("yesterday", {})[k] = feats[o[:, None] + np.arange(H) - DAY, 0]

    true = {k: feats[o[:, None] + np.arange(H), 0] for k, o in sets.items()}
    lstm_check = mape(pred["lstm"]["test"], true["test"])
    assert abs(lstm_check - lstm_meta["results"]["test_mape"]) < 0.01, (lstm_check, lstm_meta["results"]["test_mape"])

    table = {}
    for name, p in pred.items():
        err = np.abs(p["test"] - true["test"]) / true["test"] * 100
        table[name] = {
            "mape": round(float(err.mean()), 4),
            "mape_60": round(float(err[:, -1].mean()), 4),
            "mae_mw": round(float(np.abs(p["test"] - true["test"]).mean()), 2),
        }
        print(f"{name:14s} MAPE {table[name]['mape']:.3f}%  at 60 min {table[name]['mape_60']:.3f}%  "
              f"MAE {table[name]['mae_mw']:.1f} MW", flush=True)

    # 60-minute-ahead error by the target's hour of day, over the dense test origins.
    hour = ((grid[dense_o + H - 1] % 86400) // 3600).astype(int)
    by_hour = {}
    for name, p in pred.items():
        err = np.abs(p["dense"][:, -1] - true["dense"][:, -1]) / true["dense"][:, -1] * 100
        by_hour[name] = [round(float(err[hour == h].mean()), 4) for h in range(24)]
    sun_by_hour = [round(float(feats[dense_o + H - 1, 7][hour == h].mean()), 4) for h in range(24)]
    load_by_hour = [round(float(true["dense"][:, -1][hour == h].mean()), 1) for h in range(24)]

    keep = ["lgbm_solar", "lgbm_base", "ridge_solar", "lstm"]
    days = {
        "dates": dates,
        "actual": np.round(true["demo"][:, -1]).astype(int).reshape(len(dates), DAY).tolist(),
        "sun": np.round(feats[demo_t, 7], 3).reshape(len(dates), DAY).tolist(),
        "pred": {k: np.round(pred[k]["demo"][:, -1]).astype(int).reshape(len(dates), DAY).tolist() for k in keep},
    }

    OUT.mkdir(parents=True, exist_ok=True)
    result = {
        "table": table,
        "by_hour": by_hour,
        "sun_by_hour": sun_by_hour,
        "load_by_hour": load_by_hour,
        "days": days,
        "importance_lgbm_solar_60": importance,
        "best_iters": best_iters,
        "features": {"base": BASE, "solar": SOLAR},
        "config": {"lgbm": LGB, "ridge_alpha": 1.0, "validation_from": VAL_FROM, **{k: cfg[k] for k in ("context", "horizon", "test_from", "max_interp_steps", "origin_stride_train")}},
        "counts": {"train_origins": int(len(tr_o)), "test_origins": int(len(te_o)), "dense_origins": int(len(dense_o))},
        "data": lstm_meta["data"],
        "seconds": round(time.time() - t0, 1),
        "hardware": f"{platform.processor() or platform.machine()}, CPU, LightGBM {lgb.__version__}",
        "commit": git_commit(),
        "command": "python training/solar_forecast/train.py",
    }
    (OUT / "explorer.json").write_text(json.dumps(result, separators=(",", ":")))
    print("importance (gain, 60 min):", ", ".join(f"{k} {v:.3f}" for k, v in importance[:8]))
    print(f"wrote {OUT / 'explorer.json'} ({(OUT / 'explorer.json').stat().st_size / 1024:.0f} KB) in {result['seconds']:.0f} s")


if __name__ == "__main__":
    main()
