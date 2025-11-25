"""
V-JEPA2 Model Loading Script

This script demonstrates how to load Meta's V-JEPA2 (Video Joint Embedding Predictive Architecture 2)
model using either PyTorch Hub or HuggingFace Transformers.

Requirements:
    pip install torch torchvision timm einops transformers

For video processing (optional):
    pip install decord  # Note: decord doesn't support macOS, use eva-decord or decord2 instead
"""

import argparse
from typing import Tuple, Any


def load_vjepa2_pytorch_hub(model_variant: str = "vjepa2_vit_giant") -> Tuple[Any, Any]:
    """
    Load V-JEPA2 model using PyTorch Hub.

    Args:
        model_variant: One of:
            - 'vjepa2_vit_large' (300M params, 256 resolution)
            - 'vjepa2_vit_huge' (600M params, 256 resolution)
            - 'vjepa2_vit_giant' (1B params, 256 resolution)
            - 'vjepa2_vit_giant_384' (1B params, 384 resolution)
            - 'vjepa2_ac_vit_giant' (Action-Conditioned model)

    Returns:
        Tuple of (model, preprocessor) or (encoder, ac_predictor) for AC variant
    """
    import torch

    print(f"Loading V-JEPA2 model '{model_variant}' via PyTorch Hub...")

    # Load preprocessor
    processor = torch.hub.load('facebookresearch/vjepa2', 'vjepa2_preprocessor')

    # Load model
    if model_variant == 'vjepa2_ac_vit_giant':
        # Action-Conditioned model returns encoder and predictor
        encoder, ac_predictor = torch.hub.load(
            'facebookresearch/vjepa2',
            model_variant
        )
        print("Loaded Action-Conditioned V-JEPA2 (encoder + predictor)")
        return (encoder, ac_predictor), processor
    else:
        model = torch.hub.load('facebookresearch/vjepa2', model_variant)
        print(f"Loaded V-JEPA2 model: {model_variant}")
        return model, processor


def load_vjepa2_huggingface(model_name: str = "facebook/vjepa2-vitg-fpc64-256") -> Tuple[Any, Any]:
    """
    Load V-JEPA2 model using HuggingFace Transformers.

    Args:
        model_name: HuggingFace model identifier. Options include:
            - 'facebook/vjepa2-vitl-fpc64-256' (ViT-Large, 256 resolution)
            - 'facebook/vjepa2-vith-fpc64-256' (ViT-Huge, 256 resolution)
            - 'facebook/vjepa2-vitg-fpc64-256' (ViT-Giant, 256 resolution)
            - 'facebook/vjepa2-vitg-fpc64-384' (ViT-Giant, 384 resolution)

    Returns:
        Tuple of (model, processor)
    """
    from transformers import AutoVideoProcessor, AutoModel

    print(f"Loading V-JEPA2 model '{model_name}' via HuggingFace...")

    model = AutoModel.from_pretrained(model_name)
    processor = AutoVideoProcessor.from_pretrained(model_name)

    print(f"Loaded V-JEPA2 model from HuggingFace: {model_name}")
    return model, processor


def main():
    parser = argparse.ArgumentParser(description="Load V-JEPA2 model")
    parser.add_argument(
        "--method",
        type=str,
        choices=["pytorch_hub", "huggingface"],
        default="huggingface",
        help="Loading method (default: huggingface)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Model variant to load. For PyTorch Hub: vjepa2_vit_large, vjepa2_vit_huge, "
             "vjepa2_vit_giant, vjepa2_vit_giant_384, vjepa2_ac_vit_giant. "
             "For HuggingFace: facebook/vjepa2-vitg-fpc64-256, etc."
    )
    parser.add_argument(
        "--device",
        type=str,
        default="cuda",
        help="Device to load model on (default: cuda)"
    )

    args = parser.parse_args()

    # Set default model based on method
    if args.model is None:
        if args.method == "pytorch_hub":
            args.model = "vjepa2_vit_giant"
        else:
            args.model = "facebook/vjepa2-vitg-fpc64-256"

    # Load model
    if args.method == "pytorch_hub":
        model, processor = load_vjepa2_pytorch_hub(args.model)
    else:
        model, processor = load_vjepa2_huggingface(args.model)

    # Move to device if it's a single model (not AC tuple)
    import torch
    device = torch.device(args.device if torch.cuda.is_available() else "cpu")

    if isinstance(model, tuple):
        # Action-Conditioned model
        encoder, predictor = model
        encoder = encoder.to(device)
        predictor = predictor.to(device)
        print(f"Model moved to {device}")
        print(f"Encoder type: {type(encoder).__name__}")
        print(f"Predictor type: {type(predictor).__name__}")
    else:
        model = model.to(device)
        print(f"Model moved to {device}")
        print(f"Model type: {type(model).__name__}")

    print("\nV-JEPA2 model loaded successfully!")
    print("Ready for video encoding and classification tasks.")

    return model, processor


if __name__ == "__main__":
    main()
