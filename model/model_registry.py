"""
V-JEPA2 Model Registry

Central registry for all available V-JEPA2 model variants with their specifications.
"""

from dataclasses import dataclass
from typing import Dict, List
from enum import Enum


class ModelType(str, Enum):
    """Model type classification."""
    STANDARD = "standard"
    ACTION_CONDITIONED = "action_conditioned"


@dataclass
class ModelSpec:
    """Specification for a V-JEPA2 model variant."""
    id: str
    name: str
    type: ModelType
    parameters: str
    resolution: int
    hub_name: str  # PyTorch Hub model name
    description: str
    use_cases: List[str]


class VJEPA2ModelRegistry:
    """
    Registry of all available V-JEPA2 models.

    This centralized registry makes it easy to discover and access
    different model variants programmatically.
    """

    # Standard (Non-AC) Models
    STANDARD_MODELS: Dict[str, ModelSpec] = {
        "vit_large": ModelSpec(
            id="vit_large",
            name="V-JEPA2 ViT-Large",
            type=ModelType.STANDARD,
            parameters="300M",
            resolution=256,
            hub_name="vjepa2_vit_large",
            description="Lightweight model for faster inference",
            use_cases=["Video classification", "Feature extraction", "Transfer learning"]
        ),
        "vit_huge": ModelSpec(
            id="vit_huge",
            name="V-JEPA2 ViT-Huge",
            type=ModelType.STANDARD,
            parameters="600M",
            resolution=256,
            hub_name="vjepa2_vit_huge",
            description="Balanced model with good accuracy/speed tradeoff",
            use_cases=["Video understanding", "Action recognition", "Temporal modeling"]
        ),
        "vit_giant": ModelSpec(
            id="vit_giant",
            name="V-JEPA2 ViT-Giant",
            type=ModelType.STANDARD,
            parameters="1B",
            resolution=256,
            hub_name="vjepa2_vit_giant",
            description="Largest standard model for best accuracy",
            use_cases=["Research", "Benchmarking", "High-accuracy applications"]
        ),
        "vit_giant_384": ModelSpec(
            id="vit_giant_384",
            name="V-JEPA2 ViT-Giant 384",
            type=ModelType.STANDARD,
            parameters="1B",
            resolution=384,
            hub_name="vjepa2_vit_giant_384",
            description="High-resolution variant for fine-grained video analysis",
            use_cases=["High-resolution video", "Fine-grained action recognition", "Detailed analysis"]
        ),
    }

    # Action-Conditioned Models
    ACTION_CONDITIONED_MODELS: Dict[str, ModelSpec] = {
        "ac_vit_large": ModelSpec(
            id="ac_vit_large",
            name="V-JEPA2 AC ViT-Large",
            type=ModelType.ACTION_CONDITIONED,
            parameters="300M",
            resolution=256,
            hub_name="vjepa2_ac_vit_large",
            description="Action-conditioned model for prediction with actions (if available)",
            use_cases=["Action prediction", "Robot learning", "Video forecasting"]
        ),
        "ac_vit_huge": ModelSpec(
            id="ac_vit_huge",
            name="V-JEPA2 AC ViT-Huge",
            type=ModelType.ACTION_CONDITIONED,
            parameters="600M",
            resolution=256,
            hub_name="vjepa2_ac_vit_huge",
            description="Medium AC model (if available)",
            use_cases=["Action-conditioned prediction", "Policy learning", "Video synthesis"]
        ),
        "ac_vit_giant": ModelSpec(
            id="ac_vit_giant",
            name="V-JEPA2 AC ViT-Giant",
            type=ModelType.ACTION_CONDITIONED,
            parameters="1B",
            resolution=256,
            hub_name="vjepa2_ac_vit_giant",
            description="Largest action-conditioned model (CONFIRMED AVAILABLE)",
            use_cases=["Complex action prediction", "Embodied AI", "Advanced robotics"]
        ),
        "ac_vit_giant_384": ModelSpec(
            id="ac_vit_giant_384",
            name="V-JEPA2 AC ViT-Giant 384",
            type=ModelType.ACTION_CONDITIONED,
            parameters="1B",
            resolution=384,
            hub_name="vjepa2_ac_vit_giant_384",
            description="High-res action-conditioned model (if available)",
            use_cases=["High-resolution action prediction", "Precision robotics", "Detailed forecasting"]
        ),
    }

    @classmethod
    def get_all_models(cls) -> Dict[str, ModelSpec]:
        """Get all available models."""
        return {**cls.STANDARD_MODELS, **cls.ACTION_CONDITIONED_MODELS}

    @classmethod
    def get_ac_models(cls) -> Dict[str, ModelSpec]:
        """Get only action-conditioned models."""
        return cls.ACTION_CONDITIONED_MODELS

    @classmethod
    def get_standard_models(cls) -> Dict[str, ModelSpec]:
        """Get only standard (non-AC) models."""
        return cls.STANDARD_MODELS

    @classmethod
    def get_model_by_id(cls, model_id: str) -> ModelSpec:
        """
        Get model specification by ID.

        Args:
            model_id: Model identifier (e.g., 'ac_vit_giant')

        Returns:
            ModelSpec for the requested model

        Raises:
            KeyError: If model ID not found
        """
        all_models = cls.get_all_models()
        if model_id not in all_models:
            available = ", ".join(all_models.keys())
            raise KeyError(
                f"Model '{model_id}' not found. Available models: {available}"
            )
        return all_models[model_id]

    @classmethod
    def get_models_by_size(cls, parameters: str) -> List[ModelSpec]:
        """
        Get all models of a specific parameter size.

        Args:
            parameters: Parameter size (e.g., '300M', '1B')

        Returns:
            List of ModelSpec matching the size
        """
        return [
            spec for spec in cls.get_all_models().values()
            if spec.parameters == parameters
        ]

    @classmethod
    def get_models_by_resolution(cls, resolution: int) -> List[ModelSpec]:
        """
        Get all models of a specific resolution.

        Args:
            resolution: Resolution size (e.g., 256, 384)

        Returns:
            List of ModelSpec matching the resolution
        """
        return [
            spec for spec in cls.get_all_models().values()
            if spec.resolution == resolution
        ]

    @classmethod
    def list_model_ids(cls, model_type: ModelType = None) -> List[str]:
        """
        List all model IDs, optionally filtered by type.

        Args:
            model_type: Filter by model type (optional)

        Returns:
            List of model IDs
        """
        all_models = cls.get_all_models()

        if model_type is None:
            return list(all_models.keys())

        return [
            model_id for model_id, spec in all_models.items()
            if spec.type == model_type
        ]

    @classmethod
    def print_model_summary(cls):
        """Print a summary of all available models."""
        print("=" * 80)
        print("V-JEPA2 Model Registry")
        print("=" * 80)

        print("\n📊 STANDARD MODELS:")
        print("-" * 80)
        for model_id, spec in cls.STANDARD_MODELS.items():
            print(f"\n{spec.name} ({model_id})")
            print(f"  Parameters: {spec.parameters}")
            print(f"  Resolution: {spec.resolution}px")
            print(f"  Hub Name: {spec.hub_name}")
            print(f"  Description: {spec.description}")

        print("\n\n🎯 ACTION-CONDITIONED MODELS:")
        print("-" * 80)
        for model_id, spec in cls.ACTION_CONDITIONED_MODELS.items():
            confirmed = " ✓ CONFIRMED" if model_id == "ac_vit_giant" else " (needs verification)"
            print(f"\n{spec.name} ({model_id}){confirmed}")
            print(f"  Parameters: {spec.parameters}")
            print(f"  Resolution: {spec.resolution}px")
            print(f"  Hub Name: {spec.hub_name}")
            print(f"  Description: {spec.description}")

        print("\n" + "=" * 80)
        print(f"Total models: {len(cls.get_all_models())}")
        print(f"AC models: {len(cls.ACTION_CONDITIONED_MODELS)}")
        print(f"Standard models: {len(cls.STANDARD_MODELS)}")
        print("=" * 80)


# Example usage
if __name__ == "__main__":
    registry = VJEPA2ModelRegistry()

    # Print full summary
    registry.print_model_summary()

    # Get specific model
    print("\n\n🔍 Getting specific model:")
    ac_giant = registry.get_model_by_id("ac_vit_giant")
    print(f"Model: {ac_giant.name}")
    print(f"Use cases: {', '.join(ac_giant.use_cases)}")

    # List all AC model IDs
    print("\n\n📋 All AC model IDs:")
    ac_ids = registry.list_model_ids(ModelType.ACTION_CONDITIONED)
    for model_id in ac_ids:
        print(f"  - {model_id}")

    # Get models by size
    print("\n\n📏 All 1B parameter models:")
    large_models = registry.get_models_by_size("1B")
    for spec in large_models:
        print(f"  - {spec.name}")
