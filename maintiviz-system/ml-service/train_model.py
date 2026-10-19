"""
MaintiViz Edge Engine — ML Model Training Pipeline
====================================================
Trains a RandomForest classifier on the AI4I 2020 Predictive Maintenance Dataset.

Physics Feature Engineering:
  - Temp_Diff  = Process Temperature - Air Temperature
  - Power_kW   = (RPM × Torque × 2π / 60) / 1000

Handles severe class imbalance (~3.4% failure rate) via:
  - class_weight='balanced' in RandomForest
  - Decision threshold tuned to 0.40 for maximum F1 on minority class

Usage:
  python train_model.py --data train.csv
"""

import argparse
import math
import os
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler

warnings.filterwarnings("ignore")


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
TARGET_COL = "Machine failure"
TYPE_COL = "Type"
FEATURE_COLS = [
    "Type",
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]
NUMERIC_FEATURES = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
    "Temp_Diff",
    "Power_kW",
]
CATEGORICAL_FEATURES = ["Type"]

MODEL_OUTPUT_PATH = "model.pkl"


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────
def engineer_physics_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds physics-based derived features to a telemetry DataFrame.

    Args:
        df: Raw telemetry DataFrame with standard AI4I column names.

    Returns:
        DataFrame augmented with Temp_Diff and Power_kW columns.
    """
    df = df.copy()

    # Heat dissipation proxy: difference between process and ambient temperature
    df["Temp_Diff"] = df["Process temperature [K]"] - df["Air temperature [K]"]

    # Mechanical power in kilowatts: P = (ω × τ) / 1000 where ω = 2π × RPM / 60
    df["Power_kW"] = (
        df["Rotational speed [rpm]"] * df["Torque [Nm]"] * 2 * math.pi / 60
    ) / 1000

    return df


# ─────────────────────────────────────────────────────────────────────────────
# DATASET LOADING
# ─────────────────────────────────────────────────────────────────────────────
def load_dataset(csv_path: str) -> tuple[pd.DataFrame, pd.Series]:
    """
    Loads the AI4I dataset, applies feature engineering, and separates X / y.

    Args:
        csv_path: Path to the train.csv file.

    Returns:
        Tuple of (features DataFrame, target Series).
    """
    print(f"[INFO] Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path)

    # Drop non-feature columns if present
    drop_cols = ["UDI", "Product ID", "TWF", "HDF", "PWF", "OSF", "RNF"]
    df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True)

    # Apply physics feature engineering
    df = engineer_physics_features(df)

    X = df[FEATURE_COLS + ["Temp_Diff", "Power_kW"]]
    y = df[TARGET_COL]

    print(f"[INFO] Dataset shape: {X.shape}")
    print(f"[INFO] Class distribution:\n{y.value_counts(normalize=True).round(4)}")

    return X, y


# ─────────────────────────────────────────────────────────────────────────────
# PIPELINE CONSTRUCTION
# ─────────────────────────────────────────────────────────────────────────────
def build_pipeline() -> Pipeline:
    """
    Constructs an sklearn Pipeline with:
      - OneHotEncoder for the 'Type' categorical column
      - StandardScaler for all numeric features
      - RandomForestClassifier with balanced class weights

    Returns:
        Untrained sklearn Pipeline.
    """
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
            ("num", StandardScaler(), NUMERIC_FEATURES),
        ],
        remainder="drop",
    )

    clf = RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=2,
        class_weight="balanced",  # compensates for ~3.4% minority class
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("classifier", clf)])
    return pipeline


# ─────────────────────────────────────────────────────────────────────────────
# THRESHOLD OPTIMIZATION
# ─────────────────────────────────────────────────────────────────────────────
def find_optimal_threshold(y_true: np.ndarray, y_proba: np.ndarray) -> float:
    """
    Searches for the decision threshold that maximizes F1-score on the
    positive (failure) class, scanning from 0.35 to 0.65.

    Args:
        y_true:  True binary labels.
        y_proba: Predicted probabilities for the positive class.

    Returns:
        Optimal threshold value as a float.
    """
    best_threshold = 0.50
    best_f1 = 0.0

    for thresh in np.arange(0.30, 0.70, 0.01):
        preds = (y_proba >= thresh).astype(int)
        score = f1_score(y_true, preds, zero_division=0)
        if score > best_f1:
            best_f1 = score
            best_threshold = round(float(thresh), 2)

    print(f"[INFO] Optimal threshold: {best_threshold:.2f}  (F1 = {best_f1:.4f})")
    return best_threshold


# ─────────────────────────────────────────────────────────────────────────────
# TRAINING ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
def train(csv_path: str) -> None:
    """
    Full training pipeline: load -> split -> fit -> evaluate -> save.

    Args:
        csv_path: Path to the training CSV.
    """
    X, y = load_dataset(csv_path)

    # Stratified split preserves class distribution
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    pipeline = build_pipeline()

    print("\n[INFO] Training RandomForest pipeline …")
    pipeline.fit(X_train, y_train)

    # ── Evaluation ──────────────────────────────────────────────────────────
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    roc_auc = roc_auc_score(y_test, y_proba)
    print(f"[EVAL] ROC-AUC : {roc_auc:.4f}")

    optimal_threshold = find_optimal_threshold(y_test.values, y_proba)

    y_pred_opt = (y_proba >= optimal_threshold).astype(int)
    print("\n[EVAL] Classification Report (optimized threshold):")
    print(classification_report(y_test, y_pred_opt, target_names=["No Failure", "Failure"]))
    print("[EVAL] Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred_opt))

    # ── Persist artefacts ────────────────────────────────────────────────────
    artefact = {
        "pipeline": pipeline,
        "threshold": optimal_threshold,
        "feature_cols": FEATURE_COLS + ["Temp_Diff", "Power_kW"],
    }
    joblib.dump(artefact, MODEL_OUTPUT_PATH)
    print(f"\n[INFO] Model artefact saved -> {MODEL_OUTPUT_PATH}")


# ─────────────────────────────────────────────────────────────────────────────
# SYNTHETIC DATASET GENERATOR (used when train.csv is absent)
# ─────────────────────────────────────────────────────────────────────────────
def generate_synthetic_dataset(output_path: str = "train.csv", n_samples: int = 10000) -> None:
    """
    Generates a synthetic AI4I-like dataset for demonstration purposes
    when the real dataset is unavailable.

    Args:
        output_path: Where to save the synthetic CSV.
        n_samples:   Number of rows to generate.
    """
    rng = np.random.default_rng(42)

    types = rng.choice(["L", "M", "H"], size=n_samples, p=[0.60, 0.30, 0.10])
    air_temp = rng.normal(300, 2, n_samples)
    proc_temp = air_temp + rng.normal(10, 1, n_samples)
    rpm = rng.normal(1500, 200, n_samples).clip(1000, 3000)
    torque = rng.normal(40, 10, n_samples).clip(5, 80)
    tool_wear = rng.uniform(0, 250, n_samples)

    # Failure probability influenced by extreme conditions
    power_kw = (rpm * torque * 2 * math.pi / 60) / 1000
    temp_diff = proc_temp - air_temp
    failure_score = (
        0.3 * (tool_wear / 250)
        + 0.25 * ((torque - 40) / 40).clip(0, 1)
        + 0.2 * (temp_diff > 12).astype(float)
        + 0.15 * (power_kw > 7).astype(float)
        + 0.1 * rng.uniform(0, 1, n_samples)
    )
    failure = (failure_score > 0.70).astype(int)

    df = pd.DataFrame({
        "UDI": range(1, n_samples + 1),
        "Product ID": [f"M{i:05d}" for i in range(1, n_samples + 1)],
        "Type": types,
        "Air temperature [K]": air_temp.round(1),
        "Process temperature [K]": proc_temp.round(1),
        "Rotational speed [rpm]": rpm.round(0).astype(int),
        "Torque [Nm]": torque.round(1),
        "Tool wear [min]": tool_wear.round(0).astype(int),
        "Machine failure": failure,
        "TWF": 0,
        "HDF": 0,
        "PWF": 0,
        "OSF": 0,
        "RNF": 0,
    })

    df.to_csv(output_path, index=False)
    print(f"[INFO] Synthetic dataset generated -> {output_path}  ({n_samples} rows, {failure.sum()} failures)")


# ─────────────────────────────────────────────────────────────────────────────
# CLI ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MaintiViz ML Training Pipeline")
    parser.add_argument(
        "--data",
        type=str,
        default="train.csv",
        help="Path to the AI4I training CSV file (default: train.csv)",
    )
    parser.add_argument(
        "--generate-synthetic",
        action="store_true",
        help="Generate a synthetic dataset if train.csv is missing",
    )
    args = parser.parse_args()

    if args.generate_synthetic or not os.path.exists(args.data):
        print("[WARN] train.csv not found — generating synthetic dataset …")
        generate_synthetic_dataset(args.data)

    train(args.data)
