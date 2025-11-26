#!/usr/bin/env python3
"""Full CEM test to reproduce the error during optimization."""

import sys
sys.path.insert(0, '.')

from PIL import Image

from app.services.vjepa2 import get_model_loader, get_inference

# Load test images
print("Loading test images...")
current_img = Image.open("data/uploads/current.jpg")
goal_img = Image.open("data/uploads/goal.jpg")
print(f"✓ Images loaded: current={current_img.size}, goal={goal_img.size}")

# Load AC model
print("\nLoading vit-giant-ac model...")
loader = get_model_loader()
loader.load_model('vit-giant-ac')
print(f"✓ Model loaded: {loader._loaded_model_id}")

# Get inference service
inference = get_inference()

# Run full CEM optimization
print("\nRunning CEM optimization...")
print("=" * 60)

def progress_callback(iteration, total, best_energy, best_action):
    print(f"Iteration {iteration}/{total}: energy={best_energy:.3f}")

try:
    result = inference.run_cem(
        current_image=current_img,
        goal_image=goal_img,
        num_samples=10,  # Small number for quick test
        num_iterations=3,  # Just a few iterations
        elite_fraction=0.1,
        progress_callback=progress_callback,
    )
    print("=" * 60)
    print(f"✅ CEM SUCCEEDED!")
    print(f"  Best action: {result['action']}")
    print(f"  Energy: {result['energy']:.3f}")
    print(f"  Confidence: {result['confidence']:.3f}")
except Exception as e:
    print("=" * 60)
    print(f"✗ CEM FAILED with error:")
    print(f"  {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
