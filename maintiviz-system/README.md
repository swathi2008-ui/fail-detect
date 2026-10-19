# ⚡ MaintiViz Edge Engine

> **Enterprise-grade Predictive Maintenance Dashboard**
> MERN Stack + Python FastAPI ML Microservice • Real-time Telemetry • XGBoost / RandomForest

![System Architecture](https://img.shields.io/badge/Stack-MERN%20%2B%20FastAPI-06b6d4?style=for-the-badge)
![ML Model](https://img.shields.io/badge/ML-RandomForest%20%7C%20XGBoost-818cf8?style=for-the-badge)
![Dataset](https://img.shields.io/badge/Dataset-AI4I%202020-f59e0b?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-22d3ee?style=for-the-badge)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend :5173                        │
│   Sliders → Risk Gauge → Recharts → History Table → API Inspector   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  HTTP / Axios
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Express Gateway :5000                             │
│   POST /api/telemetry/analyze                                       │
│   GET  /api/telemetry/history                                       │
│   GET  /api/telemetry/stats                                         │
└──────────────┬─────────────────────────────┬────────────────────────┘
               │  axios forward              │  Mongoose
               ▼                             ▼
┌──────────────────────────┐    ┌────────────────────────────────┐
│  FastAPI ML Service :8000│    │       MongoDB Atlas             │
│  POST /predict           │    │  TelemetryLog collection       │
│  Physics FE + RF Model   │    │  Indexes: riskLevel, timestamp  │
└──────────────────────────┘    └────────────────────────────────┘
```

---

## 📁 Project Structure

```
maintiviz-system/
├── ml-service/
│   ├── train_model.py       # ML training pipeline + synthetic data generator
│   ├── main.py              # FastAPI microservice with Pydantic validation
│   ├── requirements.txt
│   └── Dockerfile
├── backend/
│   ├── config/db.js         # MongoDB connection with retry + backoff
│   ├── models/Log.js        # Mongoose schema with compound indexes
│   ├── routes/telemetry.js  # analyze / history / stats endpoints
│   ├── server.js            # Express bootstrap with Helmet + CORS + Morgan
│   ├── .env.example
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── RiskGauge.jsx       # Animated SVG radial gauge
│   │   │   ├── TelemetrySliders.jsx# Sensor sliders + preset scenarios
│   │   │   ├── MetricsCards.jsx    # KPI header strip
│   │   │   ├── TelemetryChart.jsx  # Recharts area/line charts
│   │   │   ├── HistoryTable.jsx    # Filterable telemetry log browser
│   │   │   └── ApiInspector.jsx    # Slide-in request/response drawer
│   │   ├── App.jsx                 # Dashboard orchestration
│   │   ├── index.css               # Tailwind + glassmorphism design system
│   │   ├── api.js                  # Axios service layer
│   │   └── main.jsx
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── nginx.conf
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | 18+ |
| Python | 3.10+ |
| npm | 9+ |
| pip | 23+ |
| MongoDB Atlas account | — |

---

### Option A — Run Locally (3 Terminals)

#### 1. ML Service Setup

```bash
cd maintiviz-system/ml-service

# Install dependencies
pip install -r requirements.txt

# Train the model (auto-generates synthetic data if train.csv is absent)
python train_model.py

# If you have the real AI4I dataset:
# python train_model.py --data path/to/ai4i2020.csv

# Start FastAPI service
uvicorn main:app --host 0.0.0.0 --port 8000 --reloaduvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: http://localhost:8000/docs

---

#### 2. Backend Setup

```bash
cd maintiviz-system/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env → set your MONGO_URI

# Start Express gateway
npm run dev
```

Verify: http://localhost:5000/health

---

#### 3. Frontend Setup

```bash
cd maintiviz-system/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Open: http://localhost:5173

---

### Option B — Docker Compose (All Services)

```bash
cd maintiviz-system

# Create a .env file with your MongoDB URI
echo "MONGO_URI=mongodb+srv://..." > .env

# Build and start all services
docker compose up --build

# Or run in background
docker compose up -d --build
```

Services will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- ML Service: http://localhost:8000

---

## 🌐 API Reference

### ML Service (FastAPI)

#### `POST /predict`

```json
// Request
{
  "Type": "M",
  "Air temperature [K]": 298.1,
  "Process temperature [K]": 308.6,
  "Rotational speed [rpm]": 1551,
  "Torque [Nm]": 42.8,
  "Tool wear [min]": 108
}

// Response
{
  "failure_probability": 0.0732,
  "risk_level": "HEALTHY",
  "threshold_used": 0.40,
  "features": {
    "Temp_Diff": 10.5,
    "Power_kW": 6.9471,
    ...
  },
  "model_version": "1.0.0"
}
```

#### `GET /health` — Service liveness probe

---

### Express Gateway

#### `POST /api/telemetry/analyze`

```json
// Request
{
  "machineType": "M",
  "airTemp": 298.1,
  "processTemp": 308.6,
  "rotationalSpeed": 1551,
  "torque": 42.8,
  "toolWear": 108
}
```

#### `GET /api/telemetry/history` — Last 50 logs (desc by timestamp)

#### `GET /api/telemetry/stats` — KPI aggregates

---

## 🤖 ML Pipeline Details

### Feature Engineering

| Feature | Formula | Purpose |
|---------|---------|---------|
| `Temp_Diff` | `Process_Temp - Air_Temp` | Heat dissipation proxy |
| `Power_kW` | `(RPM × Torque × 2π/60) / 1000` | Mechanical load indicator |

### Model Specs

- **Algorithm**: `RandomForestClassifier` (300 trees, depth 12)
- **Imbalance Handling**: `class_weight='balanced'` — ~3.4% minority class
- **Decision Threshold**: Auto-tuned (0.30–0.70 sweep) to maximize F1
- **Fallback**: Physics-based heuristic when model.pkl is absent

### Risk Classification

| Risk Level | Condition |
|-----------|-----------|
| 🟢 HEALTHY | P < 24% |
| 🟡 WARNING | 24% ≤ P < 40% |
| 🔴 CRITICAL | P ≥ 40% |

---

## 🎛️ Preset Scenarios

| Scenario | Machine | Tool Wear | Torque | Expected Risk |
|---------|---------|-----------|--------|--------------|
| Normal Operations | M | 108 min | 42.8 Nm | HEALTHY |
| High Torque Strain | L | 195 min | 68.5 Nm | WARNING |
| Thermal Overheat | L | 201 min | 69.2 Nm | CRITICAL |
| Tool Wear Breakdown | H | 248 min | 72.1 Nm | CRITICAL |

---

## 🔧 Environment Variables

### Backend `.env`

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/maintiviz
ML_SERVICE_URL=http://localhost:8000
ML_TIMEOUT_MS=8000
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env` (optional)

```env
VITE_API_URL=http://localhost:5000
```

---

## 🧪 Testing the System

### Quick End-to-End Test

```bash
# 1. Health check ML service
curl http://localhost:8000/health

# 2. Test prediction directly
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"Type":"M","Air temperature [K]":298.1,"Process temperature [K]":308.6,"Rotational speed [rpm]":1551,"Torque [Nm]":42.8,"Tool wear [min]":108}'

# 3. Test Express gateway
curl -X POST http://localhost:5000/api/telemetry/analyze \
  -H "Content-Type: application/json" \
  -d '{"machineType":"M","airTemp":298.1,"processTemp":308.6,"rotationalSpeed":1551,"torque":42.8,"toolWear":108}'

# 4. Check history
curl http://localhost:5000/api/telemetry/history

# 5. Check stats
curl http://localhost:5000/api/telemetry/stats
```

---

## 🏭 Production Checklist

- [ ] Replace `class_weight='balanced'` with SMOTE oversampling for better recall
- [ ] Add JWT authentication to Express routes
- [ ] Set `NODE_ENV=production` and restrict CORS origins
- [ ] Enable HTTPS via Let's Encrypt / Cloudflare
- [ ] Add rate limiting (`express-rate-limit`)
- [ ] Set up MongoDB Atlas IP allowlist
- [ ] Configure model versioning and A/B testing pipeline
- [ ] Add Prometheus metrics endpoint to FastAPI
- [ ] Set up Grafana dashboard for operational monitoring

---

## 📚 Dataset Reference

- **Dataset**: [AI4I 2020 Predictive Maintenance Dataset](https://archive.ics.uci.edu/ml/datasets/AI4I+2020+Predictive+Maintenance+Dataset)
- **Records**: 10,000 synthetic manufacturing entries
- **Failure Rate**: ~3.4% (severely imbalanced)
- **Features**: Type (L/M/H), Air Temp, Process Temp, RPM, Torque, Tool Wear

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3 |
| Charts | Recharts 2 |
| Icons | Lucide React |
| HTTP Client | Axios |
| Backend | Node.js 20, Express 4 |
| Database | MongoDB Atlas, Mongoose 8 |
| ML Service | Python 3.11, FastAPI, uvicorn |
| ML Model | scikit-learn RandomForest, XGBoost |
| Data | Pandas, NumPy |
| Containers | Docker, Docker Compose |
| Web Server | Nginx (production frontend) |

---

*Built with ❤️ for industrial IoT and predictive analytics.*
