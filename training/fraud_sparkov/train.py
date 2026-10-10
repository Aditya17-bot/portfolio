"""Credit card fraud: a random forest and an isolation forest, scored on a later, unseen period.

    .venv/Scripts/python training/fraud_sparkov/train.py

A clean rebuild of my 2025 fraud notebook (github.com/Aditya17-bot/Fraud_detection).

Data: "Credit Card Transactions Fraud Detection Dataset" (Kaggle, kartik2112, CC0), simulated with
Sparkov: 1,000 cards, 800 merchants, 2019-01-01 to 2020-12-31. Download it with
    kaggle datasets download kartik2112/fraud-detection -p training/data/sparkov --unzip

Split by time, as the files come: fraudTrain.csv (to 2020-06-21) to fit, fraudTest.csv (after) to test.
The last three months of fraudTrain are held out to pick the reported operating threshold; the test
period is never used to choose anything.

Features use only what is known when the transaction happens: amount, category, hour, weekday, age,
distance to the merchant, city population, and the card's own history up to (not including) this
transaction: time since its last transaction, count and spend over the previous 24 hours, and the
amount relative to the card's average so far.

Writes:
  public/projects/fraud/curves.json   alerts, frauds caught and fraud dollars caught at each alert budget
  training/fraud_sparkov/log.txt      the printed run
"""

import json
import platform
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import average_precision_score, roc_auc_score

HERE = Path(__file__).parent
SITE = HERE.parent.parent
DATA = HERE.parent / "data" / "sparkov"
OUT = SITE / "public" / "projects" / "fraud"
SEED = 0
VAL_FROM = "2020-03-21"  # last three months of the training file

FEATURES = [
    "log_amt",
    "category",
    "hour",
    "weekday",
    "age",
    "distance_km",
    "log_city_pop",
    "gender",
    "log_since_last",
    "count_24h",
    "log_spend_24h",
    "amt_vs_card_mean",
]


def log(*a):
    print(*a, flush=True)


def git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=SITE, text=True).strip()
    except Exception:
        return "unknown"


def features(df):
    df = df.sort_values(["cc_num", "ts"], kind="stable").reset_index(drop=True)
    out = pd.DataFrame(index=df.index)
    out["log_amt"] = np.log1p(df.amt)
    out["category"] = df.category.astype("category").cat.codes
    out["hour"] = df.ts.dt.hour
    out["weekday"] = df.ts.dt.dayofweek
    out["age"] = (df.ts - df.dob).dt.days / 365.25
    lat1, lon1, lat2, lon2 = (np.radians(df[c]) for c in ("lat", "long", "merch_lat", "merch_long"))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    out["distance_km"] = 6371 * 2 * np.arcsin(np.sqrt(a))
    out["log_city_pop"] = np.log1p(df.city_pop)
    out["gender"] = (df.gender == "F").astype(int)

    card = df.groupby("cc_num", sort=False)
    since = (df.ts - card.ts.shift()).dt.total_seconds()
    out["log_since_last"] = np.log1p(since.fillna(30 * 86400))
    # Previous 24 hours on the same card, excluding this transaction.
    roll = df.set_index("ts").groupby("cc_num", sort=False).amt.rolling("24h", closed="left")
    out["count_24h"] = roll.count().fillna(0).to_numpy()
    out["log_spend_24h"] = np.log1p(roll.sum().fillna(0).to_numpy())
    prev_n = card.cumcount()
    prev_sum = card.amt.cumsum() - df.amt
    mean = (prev_sum / prev_n.replace(0, np.nan)).fillna(df.amt)
    out["amt_vs_card_mean"] = np.log(df.amt / mean)
    return df, out[FEATURES].to_numpy(np.float32)


def curve(score, y, amt, rates):
    """Alert on the transactions scoring >= the score at each budget; count what is caught."""
    order = np.argsort(-score, kind="stable")
    s, yy, aa = score[order], y[order], amt[order]
    caught, dollars = np.cumsum(yy), np.cumsum(aa * yy)
    rows = []
    for r in rates:
        k = max(1, int(round(r * len(s))))
        # Ties: everything with the same score as the k-th transaction is alerted too.
        k = int(np.searchsorted(-s, -s[k - 1], side="right"))
        rows.append([k, int(caught[k - 1]), round(float(dollars[k - 1]), 2), float(s[k - 1])])
    return rows


def at_threshold(score, y, t):
    pred = score >= t
    tp = int((pred & (y == 1)).sum())
    fp = int((pred & (y == 0)).sum())
    fn = int((~pred & (y == 1)).sum())
    p = tp / max(tp + fp, 1)
    r = tp / max(tp + fn, 1)
    return {"tp": tp, "fp": fp, "fn": fn, "precision": p, "recall": r, "f1": 2 * p * r / max(p + r, 1e-12)}


def best_f1_threshold(score, y):
    order = np.argsort(-score, kind="stable")
    s, yy = score[order], y[order]
    tp = np.cumsum(yy)
    k = np.arange(1, len(s) + 1)
    last = np.r_[s[1:] != s[:-1], True]  # only cut between distinct scores
    f1 = np.where(last, 2 * tp / (k + yy.sum()), -1)
    i = int(np.argmax(f1))
    return float(s[i])


