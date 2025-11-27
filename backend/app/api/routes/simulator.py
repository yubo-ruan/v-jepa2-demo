"""RoboSuite simulator API routes for testing."""

import io
import logging
import base64
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulator", tags=["simulator"])

# Global simulator instance (lazy loaded)
_simulator = None
_simulator_initialized = False


class SimulatorStepRequest(BaseModel):
    """Request to execute a single action in the simulator."""
    action: List[float] = Field(
        ...,
        min_length=7,
        max_length=7,
        description="7-DOF action: [x, y, z, roll, pitch, yaw, gripper]"
    )


class SimulatorStepResponse(BaseModel):
    """Response from simulator step."""
    success: bool
    image_base64: str  # Base64 encoded JPEG image
    robot_state: Optional[List[float]] = None  # End-effector position [x, y, z]
    gripper_state: Optional[List[float]] = None
    reward: float = 0.0
    done: bool = False
    raw_action: List[float]
    transformed_action: List[float]
    message: str = ""


class SimulatorStatusResponse(BaseModel):
    """Response for simulator status."""
    initialized: bool
    available: bool
    error: Optional[str] = None


def get_simulator():
    """Get or create the RoboSuite simulator instance."""
    global _simulator, _simulator_initialized

    if _simulator is None:
        try:
            # Import here to avoid startup issues if robosuite not installed
            from app.services.robosuite_sim import RoboSuiteSimulator
            _simulator = RoboSuiteSimulator()
            logger.info("[Simulator] Created RoboSuiteSimulator instance")
        except ImportError as e:
            logger.error(f"[Simulator] Failed to import RoboSuiteSimulator: {e}")
            raise HTTPException(
                status_code=503,
                detail="RoboSuite not installed. Install with: pip install robosuite mujoco scipy"
            )

    return _simulator


@router.get("/status", response_model=SimulatorStatusResponse)
async def get_simulator_status():
    """Check if the simulator is available and initialized."""
    try:
        sim = get_simulator()
        return SimulatorStatusResponse(
            initialized=sim.is_initialized(),
            available=True,
            error=None
        )
    except HTTPException as e:
        return SimulatorStatusResponse(
            initialized=False,
            available=False,
            error=e.detail
        )
    except Exception as e:
        return SimulatorStatusResponse(
            initialized=False,
            available=False,
            error=str(e)
        )


@router.post("/init")
async def initialize_simulator(task: str = "Lift"):
    """
    Initialize the RoboSuite simulator.

    Args:
        task: RoboSuite task name (default: "Lift")

    Returns:
        Initial observation image (base64 encoded)
    """
    global _simulator_initialized

    logger.info(f"[Simulator] Initializing with task: {task}")

    try:
        sim = get_simulator()

        # Initialize the environment
        initial_image = sim.initialize(task=task)
        _simulator_initialized = True

        # Convert PIL Image to base64
        buffer = io.BytesIO()
        initial_image.save(buffer, format="JPEG", quality=90)
        image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        logger.info("[Simulator] Initialized successfully")

        return {
            "success": True,
            "image_base64": image_base64,
            "message": f"Simulator initialized with {task} task"
        }

    except Exception as e:
        logger.error(f"[Simulator] Initialization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize simulator: {str(e)}")


@router.post("/step", response_model=SimulatorStepResponse)
async def step_simulator(request: SimulatorStepRequest):
    """
    Execute a single action in the simulator and return the resulting observation.

    Action format (V-JEPA2/DROID style):
    - action[0-2]: Position delta (x, y, z) in meters, range ~[-0.05, 0.05]
    - action[3-5]: Rotation delta (roll, pitch, yaw) in radians, range ~[-0.1, 0.1]
    - action[6]: Gripper command, range ~[-0.75, 0.75] (negative=open, positive=close)

    When the episode ends (done=True), the environment is automatically reset.
    """
    logger.info(f"[Simulator] Step request with action: {request.action}")

    try:
        sim = get_simulator()

        if not sim.is_initialized():
            raise HTTPException(
                status_code=400,
                detail="Simulator not initialized. Call /simulator/init first."
            )

        # Execute the action
        result = sim.execute_action(request.action)

        # Convert PIL Image to base64
        buffer = io.BytesIO()
        result["image"].save(buffer, format="JPEG", quality=90)
        image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        message = "Action executed successfully"

        # Auto-reset if episode is done (horizon reached or task completed)
        if result["done"]:
            logger.info("[Simulator] Episode done, auto-resetting environment")
            reset_image = sim.reset()
            # Use the reset image instead
            buffer = io.BytesIO()
            reset_image.save(buffer, format="JPEG", quality=90)
            image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
            message = "Episode ended (horizon reached). Environment auto-reset."

        logger.info(f"[Simulator] Step completed, reward: {result['reward']}, done: {result['done']}")

        return SimulatorStepResponse(
            success=result["success"],
            image_base64=image_base64,
            robot_state=result["robot_state"].tolist() if result["robot_state"] is not None else None,
            gripper_state=result["gripper_state"].tolist() if result["gripper_state"] is not None else None,
            reward=result["reward"],
            done=result["done"],
            raw_action=result["raw_action"],
            transformed_action=result["transformed_action"],
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Simulator] Step failed: {e}")
        raise HTTPException(status_code=500, detail=f"Simulator step failed: {str(e)}")


@router.post("/reset")
async def reset_simulator():
    """
    Reset the simulator to a new random initial state.

    Returns:
        New initial observation image (base64 encoded)
    """
    logger.info("[Simulator] Reset request")

    try:
        sim = get_simulator()

        if not sim.is_initialized():
            raise HTTPException(
                status_code=400,
                detail="Simulator not initialized. Call /simulator/init first."
            )

        # Reset the environment
        initial_image = sim.reset()

        # Convert PIL Image to base64
        buffer = io.BytesIO()
        initial_image.save(buffer, format="JPEG", quality=90)
        image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        logger.info("[Simulator] Reset completed")

        return {
            "success": True,
            "image_base64": image_base64,
            "message": "Simulator reset to new initial state"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Simulator] Reset failed: {e}")
        raise HTTPException(status_code=500, detail=f"Simulator reset failed: {str(e)}")


@router.post("/close")
async def close_simulator():
    """Close the simulator and release resources."""
    global _simulator, _simulator_initialized

    logger.info("[Simulator] Close request")

    if _simulator is not None:
        _simulator.close()
        _simulator = None
        _simulator_initialized = False
        logger.info("[Simulator] Closed successfully")

    return {"success": True, "message": "Simulator closed"}
