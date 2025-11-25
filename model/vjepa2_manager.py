"""
V-JEPA2 Action-Conditioned Model Manager

This module provides a high-level interface for loading and managing the V-JEPA2
Action-Conditioned (AC) model, which includes both an encoder and a predictor.
"""

import torch
from typing import Optional, Tuple, Any, Dict, Callable
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VJEPA2ACModelManager:
    """
    Manager class for V-JEPA2 Action-Conditioned model.

    This class handles:
    - Loading encoder and predictor models
    - Device management (CPU/CUDA)
    - Model inference
    - Memory management and cleanup

    Attributes:
        encoder: The video encoder model
        predictor: The action-conditioned predictor
        processor: Video preprocessing pipeline
        device: Device where models are loaded (cuda/cpu)
        model_variant: Name of the loaded model variant
    """

    def __init__(
        self,
        model_variant: str = "vjepa2_ac_vit_giant",
        device: Optional[str] = None,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize the V-JEPA2 AC Model Manager.

        Args:
            model_variant: Model variant to load (default: vjepa2_ac_vit_giant)
            device: Device to load model on ('cuda', 'cpu', or None for auto-detect)
            cache_dir: Directory to cache downloaded models
        """
        self.model_variant = model_variant
        self.cache_dir = cache_dir

        # Auto-detect device if not specified
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        # Model components (to be loaded)
        self.encoder: Optional[Any] = None
        self.predictor: Optional[Any] = None
        self.processor: Optional[Any] = None

        # Model state
        self._is_loaded = False
        self._loading_callbacks: list[Callable[[str, int], None]] = []

        logger.info(f"Initialized VJEPA2ACModelManager with device: {self.device}")

    def add_loading_callback(self, callback: Callable[[str, int], None]) -> None:
        """
        Add a callback function to receive loading progress updates.

        Args:
            callback: Function that accepts (message: str, progress: int)
        """
        self._loading_callbacks.append(callback)

    def _notify_progress(self, message: str, progress: int) -> None:
        """Notify all registered callbacks of loading progress."""
        for callback in self._loading_callbacks:
            try:
                callback(message, progress)
            except Exception as e:
                logger.error(f"Error in loading callback: {e}")

    def load_model(self) -> None:
        """
        Load the V-JEPA2 Action-Conditioned model.

        Raises:
            RuntimeError: If model loading fails
        """
        if self._is_loaded:
            logger.warning("Model already loaded")
            return

        try:
            logger.info(f"Loading {self.model_variant} model...")
            self._notify_progress("Initializing model loader", 10)

            # Load preprocessor
            self._notify_progress("Loading video preprocessor", 20)
            self.processor = torch.hub.load(
                'facebookresearch/vjepa2',
                'vjepa2_preprocessor',
                force_reload=False
            )

            # Load encoder and predictor
            self._notify_progress("Loading encoder and predictor", 40)
            self.encoder, self.predictor = torch.hub.load(
                'facebookresearch/vjepa2',
                self.model_variant,
                force_reload=False
            )

            # Move to device
            self._notify_progress(f"Moving models to {self.device}", 70)
            self.encoder = self.encoder.to(self.device)
            self.predictor = self.predictor.to(self.device)

            # Set to eval mode
            self.encoder.eval()
            self.predictor.eval()

            self._is_loaded = True
            self._notify_progress("Model loaded successfully", 100)
            logger.info(f"Successfully loaded {self.model_variant} on {self.device}")

        except Exception as e:
            self._is_loaded = False
            logger.error(f"Failed to load model: {e}")
            raise RuntimeError(f"Model loading failed: {e}")

    def encode_video(
        self,
        video_frames: torch.Tensor,
        return_attention: bool = False
    ) -> Tuple[torch.Tensor, Optional[torch.Tensor]]:
        """
        Encode video frames using the encoder.

        Args:
            video_frames: Tensor of shape (B, T, C, H, W) where:
                B = batch size
                T = temporal frames
                C = channels (3 for RGB)
                H, W = height, width
            return_attention: Whether to return attention weights

        Returns:
            Tuple of (embeddings, attention_weights)
            - embeddings: Video embeddings of shape (B, D)
            - attention_weights: Attention weights if requested, else None

        Raises:
            RuntimeError: If model not loaded or encoding fails
        """
        if not self._is_loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        try:
            with torch.no_grad():
                video_frames = video_frames.to(self.device)

                if return_attention:
                    embeddings, attention = self.encoder(
                        video_frames,
                        return_attention=True
                    )
                    return embeddings, attention
                else:
                    embeddings = self.encoder(video_frames)
                    return embeddings, None

        except Exception as e:
            logger.error(f"Video encoding failed: {e}")
            raise RuntimeError(f"Encoding error: {e}")

    def predict_with_action(
        self,
        video_embeddings: torch.Tensor,
        action_sequence: torch.Tensor
    ) -> torch.Tensor:
        """
        Predict future video representations conditioned on actions.

        Args:
            video_embeddings: Encoded video features from encoder
            action_sequence: Action sequence tensor

        Returns:
            Predicted future video representations

        Raises:
            RuntimeError: If model not loaded or prediction fails
        """
        if not self._is_loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        try:
            with torch.no_grad():
                video_embeddings = video_embeddings.to(self.device)
                action_sequence = action_sequence.to(self.device)

                predictions = self.predictor(video_embeddings, action_sequence)
                return predictions

        except Exception as e:
            logger.error(f"Action-conditioned prediction failed: {e}")
            raise RuntimeError(f"Prediction error: {e}")

    def preprocess_video(
        self,
        video_path: str,
        num_frames: int = 16
    ) -> torch.Tensor:
        """
        Preprocess video file for model input.

        Args:
            video_path: Path to video file
            num_frames: Number of frames to sample

        Returns:
            Preprocessed video tensor ready for model

        Raises:
            RuntimeError: If preprocessing fails
        """
        if not self._is_loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        try:
            # Use the processor to load and preprocess video
            video_tensor = self.processor(video_path, num_frames=num_frames)
            return video_tensor

        except Exception as e:
            logger.error(f"Video preprocessing failed: {e}")
            raise RuntimeError(f"Preprocessing error: {e}")

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the loaded model.

        Returns:
            Dictionary containing model information
        """
        info = {
            "model_variant": self.model_variant,
            "device": str(self.device),
            "is_loaded": self._is_loaded,
            "cache_dir": self.cache_dir,
        }

        if self._is_loaded:
            info.update({
                "encoder_parameters": sum(
                    p.numel() for p in self.encoder.parameters()
                ),
                "predictor_parameters": sum(
                    p.numel() for p in self.predictor.parameters()
                ),
                "total_parameters": sum(
                    p.numel() for p in self.encoder.parameters()
                ) + sum(
                    p.numel() for p in self.predictor.parameters()
                ),
            })

        return info

    def unload(self) -> None:
        """
        Unload the model and free GPU memory.
        """
        if not self._is_loaded:
            logger.warning("Model not loaded, nothing to unload")
            return

        logger.info("Unloading model...")

        # Delete models
        if self.encoder is not None:
            del self.encoder
            self.encoder = None

        if self.predictor is not None:
            del self.predictor
            self.predictor = None

        if self.processor is not None:
            del self.processor
            self.processor = None

        # Clear CUDA cache if using GPU
        if self.device.type == "cuda":
            torch.cuda.empty_cache()

        self._is_loaded = False
        logger.info("Model unloaded successfully")

    def __enter__(self):
        """Context manager entry."""
        if not self._is_loaded:
            self.load_model()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.unload()

    def __del__(self):
        """Cleanup on deletion."""
        if self._is_loaded:
            self.unload()

    @property
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._is_loaded


# Example usage
if __name__ == "__main__":
    # Example 1: Basic usage
    manager = VJEPA2ACModelManager(device="cuda")

    # Add progress callback
    def progress_callback(message: str, progress: int):
        print(f"[{progress}%] {message}")

    manager.add_loading_callback(progress_callback)

    # Load model
    manager.load_model()

    # Get model info
    info = manager.get_model_info()
    print(f"\nModel Info:")
    for key, value in info.items():
        print(f"  {key}: {value}")

    # Example 2: Context manager usage
    print("\n--- Using context manager ---")
    with VJEPA2ACModelManager() as manager:
        print(f"Model loaded: {manager.is_loaded}")
        info = manager.get_model_info()
        print(f"Total parameters: {info.get('total_parameters', 'N/A'):,}")

    print("Done!")
