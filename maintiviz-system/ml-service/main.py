"""
MaintiViz Edge Engine — FastAPI ML Microservice
================================================
Exposes a /predict endpoint that:
  1. Validates incoming telemetry via Pydantic schemas
  2. Engineers physics-based features (Temp_Diff, Power_kW)
  3. Runs the trained RandomForest pipeline
  4. Returns failure_probability, risk_level, and feature breakdown

Run:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import math
import os
from contextlib import asynccontextmanager
from typing import Literal

import joblib
import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL STATE
# ─────────────────────────────────────────────────────────────────────────────
MODEL_PATH = os.getenv("MODEL_PATH", "model.pkl")
_artefact: dict = {}  # holds pipeline + threshold after startup


# ─────────────────────────────────────────────────────────────────────────────
# LIFESPAN — load model once at startup
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artefact at startup; release on shutdown."""
    global _artefact
    if os.path.exists(MODEL_PATH):
        _artefact = joblib.load(MODEL_PATH)
        print(f"[INFO] Model loaded from {MODEL_PATH}  |  threshold = {_artefact.get('threshold', 0.40)}")
    else:
        print(
            "[WARN] model.pkl not found — run `python train_model.py` first.\n"
            "       Starting in DEMO mode with a simple heuristic predictor."
        )
    yield
    print("[INFO] ML service shutting down.")


# ─────────────────────────────────────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="MaintiViz Edge Engine — ML Service",
    description="Real-time predictive maintenance inference microservice",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict to Express gateway origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class TelemetryInput(BaseModel):
    """Validated telemetry payload from the sensor layer."""

    type: Literal["L", "M", "H"] = Field(..., alias="Type", description="Machine quality type (L/M/H)")
    air_temp: float = Field(..., alias="Air temperature [K]", ge=250.0, le=400.0, description="Ambient temperature in Kelvin")
    process_temp: float = Field(..., alias="Process temperature [K]", ge=250.0, le=400.0, description="Process temperature in Kelvin")
    rotational_speed: float = Field(..., alias="Rotational speed [rpm]", ge=100.0, le=5000.0, description="Spindle RPM")
    torque: float = Field(..., alias="Torque [Nm]", ge=0.0, le=250.0, description="Shaft torque in Newton-metres")
    tool_wear: float = Field(..., alias="Tool wear [min]", ge=0.0, le=300.0, description="Cumulative tool wear in minutes")

    model_config = {"populate_by_name": True}

    @field_validator("process_temp")
    @classmethod
    def process_temp_must_exceed_air_temp(cls, v, info):
        """Process temperature should be warmer than ambient in normal ops."""
        if "air_temp" in info.data and v < info.data["air_temp"] - 5:
            raise ValueError("Process temperature cannot be significantly below air temperature")
        return v


class PredictionResponse(BaseModel):
    """Full prediction payload returned to the Express gateway."""

    failure_probability: float = Field(..., description="P(failure) in range [0, 1]")
    risk_level: str = Field(..., description="HEALTHY | WARNING | CRITICAL")
    threshold_used: float
    features: dict = Field(..., description="Engineered feature breakdown")
    model_version: str = "1.0.0"


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    threshold: float


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────
def engineer_features(data: TelemetryInput) -> pd.DataFrame:
    """
    Converts a validated TelemetryInput into a single-row DataFrame
    with all model features including physics-derived columns.

    Args:
        data: Validated Pydantic input model.

    Returns:
        Single-row DataFrame ready for pipeline.predict_proba().
    """
    temp_diff = data.process_temp - data.air_temp
    power_kw = (data.rotational_speed * data.torque * 2 * math.pi / 60) / 1000

    return pd.DataFrame([{
        "Type": data.type,
        "Air temperature [K]": data.air_temp,
        "Process temperature [K]": data.process_temp,
        "Rotational speed [rpm]": data.rotational_speed,
        "Torque [Nm]": data.torque,
        "Tool wear [min]": data.tool_wear,
        "Temp_Diff": round(temp_diff, 3),
        "Power_kW": round(power_kw, 4),
    }]), temp_diff, power_kw


# ─────────────────────────────────────────────────────────────────────────────
# HEURISTIC FALLBACK (when model.pkl is absent)
# ─────────────────────────────────────────────────────────────────────────────
def heuristic_predict(data: TelemetryInput, temp_diff: float, power_kw: float) -> float:
    """
    Physics-based heuristic failure score used as fallback when model is absent.

    Scoring factors:
      - Tool wear > 200 min (end-of-life indicator)
      - Power > 9 kW (excessive load)
      - Temp diff > 12 K (heat dissipation failure)
      - Torque > 60 Nm (mechanical strain)

    Returns:
        Float in [0, 1] representing heuristic failure probability.
    """
    score = 0.0
    score += min(data.tool_wear / 250.0, 1.0) * 0.30
    score += min(max(power_kw - 3.0, 0) / 10.0, 1.0) * 0.25
    score += min(max(temp_diff - 8.0, 0) / 10.0, 1.0) * 0.25
    score += min(max(data.torque - 30.0, 0) / 70.0, 1.0) * 0.20
    return round(min(score, 0.99), 4)


# ─────────────────────────────────────────────────────────────────────────────
# RISK CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────
def classify_risk(probability: float, threshold: float) -> str:
    """
    Maps a failure probability to a human-readable risk level.

    Args:
        probability: Predicted failure probability [0, 1].
        threshold:   Decision boundary for the CRITICAL class.

    Returns:
        "HEALTHY" | "WARNING" | "CRITICAL"
    """
    if probability >= threshold:
        return "CRITICAL"
    elif probability >= threshold * 0.60:
        return "WARNING"
    else:
        return "HEALTHY"


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Meta"])
async def health_check():
    """Service liveness probe."""
    return HealthResponse(
        status="ok",
        model_loaded=bool(_artefact),
        threshold=_artefact.get("threshold", 0.40),
    )


@app.post("/predict", response_model=PredictionResponse, tags=["Inference"])
async def predict(payload: TelemetryInput):
    """
    Main inference endpoint.

    Accepts a JSON telemetry payload, engineers physics features, and returns:
      - failure_probability: float [0, 1]
      - risk_level: HEALTHY | WARNING | CRITICAL
      - features: engineered breakdown for transparency
    """
    try:
        df, temp_diff, power_kw = engineer_features(payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Feature engineering failed: {exc}")

    threshold = _artefact.get("threshold", 0.40)

    if _artefact.get("pipeline"):
        # ── Real model inference ──────────────────────────────────────────────
        try:
            pipeline = _artefact["pipeline"]
            prob = float(pipeline.predict_proba(df)[0, 1])
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Model inference error: {exc}")
    else:
        # ── Heuristic fallback ────────────────────────────────────────────────
        prob = heuristic_predict(payload, temp_diff, power_kw)

    risk = classify_risk(prob, threshold)

    return PredictionResponse(
        failure_probability=round(prob, 4),
        risk_level=risk,
        threshold_used=threshold,
        features={
            "Type": payload.type,
            "Air temperature [K]": payload.air_temp,
            "Process temperature [K]": payload.process_temp,
            "Rotational speed [rpm]": payload.rotational_speed,
            "Torque [Nm]": payload.torque,
            "Tool wear [min]": payload.tool_wear,
            "Temp_Diff": round(temp_diff, 3),
            "Power_kW": round(power_kw, 4),
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
