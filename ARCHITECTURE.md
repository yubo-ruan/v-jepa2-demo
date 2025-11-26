# V-JEPA2 Demo Application Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           V-JEPA2 Demo System                                │
│                     Robot Action Planning with Vision AI                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐          ┌──────────────────────┐
│   Frontend (Next.js) │◄────────►│  Backend (FastAPI)   │
│   Port: 3000         │   HTTP   │  Port: 8001          │
│                      │   WS     │                      │
└──────────────────────┘          └──────────────────────┘
         │                                  │
         │                                  │
         ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────┐
│  React Components    │          │  PyTorch + V-JEPA2   │
│  State Management    │          │  Model Inference     │
└──────────────────────┘          └──────────────────────┘
```

## Frontend Architecture (Next.js 16 + React)

```
frontend/
├── src/
│   ├── app/
│   │   └── page.tsx                    # Main app entry point
│   │
│   ├── components/
│   │   ├── pages/
│   │   │   ├── UploadPage/             # 🎯 Main planning interface
│   │   │   │   └── index.tsx           # Image upload, action display
│   │   │   ├── ConfigPage/             # Model management
│   │   │   ├── HistoryPage/            # Planning history
│   │   │   └── FinetunePage/           # (Future) Model fine-tuning
│   │   │
│   │   ├── visualizations/
│   │   │   ├── EnergyLandscape.tsx     # 2D/3D energy plots
│   │   │   └── IterationReplay.tsx     # CEM optimization replay
│   │   │
│   │   ├── ModelManagementTable.tsx    # Model download/load/unload
│   │   └── ui/                         # Reusable UI components
│   │
│   ├── contexts/
│   │   ├── PlanningContext.tsx         # Planning state management
│   │   ├── ModelsContext.tsx           # Model state management
│   │   └── ToastContext.tsx            # Notifications
│   │
│   ├── lib/
│   │   └── api.ts                      # 🔌 API client (HTTP + WebSocket)
│   │
│   └── types/
│       └── index.ts                    # TypeScript types
│
└── package.json
```

### Frontend Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User Interaction Flow                                                   │
└─────────────────────────────────────────────────────────────────────────┘

1. Upload Images
   User uploads current + goal images
   ↓
2. Select Model & Parameters
   Choose model (vit-large, vit-giant, vit-giant-ac)
   Set CEM params (samples, iterations, elite_fraction)
   ↓
3. Start Planning
   POST /api/plan → Returns task_id
   ↓
4. Real-time Updates via WebSocket
   WS /ws/plan/{task_id}
   ├─ model_loading (progress bar)
   ├─ running (iteration progress)
   └─ completed (final action)
   ↓
5. Display Results
   - Optimal action vector [x, y, z] or 7-DOF
   - Confidence score
   - Energy landscape visualization
   - Iteration replay
```

## Backend Architecture (FastAPI + PyTorch)

```
backend/
├── app/
│   ├── main.py                         # 🚀 FastAPI app entry point
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── planning.py             # POST /api/plan, GET /api/plan/{id}
│   │   │   ├── models.py               # Model management endpoints
│   │   │   └── system.py               # System metrics
│   │   │
│   │   └── websocket.py                # WebSocket manager for live updates
│   │
│   ├── services/
│   │   ├── vjepa2.py                   # 🧠 Core V-JEPA2 inference engine
│   │   │   ├── VJEPA2ModelLoader       # PyTorch Hub model loading
│   │   │   ├── encode_images()         # Extract embeddings
│   │   │   ├── evaluate_actions_ac()   # AC predictor evaluation
│   │   │   └── run_cem()               # Cross-Entropy Method optimization
│   │   │
│   │   └── planner.py                  # Planning task orchestration
│   │
│   ├── models/
│   │   └── schemas.py                  # Pydantic models (request/response)
│   │
│   └── config.py                       # Configuration settings
│
├── data/uploads/                       # User-uploaded images
│
└── requirements.txt
```

### Backend Request Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Planning Request Processing                                             │
└─────────────────────────────────────────────────────────────────────────┘

POST /api/plan
{
  "currentImage": "base64...",
  "goalImage": "base64...",
  "model": "vit-giant-ac",
  "samples": 500,
  "iterations": 5
}
   │
   ▼
┌─────────────────────────┐
│  planner.create_task()  │  Creates task ID
└─────────────────────────┘
   │
   ▼
┌─────────────────────────┐
│ Background AsyncIO Task │
└─────────────────────────┘
   │
   ├─► WebSocket: "loading_model"
   │
   ├─► VJEPA2ModelLoader.load_model()
   │   ├─ PyTorch Hub download (if not cached)
   │   ├─ Load encoder to GPU (MPS/CUDA)
   │   └─ Load predictor to GPU (AC models only)
   │
   ├─► WebSocket: "model_loaded"
   │
   ├─► encode_images()
   │   ├─ Preprocess images (224x224, normalize)
   │   ├─ Encode current image → embeddings
   │   └─ Encode goal image → embeddings
   │
   ├─► run_cem()  # Cross-Entropy Method
   │   │
   │   └─► For each iteration:
   │       ├─ Sample actions from distribution
   │       ├─ evaluate_actions_ac()  # Predict future states
   │       ├─ Compute energy (L1 distance to goal)
   │       ├─ Select elite samples (top 20%)
   │       ├─ Update distribution (mean, std)
   │       └─► WebSocket: progress update
   │
   └─► WebSocket: "completed"
       {
         "action": [x, y, z, roll, pitch, yaw, gripper],
         "confidence": 0.89,
         "energy": -0.04
       }
