#!/usr/bin/env python3
"""Test script for V-JEPA2 planning with real images."""

import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from PIL import Image
from app.services.vjepa2 import get_model_loader, get_inference

def test_planning():
    """Run a full planning test with the test images."""
    print("=" * 60)
    print("V-JEPA2 Planning Test")
    print("=" * 60)

    # Load test images
    data_dir = Path(__file__).parent / "data" / "uploads"
    current_img_path = data_dir / "current.jpg"
    goal_img_path = data_dir / "goal.jpg"

    if not current_img_path.exists() or not goal_img_path.exists():
        print(f"ERROR: Test images not found in {data_dir}")
        return

    print(f"\n[1/4] Loading test images...")
    current_img = Image.open(current_img_path)
    goal_img = Image.open(goal_img_path)
    print(f"  Current image: {current_img.size}")
    print(f"  Goal image: {goal_img.size}")

    # Check which models are cached
    print(f"\n[2/4] Checking cached models...")
    loader = get_model_loader()
    for model_id in ["vit-large", "vit-huge", "vit-giant", "vit-giant-ac"]:
        cached = loader.is_cached(model_id)
        loaded = loader.is_loaded(model_id)
        print(f"  {model_id}: cached={cached}, loaded={loaded}")

    # Select the best available model
    model_id = "vit-large"  # Use vit-large since it's likely cached
    if loader.is_cached("vit-giant"):
        model_id = "vit-giant"

    print(f"\n[3/4] Loading model: {model_id}...")
    start_time = time.time()
    loader.load_model(model_id)
    load_time = time.time() - start_time
    print(f"  Model loaded in {load_time:.1f}s")

    # Get inference service
    inference = get_inference()

    # Run CEM optimization
    print(f"\n[4/4] Running CEM optimization...")
    print(f"  Samples: 200")
    print(f"  Iterations: 5")

    def progress_callback(iteration, total, best_energy, best_action):
        print(f"  Iteration {iteration}/{total}: energy={best_energy:.4f}, action={[round(a, 3) for a in best_action]}")

    start_time = time.time()
    result = inference.run_cem(
        current_image=current_img,
        goal_image=goal_img,
        num_samples=200,
        num_iterations=5,
        elite_fraction=0.1,
        progress_callback=progress_callback,
    )
    cem_time = time.time() - start_time

    print(f"\n" + "=" * 60)
    print("Results:")
    print("=" * 60)
    print(f"  Action: {[round(a, 4) for a in result['action']]}")
    print(f"  Confidence: {result['confidence']:.4f}")
    print(f"  Final Energy: {result['energy']:.4f}")
    print(f"  Energy History: {result['energy_history']}")
    print(f"  Samples Evaluated: {result['samples_evaluated']}")
    print(f"  CEM Time: {cem_time:.2f}s")
    print(f"  Is AC Model: {result.get('is_ac_model', False)}")
    print("=" * 60)

    # Clear cache
    inference.clear_cache()
    print("\nTest completed successfully!")

if __name__ == "__main__":
    test_planning()
