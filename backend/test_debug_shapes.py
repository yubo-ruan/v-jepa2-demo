#!/usr/bin/env python3
"""Debug tensor shapes in detail."""

import sys
sys.path.insert(0, '.')

import torch
from PIL import Image

from app.services.vjepa2 import get_model_loader, get_inference

# Load test images
current_img = Image.open("data/uploads/current.jpg")
goal_img = Image.open("data/uploads/goal.jpg")

# Load AC model
loader = get_model_loader()
loader.load_model('vit-giant-ac')

# Get inference service
inference = get_inference()

# Encode images to get embeddings
print("Encoding images...")
current_emb, goal_emb = inference.encode_images(current_img, goal_img)

# Get cached patch embeddings
current_patches = inference._embedding_cache["current_patches"]
goal_patches = inference._embedding_cache["goal_patches"]

print(f"\nCached embeddings:")
print(f"  current_patches shape: {current_patches.shape}")
print(f"  goal_patches shape: {goal_patches.shape}")

# Calculate what T should be
# For ViT-Giant: patch_size=16, img_size=256 -> grid_size = 256/16 = 16
# num_patches_per_frame = 16*16 = 256
num_patches = current_patches.shape[1]
grid_size = 16  # For ViT-Giant with 256x256 images
patches_per_frame = grid_size * grid_size
T_inferred = num_patches // patches_per_frame

print(f"\nInferred temporal dimension:")
print(f"  num_patches: {num_patches}")
print(f"  patches_per_frame (16x16): {patches_per_frame}")
print(f"  T = num_patches / patches_per_frame: {T_inferred}")

# Try predictor with correct T
predictor = loader.get_predictor()
num_samples = 5

actions = torch.randn(num_samples, 7, device=inference.device, dtype=inference.dtype)
x = current_patches.expand(num_samples, -1, -1)

print(f"\nTrying predictor with T={T_inferred}...")
if T_inferred == 1:
    # Single frame: actions and states should be (B, 1, 7)
    actions_expanded = actions.unsqueeze(1)  # (B, 1, 7)
    states = torch.zeros(num_samples, 1, 7, device=inference.device, dtype=inference.dtype)
else:
    # Multiple frames
    actions_expanded = actions.unsqueeze(1).expand(-1, T_inferred, -1)
    states = torch.zeros(num_samples, T_inferred, 7, device=inference.device, dtype=inference.dtype)

print(f"  x shape: {x.shape}")
print(f"  actions_expanded shape: {actions_expanded.shape}")
print(f"  states shape: {states.shape}")

try:
    result = predictor(x, actions_expanded, states)
    print(f"✅ Predictor succeeded! Result shape: {result.shape}")
except Exception as e:
    print(f"✗ Predictor failed: {e}")