```

## Core ML Components

### 1. V-JEPA2 Models (PyTorch Hub)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  V-JEPA2 Model Variants                                                  │
└─────────────────────────────────────────────────────────────────────────┘

vit-large (300M params, 4.8GB)
├─ Encoder: Vision Transformer
└─ Use case: Fast 3D action planning

vit-huge (630M params, 9.5GB)
├─ Encoder: Larger ViT
└─ Use case: Higher accuracy 3D planning

vit-giant (1.2B params, 15.3GB)
├─ Encoder: Largest ViT
└─ Use case: Best 3D planning

vit-giant-ac (1.2B params, 15.5GB)  ⭐ Action-Conditioned
├─ Encoder: ViT for video frames
├─ AC Predictor: Predicts future embeddings given actions
└─ Use case: 7-DOF robot manipulation planning
```

### 2. CEM Optimization Algorithm

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Cross-Entropy Method (CEM) for Action Optimization                     │
└─────────────────────────────────────────────────────────────────────────┘

Initialize:
  μ = [0, 0, 0, 0, 0, 0, 0]  # Mean action
  σ = [1, 1, 1, 1, 1, 1, 1]  # Std deviation

For iteration i in 1..N:
  1. Sample actions ~ N(μ, σ²)         # 500 samples
  2. Evaluate each action:
     - Predict future embedding
     - Compute energy = ||predicted - goal||
  3. Select elites (top 20% lowest energy)
  4. Update distribution:
     - μ = mean(elite_actions)
     - σ = std(elite_actions)

Return: μ (optimal action)
```

### 3. Action Space

```
┌─────────────────────────────────────────────────────────────────────────┐
│  7-DOF Action Space (AC Models)                                          │
└─────────────────────────────────────────────────────────────────────────┘

[x, y, z, roll, pitch, yaw, gripper]
 │  │  │    │     │      │      │
 │  │  │    │     │      │      └─► Gripper: -1 (close) to 1 (open)
 │  │  │    │     │      └────────► Yaw: rotation around Z-axis
 │  │  │    │     └───────────────► Pitch: rotation around Y-axis
 │  │  │    └─────────────────────► Roll: rotation around X-axis
 │  │  └──────────────────────────► Z: vertical position (cm)
 │  └─────────────────────────────► Y: lateral position (cm)
 └────────────────────────────────► X: forward position (cm)

Bounds: [-10, 10] for each dimension
```

## Data Flow Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Upload images
       ▼
┌─────────────────┐
│  PlanningContext│
│  (React State)  │
└──────┬──────────┘
       │ 2. POST /api/plan
       ▼
┌─────────────────┐
│   API Client    │
│   (lib/api.ts)  │
└──────┬──────────┘
       │ 3. HTTP Request
       ▼
┌─────────────────┐         ┌──────────────────┐
│  FastAPI Router │────────►│  planner.py      │
│  (planning.py)  │         │  Task Manager    │
└─────────────────┘         └────────┬─────────┘
                                     │ 4. Create background task
                                     ▼
                            ┌──────────────────┐
                            │  vjepa2.py       │
                            │  ML Inference    │
                            └────────┬─────────┘
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       │ 5. Load model               │ 6. Encode images            │
       ▼                             ▼                             │
┌──────────────┐           ┌──────────────┐                        │
│ PyTorch Hub  │           │ Encoder      │                        │
│ Download     │           │ (ViT)        │                        │
└──────────────┘           └──────────────┘                        │
                                                                   │ 7. CEM
                                                                   ▼
                                                          ┌──────────────┐
                                                          │ AC Predictor │
                                                          │ (Attention)  │
                                                          └──────┬───────┘
                                                                 │ 8. Optimize
       ┌─────────────────────────────────────────────────────────┘
       │ 9. Return action
       ▼
┌─────────────────┐
│  WebSocket      │
│  Broadcast      │
└──────┬──────────┘
       │ 10. Real-time updates
       ▼
┌─────────────────┐
│  Browser        │
│  Display Result │
└─────────────────┘
```

## Key Technologies

### Frontend
- **Framework**: Next.js 16 (React 19, App Router, Turbopack)
- **State**: React Context API + hooks
- **Styling**: Tailwind CSS
- **Visualization**: Custom Canvas/WebGL for energy landscapes
- **Communication**: Fetch API (REST) + WebSocket (real-time)

### Backend
- **Framework**: FastAPI (async Python)
- **ML**: PyTorch 2.x + PyTorch Hub
- **Models**: V-JEPA2 (Vision Transformer + AC Predictor)
- **Optimization**: NumPy for CEM algorithm
- **Device**: MPS (Apple Silicon) / CUDA (NVIDIA) / CPU
- **Precision**: FP16 (half precision) for large models

## Current Issues Being Debugged

### Mixed Precision Error in AC Models
```
RuntimeError: Expected query, key, and value to have the same dtype, 
but got query.dtype: float key.dtype: float and value.dtype: c10::Half
```

**Root Cause**: Internal attention layers in AC predictor have mixed FP16/FP32 tensors

**Attempted Fixes**:
1. ✅ Added temporal dimension to actions/states
2. ✅ Match dtype between embeddings and actions
3. ⚠️ Recursive `.half()` conversion (in progress)

**Files Modified**:
- `backend/app/services/vjepa2.py:310-348` - Model loading with FP16 conversion
- `backend/app/services/vjepa2.py:640-670` - AC predictor evaluation

