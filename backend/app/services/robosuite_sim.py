"""RoboSuite simulator wrapper for V-JEPA2 action testing."""

import logging
import pickle
import hashlib
from typing import Dict, Any, List, Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def _compute_array_stats(arr: np.ndarray, label: str = "array") -> dict:
    """Compute diagnostic statistics for a numpy array."""
    nonzero_count = int(np.count_nonzero(arr))
    total = int(arr.size)
    return {
        "label": label,
        "shape": arr.shape,
        "dtype": str(arr.dtype),
        "min": float(arr.min()),
        "max": float(arr.max()),
        "mean": float(arr.mean()),
        "nonzero_pct": float(nonzero_count / total * 100) if total > 0 else 0,
        "md5": hashlib.md5(arr.tobytes()).hexdigest()[:12],
    }


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
        logger.info("[initialize] Calling env.reset()...")
        obs = self.env.reset()
        logger.info(f"[initialize] env.reset() completed, obs keys: {list(obs.keys())}")

        logger.info("[initialize] Converting observation to image...")
        image = self._obs_to_image(obs)
        logger.info(f"[initialize] Image created: size={image.size}, mode={image.mode}")

        logger.info("[RoboSuiteSimulator] Initialized successfully")
        return image

    def reset(self) -> Image.Image:
        """
        Reset the environment to a new initial state.

        Returns:
            Initial observation image
        """
        if not self._initialized or self.env is None:
            raise RuntimeError("Simulator not initialized")

        logger.info("[reset] Calling env.reset()...")
        obs = self.env.reset()
        logger.info(f"[reset] env.reset() completed, obs keys: {list(obs.keys())}")

        logger.info("[reset] Converting observation to image...")
        image = self._obs_to_image(obs)
        logger.info(f"[reset] Image created: size={image.size}, mode={image.mode}")

        logger.info("[RoboSuiteSimulator] Environment reset completed")
        return image

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

        logger.info(f"[execute_action] Raw action: {[f'{x:.4f}' for x in raw_action]}")
        logger.debug(f"[execute_action] Transformed action: {[f'{x:.4f}' for x in transformed_action.tolist()]}")

        # Execute action
        logger.info("[execute_action] Calling env.step()...")
        obs, reward, done, info = self.env.step(transformed_action)
        logger.info(f"[execute_action] env.step() completed, reward={reward:.4f}, done={done}")

        # Log observation keys for debugging
        obs_keys = list(obs.keys())
        image_keys = [k for k in obs_keys if 'image' in k.lower()]
        logger.debug(f"[execute_action] Observation keys: {obs_keys}")
        logger.info(f"[execute_action] Image keys in obs: {image_keys}")

        # Extract only the data we need (observation filtering for memory efficiency)
        # Don't keep reference to full obs dict
        robot_state = obs.get('robot0_eef_pos')
        if robot_state is not None:
            robot_state = robot_state.copy()
            logger.debug(f"[execute_action] Robot EEF pos: {[f'{x:.4f}' for x in robot_state]}")

        gripper_state = obs.get('robot0_gripper_qpos')
        if gripper_state is not None:
            gripper_state = gripper_state.copy()

        logger.info("[execute_action] Calling _obs_to_image()...")
        image = self._obs_to_image(obs)
        logger.info(f"[execute_action] _obs_to_image() returned PIL image: size={image.size}, mode={image.mode}")

        # Clear reference to obs dict
        del obs

        return {
            "success": True,
            "image": image,
            "robot_state": robot_state,
            "gripper_state": gripper_state,
            "reward": float(reward),
            "done": bool(done),
            "raw_action": raw_action,
            "transformed_action": transformed_action.tolist(),
        }

    def execute_action_batch(self, action: List[float], num_steps: int = 50) -> Dict[str, Any]:
        """
        Execute the same action for multiple steps, returning only the final observation.

        This implementation keeps camera observations enabled to avoid OpenGL context
        corruption that occurs when toggling use_camera_obs on/off. The overhead is
        minimal since we don't process the intermediate images.

        Args:
            action: 7-DOF action in V-JEPA2/DROID format
            num_steps: Number of simulation steps to execute (default: 50)

        Returns:
            Dictionary with final state after all steps
        """
        import gc

        if not self._initialized or self.env is None:
            raise RuntimeError("Simulator not initialized")

        # Convert action to numpy
        raw_action = list(action)
        action_np = np.array(action, dtype=np.float32)

        # Transform V-JEPA2/DROID action to RoboSuite OSC_POSE format
        transformed_action = self._transform_action(action_np)

        logger.info(f"[RoboSuiteSimulator] Executing {num_steps} steps with action: {raw_action[:3]}...")

        total_reward = 0.0
        done = False
        steps_executed = 0
        final_obs = None

        # Execute physics steps - keep camera observations enabled to avoid OpenGL corruption
        # Simply discard intermediate observations to minimize memory usage
        for i in range(num_steps):
            obs, reward, done, info = self.env.step(transformed_action)
            total_reward += reward
            steps_executed = i + 1

            # Keep only the final observation
            if i == num_steps - 1 or done:
                final_obs = obs
            else:
                # Discard intermediate observations
                del obs

            if done:
                logger.info(f"[RoboSuiteSimulator] Episode ended after {steps_executed} steps")
                break

            # Periodic garbage collection to prevent memory buildup
            if i > 0 and i % 25 == 0:
                gc.collect()

        # Extract data from final observation
        robot_state = final_obs.get('robot0_eef_pos')
        if robot_state is not None:
            robot_state = robot_state.copy()

        gripper_state = final_obs.get('robot0_gripper_qpos')
        if gripper_state is not None:
            gripper_state = gripper_state.copy()

        # Convert final observation to image
        image = self._obs_to_image(final_obs)

        # Clean up
        del final_obs
        gc.collect()

        logger.info(f"[RoboSuiteSimulator] Batch complete: {steps_executed} steps, total_reward={total_reward:.4f}")

        return {
            "success": True,
            "image": image,
            "robot_state": robot_state,
            "gripper_state": gripper_state,
            "reward": float(total_reward),
            "done": bool(done),
            "steps_executed": steps_executed,
            "raw_action": raw_action,
            "transformed_action": transformed_action.tolist(),
        }

    def _render_final_frame(self) -> Image.Image:
        """
        Render the current frame using MuJoCo's offscreen renderer directly.

        This bypasses robosuite's observation pipeline for a clean single render.
        """
        # Ensure physics is synced
        self.env.sim.forward()

        # Use MuJoCo's offscreen rendering directly
        # This is more reliable than going through robosuite's observation system
        img = self.env.sim.render(
            camera_name="agentview",
            width=256,
            height=256,
            depth=False,
        )

        # MuJoCo renders with origin at bottom-left, flip vertically
        img = np.flipud(img)

        return Image.fromarray(img.astype(np.uint8))

    def _render_current_frame(self) -> Image.Image:
        """
        Render the current frame with a fresh render context.

        This avoids OpenGL buffer corruption by explicitly updating the render context.
        """
        # Ensure physics state is synced
        self.env.sim.forward()

        # Get observation with fresh render
        obs = self.env._get_observations()
        image = self._obs_to_image(obs)

        # Clear obs reference
        del obs

        return image

    def _euler_to_axis_angle(self, roll: float, pitch: float, yaw: float) -> np.ndarray:
        """
        Convert Euler angles (roll, pitch, yaw) to axis-angle representation.

        Uses scipy's Rotation class for robust, well-tested conversion.
        The 'xyz' convention means intrinsic rotations: X (roll), Y (pitch), Z (yaw).

        Args:
            roll: Rotation about X-axis in radians
            pitch: Rotation about Y-axis in radians
            yaw: Rotation about Z-axis in radians

        Returns:
            3D axis-angle vector [ax, ay, az] where magnitude is the rotation angle
        """
        from scipy.spatial.transform import Rotation

        r = Rotation.from_euler('xyz', [roll, pitch, yaw])
        return r.as_rotvec()  # axis-angle representation

    def _transform_action(self, action: np.ndarray) -> np.ndarray:
        """
        Transform V-JEPA2/DROID action format to RoboSuite OSC_POSE format.

        V-JEPA2/DROID format (7-DOF):
            [x, y, z, roll, pitch, yaw, gripper]
            - Position deltas in meters
            - Rotation deltas in radians (Euler angles)
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
        rot_euler = action[3:6]  # roll, pitch, yaw rotation deltas (Euler angles)
        gripper = action[6]  # gripper command

        # Scale position deltas for RoboSuite controller
        # V-JEPA2 outputs small deltas (~0.01-0.05), RoboSuite expects similar scale
        pos_scaled = pos_delta * 1.0  # Adjust scale if needed

        # Convert Euler angles (roll, pitch, yaw) to axis-angle representation
        # This is the proper conversion for RoboSuite's OSC_POSE controller
        rot_axis_angle = self._euler_to_axis_angle(
            roll=rot_euler[0],
            pitch=rot_euler[1],
            yaw=rot_euler[2]
        )

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
        img_key = None
        if "agentview_image" in obs:
            img_key = "agentview_image"
            img_array = obs["agentview_image"]
        elif "image" in obs:
            img_key = "image"
            img_array = obs["image"]
        else:
            # Try to find any image key
            for key in obs:
                if "image" in key.lower():
                    img_key = key
                    img_array = obs[key]
                    break
            else:
                raise ValueError(f"No image found in observation. Keys: {list(obs.keys())}")

        # Log raw array stats BEFORE any processing
        raw_stats = _compute_array_stats(img_array, f"raw_{img_key}")
        is_corrupted = raw_stats["nonzero_pct"] < 5.0

        if is_corrupted:
            logger.warning(
                f"[_obs_to_image] ⚠️ RAW ARRAY CORRUPTED! key={img_key}, "
                f"shape={raw_stats['shape']}, dtype={raw_stats['dtype']}, "
                f"nonzero={raw_stats['nonzero_pct']:.1f}%, mean={raw_stats['mean']:.1f}, "
                f"md5={raw_stats['md5']}"
            )
        else:
            logger.info(
                f"[_obs_to_image] Raw array OK: key={img_key}, shape={raw_stats['shape']}, "
                f"nonzero={raw_stats['nonzero_pct']:.1f}%, mean={raw_stats['mean']:.1f}, "
                f"md5={raw_stats['md5']}"
            )

        # Convert to PIL Image
        # RoboSuite returns images with origin at bottom-left, so flip vertically
        img_array_flipped = np.flipud(img_array)

        # Log after flip
        flipped_stats = _compute_array_stats(img_array_flipped, "flipped")
        logger.debug(
            f"[_obs_to_image] After flip: md5={flipped_stats['md5']} "
            f"(should differ from raw if not symmetric)"
        )

        # Create PIL image - make a copy to avoid reference issues
        pil_img = Image.fromarray(img_array_flipped.astype(np.uint8).copy())

        logger.debug(f"[_obs_to_image] PIL Image created: size={pil_img.size}, mode={pil_img.mode}")

        return pil_img

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

        # ALWAYS reinitialize to get a fresh rendering context
        # This fixes OpenGL buffer corruption that happens after many frames
        logger.info(f"[RoboSuiteSimulator] Reinitializing environment for clean render context")
        self.initialize(task=task)

        # Restore MuJoCo sim state
        self.env.sim.set_state(sim_state)
        self.env.sim.forward()  # Recompute derived quantities

        # Restore RNG if saved
        if rng_state is not None and hasattr(self.env, "np_random") and self.env.np_random is not None:
            self.env.np_random.bit_generator.state = rng_state

        logger.info("[RoboSuiteSimulator] State restored successfully")

        # Get the observation with properly rendered image
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

        # On Apple Silicon, also clear MPS cache to release GPU memory
        try:
            import torch
            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
                torch.mps.synchronize()
                logger.info("[RoboSuiteSimulator] MPS cache cleared")
        except Exception:
            pass  # MPS not available or torch not imported

        logger.info("[RoboSuiteSimulator] Closed and memory cleaned")
