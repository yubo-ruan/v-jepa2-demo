"""RoboSuite simulator wrapper for V-JEPA2 action testing."""

import logging
import pickle
from typing import Dict, Any, List, Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class RoboSuiteSimulator:
    """
    Wrapper for RoboSuite simulator to test V-JEPA2 predicted actions.

    Converts V-JEPA2/DROID action format to RoboSuite OSC_POSE format.
    """

    def __init__(self):
        """Initialize the simulator wrapper (lazy loads robosuite)."""
        self.env = None
        self.task = None
        self._initialized = False

    def is_initialized(self) -> bool:
        """Check if the simulator is initialized."""
        return self._initialized and self.env is not None

    def initialize(self, task: str = "Lift") -> Image.Image:
        """
        Initialize the RoboSuite environment.

        Args:
            task: RoboSuite task name (e.g., "Lift", "Stack", "PickPlace")

        Returns:
            Initial observation image
        """
        try:
            import robosuite as suite
        except ImportError as e:
            logger.error(f"Failed to import robosuite: {e}")
            raise ImportError(
                "RoboSuite not installed. Install with: pip install robosuite mujoco"
            ) from e

        logger.info(f"[RoboSuiteSimulator] Initializing with task: {task}")

        # Close existing environment if any
        if self.env is not None:
            self.env.close()

        # Create environment (robosuite 1.5+ uses default controller config automatically)
        # The default Panda controller provides 7-DOF action space [-1, 1]
        self.env = suite.make(
            env_name=task,
            robots="Panda",
            has_renderer=False,
            has_offscreen_renderer=True,
            use_camera_obs=True,
            camera_names=["agentview"],
            camera_heights=256,
            camera_widths=256,
            control_freq=20,
            horizon=500,
        )

        self.task = task
        self._initialized = True

        # Reset and get initial observation
        obs = self.env.reset()

        logger.info("[RoboSuiteSimulator] Initialized successfully")

        return self._obs_to_image(obs)

    def reset(self) -> Image.Image:
        """
        Reset the environment to a new initial state.

        Returns:
            Initial observation image
        """
        if not self._initialized or self.env is None:
            raise RuntimeError("Simulator not initialized")

        obs = self.env.reset()
        logger.info("[RoboSuiteSimulator] Environment reset")

        return self._obs_to_image(obs)

    def execute_action(self, action: List[float]) -> Dict[str, Any]:
        """
        Execute a single action in the simulator.

        Args:
            action: 7-DOF action in V-JEPA2/DROID format:
                   [x, y, z, roll, pitch, yaw, gripper]
                   - Position deltas in meters (~[-0.05, 0.05])
                   - Rotation deltas in radians (~[-0.1, 0.1])
                   - Gripper: negative=open, positive=close (~[-0.75, 0.75])

        Returns:
            Dictionary with:
                - success: bool
                - image: PIL Image of resulting observation
                - robot_state: end-effector position [x, y, z]
                - gripper_state: gripper state
                - reward: float
                - done: bool
                - raw_action: original action
                - transformed_action: action sent to robosuite
        """
        if not self._initialized or self.env is None:
            raise RuntimeError("Simulator not initialized")

        # Convert action to numpy
        raw_action = list(action)
        action_np = np.array(action, dtype=np.float32)

        # Transform V-JEPA2/DROID action to RoboSuite OSC_POSE format
        transformed_action = self._transform_action(action_np)

        logger.debug(f"[RoboSuiteSimulator] Raw action: {raw_action}")
        logger.debug(f"[RoboSuiteSimulator] Transformed action: {transformed_action.tolist()}")

        # Execute action
        obs, reward, done, info = self.env.step(transformed_action)

        # Get robot state from observation
        robot_state = None
        gripper_state = None

        # End-effector position is available in observation
        if 'robot0_eef_pos' in obs:
            robot_state = obs['robot0_eef_pos'].copy()
        # Gripper state from observation
        if 'robot0_gripper_qpos' in obs:
            gripper_state = obs['robot0_gripper_qpos'].copy()

        return {
            "success": True,
            "image": self._obs_to_image(obs),
            "robot_state": robot_state,
            "gripper_state": gripper_state,
            "reward": float(reward),
            "done": bool(done),
            "raw_action": raw_action,
            "transformed_action": transformed_action.tolist(),
        }

    def _transform_action(self, action: np.ndarray) -> np.ndarray:
        """
        Transform V-JEPA2/DROID action format to RoboSuite OSC_POSE format.

        V-JEPA2/DROID format (7-DOF):
            [x, y, z, roll, pitch, yaw, gripper]
            - Position deltas in meters
            - Rotation deltas in radians
            - Gripper: [-1, 1] where -1=open, 1=close

        RoboSuite OSC_POSE format (7-DOF):
            [x, y, z, ax, ay, az, gripper]
            - Position deltas (scaled for controller)
            - Axis-angle rotation deltas
            - Gripper: [-1, 1] where -1=open, 1=close

        Args:
            action: 7-DOF action in V-JEPA2/DROID format

        Returns:
            7-DOF action in RoboSuite format
        """
        # Extract components
        pos_delta = action[:3]  # x, y, z position deltas
        rot_delta = action[3:6]  # roll, pitch, yaw rotation deltas
        gripper = action[6]  # gripper command

        # Scale position deltas for RoboSuite controller
        # V-JEPA2 outputs small deltas (~0.01-0.05), RoboSuite expects similar scale
        pos_scaled = pos_delta * 1.0  # Adjust scale if needed

        # Convert Euler angles (roll, pitch, yaw) to axis-angle representation
        # For small angles, axis-angle ≈ [roll, pitch, yaw]
        # This is a simplification that works for small rotations
        rot_axis_angle = rot_delta * 1.0  # Adjust scale if needed

        # Normalize gripper to [-1, 1] range
        # V-JEPA2: negative=open, positive=close
        # RoboSuite: -1=open, 1=close
        gripper_normalized = np.clip(gripper, -1.0, 1.0)

        # Combine into RoboSuite action
        robosuite_action = np.concatenate([
            pos_scaled,
            rot_axis_angle,
            [gripper_normalized]
        ])

        return robosuite_action

    def _obs_to_image(self, obs: Dict[str, Any]) -> Image.Image:
        """
        Extract camera image from observation.

        Args:
            obs: RoboSuite observation dictionary

        Returns:
            PIL Image
        """
        # Get the camera observation
        if "agentview_image" in obs:
            img_array = obs["agentview_image"]
        elif "image" in obs:
            img_array = obs["image"]
        else:
            # Try to find any image key
            for key in obs:
                if "image" in key.lower():
                    img_array = obs[key]
                    break
            else:
                raise ValueError(f"No image found in observation. Keys: {list(obs.keys())}")

        # Convert to PIL Image
        # RoboSuite returns images with origin at bottom-left, so flip vertically
        img_array = np.flipud(img_array)

        return Image.fromarray(img_array.astype(np.uint8))

    def save_state(self) -> bytes:
        """
        Save current simulator state to bytes (for download).

        Returns:
            bytes: Pickled state data containing:
                - sim_state: MuJoCo qpos, qvel, act, time
                - rng_state: NumPy RNG state for reproducibility
                - task: Current task name

        Raises:
            RuntimeError: If simulator is not initialized
        """
        if self.env is None or not self._initialized:
            raise RuntimeError("Simulator not initialized")

        sim_state = self.env.sim.get_state()
        rng_state = None
        if hasattr(self.env, "np_random") and self.env.np_random is not None:
            rng_state = self.env.np_random.bit_generator.state

        payload = {
            "sim_state": sim_state,
            "rng_state": rng_state,
            "task": self.task,
        }

        logger.info(f"[RoboSuiteSimulator] Saving state for task: {self.task}")
        return pickle.dumps(payload)

    def load_state(self, state_data: bytes) -> Image.Image:
        """
        Load simulator state from bytes.

        Args:
            state_data: Pickled state data from save_state()

        Returns:
            PIL Image of the restored state

        Raises:
            RuntimeError: If state data is invalid
        """
        payload = pickle.loads(state_data)

        sim_state = payload["sim_state"]
        rng_state = payload.get("rng_state")
        task = payload.get("task", "Lift")

        logger.info(f"[RoboSuiteSimulator] Loading state for task: {task}")

        # Reinitialize env if needed (must match original config)
        if self.env is None or self.task != task:
            logger.info(f"[RoboSuiteSimulator] Reinitializing environment for task: {task}")
            self.initialize(task=task)

        # Restore MuJoCo sim state
        self.env.sim.set_state(sim_state)
        self.env.sim.forward()  # Recompute derived quantities

        # Restore RNG if saved
        if rng_state is not None and hasattr(self.env, "np_random") and self.env.np_random is not None:
            self.env.np_random.bit_generator.state = rng_state

        logger.info("[RoboSuiteSimulator] State restored successfully")

        # After restoring state, we need to properly update the rendering context.
        # The safest way is to take a zero-action step which properly syncs everything.
        # This ensures the offscreen renderer buffer is properly populated.
        zero_action = np.zeros(self.env.action_dim)
        obs, _, _, _ = self.env.step(zero_action)

        # Now restore the state again (the step may have slightly changed it)
        self.env.sim.set_state(sim_state)
        self.env.sim.forward()

        # Get the final observation with properly rendered image
        obs = self.env._get_observations()
        return self._obs_to_image(obs)

    def close(self):
        """Close the simulator and release resources."""
        import gc

        if self.env is not None:
            self.env.close()
            self.env = None
        self._initialized = False
        self.task = None

        # Aggressive memory cleanup after closing simulator
        # MuJoCo can hold significant memory that needs to be released
        gc.collect()
        gc.collect()  # Second pass for cyclic references

        logger.info("[RoboSuiteSimulator] Closed and memory cleaned")