def main():
    t0 = time.time()
    cols = ["trans_date_trans_time", "cc_num", "category", "amt", "gender", "lat", "long", "city_pop",
            "dob", "merch_lat", "merch_long", "is_fraud"]
    parts = []
    for name in ("fraudTrain.csv", "fraudTest.csv"):
        d = pd.read_csv(DATA / name, usecols=cols)
        d["file"] = name
        parts.append(d)
    df = pd.concat(parts, ignore_index=True)
    df["ts"] = pd.to_datetime(df.trans_date_trans_time)
    df["dob"] = pd.to_datetime(df.dob)
    log(f"rows {len(df):,}, fraud {df.is_fraud.sum():,} ({100 * df.is_fraud.mean():.3f}%)")

    # Card history runs across both files: a test transaction may look back into the training period.
    df, X = features(df)
    y = df.is_fraud.to_numpy()
    amt = df.amt.to_numpy()
    test = (df.file == "fraudTest.csv").to_numpy()
    val = ~test & (df.ts >= VAL_FROM).to_numpy()
    fit = ~test & ~val
    for name, m in (("fit", fit), ("validation", val), ("test", test)):
        log(f"{name}: {m.sum():,} rows, {y[m].sum():,} fraud, {df.ts[m].min():%Y-%m-%d} to {df.ts[m].max():%Y-%m-%d}")
    log(f"features in {time.time() - t0:.0f} s")

    t1 = time.time()
    rf = RandomForestClassifier(
        n_estimators=300, min_samples_leaf=2, max_features="sqrt", class_weight="balanced_subsample",
        n_jobs=-1, random_state=SEED,
    ).fit(X[fit], y[fit])
    rf_seconds = time.time() - t1
    t1 = time.time()
    iso = IsolationForest(n_estimators=300, max_samples=4096, random_state=SEED, n_jobs=-1).fit(X[fit])
    iso_seconds = time.time() - t1
    log(f"random forest {rf_seconds:.0f} s, isolation forest {iso_seconds:.0f} s")

    scores = {
        "random_forest": lambda m: rf.predict_proba(X[m])[:, 1],
        "isolation_forest": lambda m: -iso.score_samples(X[m]),
    }
    n_test = int(test.sum())
    # Alert budgets from 0.01% to 100% of test transactions, denser where fraud lives.
    rates = np.unique(np.r_[np.geomspace(1e-4, 0.05, 160), np.linspace(0.05, 1, 40)])
    models = {}
    for name, score in scores.items():
        sv, st = score(val), score(test)
        t = best_f1_threshold(sv, y[val])
        op = at_threshold(st, y[test], t)
        models[name] = {
            "pr_auc": float(average_precision_score(y[test], st)),
            "roc_auc": float(roc_auc_score(y[test], st)),
            "threshold": t,
            "threshold_alerts": int((st >= t).sum()),
            "at_threshold": op,
            "curve": curve(st, y[test], amt[test], rates),
        }
        log(f"{name}: PR-AUC {models[name]['pr_auc']:.4f}  ROC-AUC {models[name]['roc_auc']:.4f}  "
            f"val-F1 threshold {t:.4f} -> test precision {op['precision']:.3f} recall {op['recall']:.3f} "
            f"F1 {op['f1']:.3f} (TP {op['tp']} FP {op['fp']} FN {op['fn']})")

    importance = sorted(zip(FEATURES, rf.feature_importances_.tolist()), key=lambda p: -p[1])
    log("importance: " + ", ".join(f"{k} {v:.3f}" for k, v in importance))

    OUT.mkdir(parents=True, exist_ok=True)
    result = {
        "data": {
            "name": "Credit Card Transactions Fraud Detection Dataset (simulated with Sparkov)",
            "url": "https://www.kaggle.com/datasets/kartik2112/fraud-detection",
            "license": "CC0 1.0",
            "fit": [f"{df.ts[fit].min():%Y-%m-%d}", f"{df.ts[fit].max():%Y-%m-%d}"],
            "validation": [f"{df.ts[val].min():%Y-%m-%d}", f"{df.ts[val].max():%Y-%m-%d}"],
            "test": [f"{df.ts[test].min():%Y-%m-%d}", f"{df.ts[test].max():%Y-%m-%d}"],
            "fit_rows": int(fit.sum()),
            "fit_fraud": int(y[fit].sum()),
            "test_rows": n_test,
            "test_fraud": int(y[test].sum()),
            "test_fraud_dollars": round(float((amt[test] * y[test]).sum()), 2),
        },
        "features": FEATURES,
        "importance": importance,
        "models": models,
        "curve_columns": ["alerts", "frauds_caught", "fraud_dollars_caught", "score_at_cut"],
        "seconds": {"random_forest": rf_seconds, "isolation_forest": iso_seconds},
        "hardware": f"{platform.processor() or platform.machine()}, CPU, scikit-learn {sklearn.__version__}",
        "commit": git_commit(),
        "command": "python training/fraud_sparkov/train.py",
    }
    (OUT / "curves.json").write_text(json.dumps(result, separators=(",", ":")))
    log(f"wrote {OUT / 'curves.json'} ({(OUT / 'curves.json').stat().st_size / 1024:.0f} KB), total {time.time() - t0:.0f} s")


if __name__ == "__main__":
    sys.exit(main())
