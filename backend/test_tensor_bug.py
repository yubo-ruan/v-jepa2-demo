#!/usr/bin/env python3
"""Direct test to reproduce tensor dimension bug."""

import sys
sys.path.insert(0, '.')

from PIL import Image
import torch

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
print(f"  Is AC model: {loader.is_ac_model()}")

# Get inference service
inference = get_inference()

# Test preprocessing
print("\nTesting preprocess_image()...")
current_tensor = inference.preprocess_image(current_img, for_ac=True)
goal_tensor = inference.preprocess_image(goal_img, for_ac=True)
print(f"✓ current_tensor shape: {current_tensor.shape}")
print(f"✓ goal_tensor shape: {goal_tensor.shape}")
print(f"  current_tensor.dim(): {current_tensor.dim()}")
print(f"  goal_tensor.dim(): {goal_tensor.dim()}")

# Test prepare_video_input
print("\nTesting prepare_video_input()...")
video = inference.prepare_video_input(current_img, goal_img, for_ac=True)
print(f"✓ video shape: {video.shape}")

# Test encode_images (THIS IS WHERE THE BUG SHOULD OCCUR)
print("\nTesting encode_images()...")
print("=" * 60)
try:
    current_emb, goal_emb = inference.encode_images(current_img, goal_img)
    print(f"✓ encode_images succeeded!")
    print(f"  current_emb shape: {current_emb.shape}")
    print(f"  goal_emb shape: {goal_emb.shape}")
except Exception as e:
    print(f"✗ encode_images FAILED with error:")
    print(f"  {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED - No tensor dimension error!")
