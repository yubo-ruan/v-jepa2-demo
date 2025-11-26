# V-JEPA2 Demo

A full-stack web application for demonstrating V-JEPA2 (Video Joint Embedding Predictive Architecture 2) action planning capabilities. Upload current and goal state images, and the system computes optimal action sequences using energy minimization.

## Overview

V-JEPA2 is a self-supervised learning model that predicts future video frames and action consequences. This demo provides an interactive interface for:

- **Action Planning**: Compute optimal action sequences between current and goal states
- **Model Management**: Download, load, and switch between V-JEPA2 model variants
- **Real-time Monitoring**: Track inference progress with live WebSocket updates
- **Visualization**: View energy landscapes and iteration replays
- **Batch Processing**: Process multiple image pairs efficiently
- **Export**: Save results as GIF animations or ZIP archives

## Architecture

For a detailed architecture diagram and component breakdown, see [ARCHITECTURE.md](./ARCHITECTURE.md).

### System Overview

```
┌──────────────────────┐          ┌──────────────────────┐
│   Frontend (Next.js) │◄────────►│  Backend (FastAPI)   │
│   Port: 3000         │   HTTP   │  Port: 8000          │
│                      │   WS     │                      │
└──────────────────────┘          └──────────────────────┘
         │                                  │
         ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────┐
│  React Components    │          │  PyTorch + V-JEPA2   │
│  State Management    │          │  Model Inference     │
└──────────────────────┘          └──────────────────────┘
```

### Frontend (Next.js 16 + React 19)
- **Port**: 3000
- **Tech Stack**: TypeScript, Tailwind CSS, React Context API
- **Features**: Real-time WebSocket integration, model management UI, visualization components
- **Key Components**: UploadPage, PlanningContext, EnergyLandscape, IterationReplay

### Backend (FastAPI + PyTorch)
- **Port**: 8000
- **Tech Stack**: Python, FastAPI, PyTorch with MPS/CUDA support
- **Features**: V-JEPA2 inference, WebSocket progress streaming, async task processing
- **Key Components**: VJEPA2ModelLoader, CEM optimizer, AC predictor

### Supported Models

| Model | Parameters | Size | Description | Recommended For |
|-------|-----------|------|-------------|-----------------|
| **vit-large** | 300M | ~4.8GB | Fastest inference, best for 16GB devices | Most users (default) |
| **vit-huge** | 630M | ~9.5GB | Balanced quality and speed | 24GB+ devices |
| **vit-giant** | 1.2B | ~15.3GB | Best quality | 32GB+ devices |
| **vit-giant-ac** | 1.2B | ~15.5GB | Action-conditioned for 7D DROID actions | Research/planning tasks |

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **PyTorch** 2.0+ with MPS (Apple Silicon) or CUDA (NVIDIA GPU) support
- **16GB+ RAM** recommended (8GB minimum for vit-large)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yubo-ruan/v-jepa2-demo.git
cd v-jepa2-demo
```

2. **Install frontend dependencies**
```bash
cd frontend
npm install
```

3. **Install backend dependencies**
```bash
cd ../backend
pip install -r requirements.txt
```

### Running the Application

1. **Start the backend** (from `backend/` directory)
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. **Start the frontend** (from `frontend/` directory)
```bash
npm run dev
```

3. **Open your browser** to [http://localhost:3000](http://localhost:3000)

## Usage

### Basic Workflow

1. **Upload Images**: Drag and drop or select current state and goal state images
2. **Configure Parameters**:
   - Model: Choose V-JEPA2 variant (default: vit-large)
   - Samples: Number of action candidates per iteration (default: 400)
   - Iterations: CEM optimization iterations (default: 10)
   - Elite Fraction: Top fraction of samples to keep (default: 0.1)
3. **Run Planning**: Click "Plan Action" to start inference
4. **View Results**:
   - Optimal action vector
   - Energy landscape visualization
   - Iteration-by-iteration replay
   - Convergence metrics

### Model Management

Navigate to the **Models** tab to:
- Download models from PyTorch Hub
- Load models into GPU memory
- Unload models to free memory
- View model status and cache

## API Documentation

### Planning Endpoints

- `POST /api/plan` - Create planning task
- `GET /api/plan/{task_id}` - Get task status
- `POST /api/plan/{task_id}/cancel` - Cancel task
- `WS /ws/plan/{task_id}` - WebSocket progress updates

### Model Endpoints

- `GET /api/models` - List available models
- `GET /api/models/status` - Get model status
- `POST /api/models/{model_id}/download` - Download model
- `POST /api/models/{model_id}/load` - Load model to GPU
- `POST /api/models/{model_id}/unload` - Unload from GPU

### Upload Endpoints

- `POST /api/upload` - Upload image
- `GET /api/upload/{upload_id}` - Get uploaded image

### System Endpoints

- `GET /api/health` - Health check
- `GET /api/system/device` - Device information
- `GET /api/system/config` - Application configuration

## Configuration

### Backend Configuration

Edit `backend/app/config.py` or use environment variables:

```python
# Server
HOST = "0.0.0.0"
PORT = 8000
DEBUG = True

# Model defaults (optimized for 16GB Mac)
DEFAULT_MODEL = "vit-large"
DEFAULT_SAMPLES = 400
DEFAULT_ITERATIONS = 10

# Inference settings
USE_FP16 = True  # Use FP16 for memory efficiency
MAX_BATCH_SIZE = 1
```

### Frontend Configuration

Edit `frontend/src/constants/config.ts`:

```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
```

## Development

### Project Structure

```
v-jepa2-demo/
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js app router
│   │   ├── components/       # React components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilities and API client
│   │   └── types/            # TypeScript types
│   └── public/               # Static assets
├── backend/
│   ├── app/
│   │   ├── api/routes/       # API endpoints
│   │   ├── models/           # Pydantic schemas
│   │   └── services/         # Business logic
│   └── data/                 # Model cache and uploads
└── test-*.mjs                # E2E tests
```

### Running Tests

**Frontend E2E Tests**:
```bash
node test-frontend.mjs
node test-e2e.mjs
```

**Backend Tests**:
```bash
cd backend
python test_planning.py
```

## Performance Optimization

### For 16GB Devices (Recommended)
- Use `vit-large` model
- Enable FP16: `USE_FP16 = True`
- Samples: 400-600
- Iterations: 8-10

### For 32GB+ Devices
- Use `vit-giant` or `vit-giant-ac`
- Samples: 800-1200
- Iterations: 15-20

## Troubleshooting

### Model Download Issues
- PyTorch Hub downloads can be large (5-15GB)
- Models cached in `~/.cache/torch/hub/`
- Check internet connection if download fails

### Memory Issues
- **OOM on Mac**: Use `vit-large` instead of larger models
- **OOM on planning**: Reduce `samples` and `iterations`
- Unload unused models to free memory

### WebSocket Connection Issues
- Ensure backend is running on port 8000
- Check `CORS_ORIGINS` in backend config

## Technology Stack

### Frontend
- Next.js 16 (React 19)
- TypeScript
- Tailwind CSS
- WebSocket client

### Backend
- FastAPI
- PyTorch 2.0+
- Pydantic
- WebSockets

### ML/AI
- V-JEPA2 (PyTorch Hub)
- Cross-Entropy Method (CEM) for planning
- FP16 inference for memory efficiency

## License

This project is for demonstration and research purposes.

## Acknowledgments

- V-JEPA2 model from Meta AI Research
- CEM planning algorithm implementation
- DROID dataset for action-conditioned models
