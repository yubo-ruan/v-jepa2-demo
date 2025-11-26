#!/usr/bin/env python3
"""
Test script for checkpoint save/load functionality.

This script tests:
1. Loading model from PyTorch Hub (first time)
2. Saving checkpoint
3. Loading model from checkpoint (subsequent times)
4. Comparing load times
"""

import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.services.vjepa2 import VJEPA2ModelLoader
from app.config import settings


def test_checkpoint_save_load():
    """Test checkpoint save and load functionality."""
    print("=" * 60)
    print("Testing V-JEPA2 Checkpoint Functionality")
    print("=" * 60)

    # Use vit-giant-ac for testing (AC model with predictor)
    model_id = "vit-giant-ac"

    # Create loader
    print(f"\n1. Initializing model loader...")
    loader = VJEPA2ModelLoader()
    print(f"   Device: {loader.device}")
    print(f"   Checkpointing enabled: {settings.enable_checkpointing}")
    print(f"   Checkpoint dir: {settings.checkpoint_dir}")

    # Check if checkpoint already exists
    checkpoint_path = loader._get_checkpoint_path(model_id)
    checkpoint_exists = checkpoint_path.exists()
    print(f"\n2. Checking for existing checkpoint...")
    print(f"   Checkpoint path: {checkpoint_path}")
    print(f"   Checkpoint exists: {checkpoint_exists}")

    if checkpoint_exists:
        # Delete checkpoint to test full flow
        print(f"\n   Deleting existing checkpoint to test full flow...")
        checkpoint_path.unlink()
        meta_path = loader._get_checkpoint_meta_path(model_id)
        if meta_path.exists():
            meta_path.unlink()
        print(f"   ✓ Checkpoint deleted")

    # First load: Should load from PyTorch Hub and save checkpoint
    print(f"\n3. Loading model (first time - from PyTorch Hub)...")
    start = time.time()
    encoder = loader.load_model(model_id)
    first_load_time = time.time() - start
    print(f"   ✓ Model loaded in {first_load_time:.1f}s")
    print(f"   Encoder params: {sum(p.numel() for p in encoder.parameters())/1e6:.1f}M")

    # Check checkpoint was created
    checkpoint_exists_after = checkpoint_path.exists()
    meta_path = loader._get_checkpoint_meta_path(model_id)
    meta_exists = meta_path.exists()
    print(f"\n4. Verifying checkpoint was saved...")
    print(f"   Checkpoint exists: {checkpoint_exists_after}")
    print(f"   Metadata exists: {meta_exists}")
    if checkpoint_exists_after:
        size_mb = checkpoint_path.stat().st_size / (1024 ** 2)
        print(f"   Checkpoint size: {size_mb:.1f} MB")

    # Unload model
    print(f"\n5. Unloading model...")
    loader.unload_model()
    print(f"   ✓ Model unloaded")

    # Second load: Should load from checkpoint (much faster)
    print(f"\n6. Loading model (second time - from checkpoint)...")
    start = time.time()
    encoder = loader.load_model(model_id)
    second_load_time = time.time() - start
    print(f"   ✓ Model loaded in {second_load_time:.1f}s")

    # Calculate speedup
    speedup = first_load_time / second_load_time if second_load_time > 0 else 0
    time_saved = first_load_time - second_load_time

    print(f"\n" + "=" * 60)
    print(f"RESULTS")
    print(f"=" * 60)
    print(f"First load (PyTorch Hub):  {first_load_time:.1f}s")
    print(f"Second load (Checkpoint):  {second_load_time:.1f}s")
    print(f"Speedup:                   {speedup:.1f}x")
    print(f"Time saved:                {time_saved:.1f}s")
    print(f"=" * 60)

    # Expected results based on Phase 1 plan:
    # - First load: 60-180s (1-3 min)
    # - Second load: 16-30s
    # - Speedup: 3-5x

    if speedup >= 2.0:
        print(f"\n✅ SUCCESS: Checkpoint loading is {speedup:.1f}x faster!")
    else:
        print(f"\n⚠️  WARNING: Checkpoint loading is only {speedup:.1f}x faster (expected 2x+)")

    # Cleanup
    loader.unload_model()

    return {
        "first_load_time": first_load_time,
        "second_load_time": second_load_time,
        "speedup": speedup,
        "time_saved": time_saved,
    }


if __name__ == "__main__":
    try:
        results = test_checkpoint_save_load()
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
