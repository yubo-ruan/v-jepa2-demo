#!/usr/bin/env python3
"""Test predictor input shapes."""

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
current_emb, goal_emb = inference.encode_images(current_img, goal_img)

# Get cached patch embeddings
current_patches = inference._embedding_cache["current_patches"]
goal_patches = inference._embedding_cache["goal_patches"]

print("Cached embeddings:")
print(f"  current_patches shape: {current_patches.shape}")
print(f"  goal_patches shape: {goal_patches.shape}")

# Create test inputs
num_samples = 5
actions = torch.randn(num_samples, 7, device=inference.device, dtype=inference.dtype)
states = torch.zeros(num_samples, 7, device=inference.device, dtype=inference.dtype)
x = current_patches.expand(num_samples, -1, -1)

print(f"\nPredictor inputs:")
print(f"  x shape: {x.shape} (dim={x.dim()})")
print(f"  actions shape: {actions.shape} (dim={actions.dim()})")
print(f"  states shape: {states.shape} (dim={states.dim()})")

# Try calling predictor
predictor = loader.get_predictor()
print(f"\nCalling predictor...")
try:
    result = predictor(x, actions, states)
    print(f"✓ SUCCESS! result shape: {result.shape}")
except Exception as e:
    print(f"✗ FAILED: {e}")

    # The predictor expects 4D inputs with temporal dimension
    # Let's try adding a temporal dimension
    print(f"\nTrying with temporal dimension added...")
    x_4d = x.unsqueeze(1)  # Add T=1 dimension
    actions_4d = actions.unsqueeze(1)
    states_4d = states.unsqueeze(1)

    print(f"  x_4d shape: {x_4d.shape} (dim={x_4d.dim()})")
    print(f"  actions_4d shape: {actions_4d.shape} (dim={actions_4d.dim()})")
    print(f"  states_4d shape: {states_4d.shape} (dim={states_4d.dim()})")

    try:
        result = predictor(x_4d, actions_4d, states_4d)
        print(f"✓ SUCCESS with 4D! result shape: {result.shape}")
    except Exception as e2:
        print(f"✗ Still failed: {e2}")
