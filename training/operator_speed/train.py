"""A browser-sized version of the Smart Operator Assistant's speed advisor.

    .venv/Scripts/python training/operator_speed/train.py

The hackathon app (github.com/Aditya17-bot/caterpillar) advises a safe speed for the terrain with a random forest
(11 MB, R^2 0.98 on its hold-out). That is too large for a web page, so this trains gradient-boosted trees on the
same synthetic data, read from the app's training CSV (data/speed_data.csv, written by its data/generate.py with
seed 42), using only the inputs the browser demo exposes: machine type, slope, surface, load and vibration.
The trees are written as plain arrays and evaluated in JavaScript.

Writes:
  public/projects/operator/speed_model.json
  training/operator_speed/log.txt
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

HERE = Path(__file__).parent
SITE = HERE.parent.parent
DATA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("C:/adi/hackathon/data/speed_data.csv")
OUT = SITE / "public" / "projects" / "operator"

MACHINES = ["excavator", "loader", "dozer"]
SURFACES = ["asphalt", "gravel", "sand", "mud"]
FEATURES = ["slope_deg", "load_pct", "vibration"] + [f"machine_{m}" for m in MACHINES] + [f"surface_{s}" for s in SURFACES]


def encode(df):
    X = df[["slope_deg", "load_pct", "vibration"]].astype(float).copy()
    for m in MACHINES:
        X[f"machine_{m}"] = (df.machine_type == m).astype(float)
    for s in SURFACES:
        X[f"surface_{s}"] = (df.surface == s).astype(float)
    return X[FEATURES].to_numpy()


def export_tree(t):
    tree = t.tree_
    return {
        "f": tree.feature.tolist(),
        "t": tree.threshold.tolist(),
        "l": tree.children_left.tolist(),
        "r": tree.children_right.tolist(),
        "v": [float(v[0][0]) for v in tree.value],
    }


def main():
    df = pd.read_csv(DATA)
    X, y = encode(df), df.optimal_speed_kmh.to_numpy()
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)
    params = dict(n_estimators=200, max_depth=4, learning_rate=0.08, subsample=0.9, random_state=0)
    model = GradientBoostingRegressor(**params).fit(Xtr, ytr)
    pred = model.predict(Xte)
    r2, mae = r2_score(yte, pred), mean_absolute_error(yte, pred)
    print(f"rows {len(df):,}; hold-out R^2 {r2:.4f}, MAE {mae:.3f} km/h", flush=True)

    final = GradientBoostingRegressor(**params).fit(X, y)
    # The JavaScript evaluator must reproduce sklearn exactly.
    trees = [export_tree(e[0]) for e in final.estimators_]
    init = float(final.init_.constant_.ravel()[0]) if hasattr(final.init_, "constant_") else float(np.mean(y))

    def js_like(x):
        # sklearn compares float32 features against float64 thresholds; the browser uses Math.fround to match.
        x = np.asarray(x, dtype=np.float32).astype(np.float64).tolist()
        s = init
        for tr in trees:
            n = 0
            while tr["l"][n] != -1:
                n = tr["l"][n] if x[tr["f"][n]] <= tr["t"][n] else tr["r"][n]
            s += params["learning_rate"] * tr["v"][n]
        return s

    probe = X[:500]
    diff = max(abs(js_like(x) - p) for x, p in zip(probe, final.predict(probe)))
    assert diff < 1e-3, diff

    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=SITE, capture_output=True, text=True).stdout.strip()
    OUT.mkdir(parents=True, exist_ok=True)
    out = {
        "features": FEATURES,
        "init": init,
        "learning_rate": params["learning_rate"],
        "trees": trees,
        "metrics": {"r2": round(r2, 4), "mae_kmh": round(mae, 3), "rows": int(len(df)), "holdout": 0.2},
        "original": {"model": "RandomForestRegressor", "r2": 0.9819, "mae_kmh": 0.614},
        "commit": commit,
    }
    path = OUT / "speed_model.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB), max export diff {diff:.2e}")


if __name__ == "__main__":
    main()
