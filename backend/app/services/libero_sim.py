"""
LIBERO Benchmark Integration Service.

LIBERO is a benchmarking platform for lifelong robot learning that provides:
- 4 task suites: LIBERO-Spatial, LIBERO-Object, LIBERO-Goal, LIBERO-100
- 130 total manipulation tasks with natural language instructions

This service provides task metadata and placeholder visualization.
For actual simulation, use the RoboSuite simulator tab.
"""

import logging
from typing import Dict, Any, List, Optional
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)


# LIBERO task suite definitions
LIBERO_TASK_SUITES = {
    "libero_spatial": {
        "name": "LIBERO-Spatial",
        "description": "10 tasks testing spatial relationship knowledge transfer",
        "task_count": 10,
        "focus": "Spatial relationships between objects",
        "tasks": [
            {"id": 0, "name": "pick_up_the_black_bowl_between_the_plate_and_the_ramekin_and_place_it_on_the_plate", "language": "Pick up the black bowl between the plate and the ramekin and place it on the plate"},
            {"id": 1, "name": "pick_up_the_black_bowl_next_to_the_ramekin_and_place_it_on_the_plate", "language": "Pick up the black bowl next to the ramekin and place it on the plate"},
            {"id": 2, "name": "pick_up_the_black_bowl_from_table_center_and_place_it_on_the_plate", "language": "Pick up the black bowl from table center and place it on the plate"},
            {"id": 3, "name": "pick_up_the_black_bowl_on_the_cookie_sheet_and_place_it_on_the_plate", "language": "Pick up the black bowl on the cookie sheet and place it on the plate"},
            {"id": 4, "name": "pick_up_the_black_bowl_in_the_top_drawer_of_the_wooden_cabinet_and_place_it_on_the_plate", "language": "Pick up the black bowl in the top drawer of the wooden cabinet and place it on the plate"},
            {"id": 5, "name": "pick_up_the_black_bowl_on_the_wooden_cabinet_and_place_it_on_the_plate", "language": "Pick up the black bowl on the wooden cabinet and place it on the plate"},
            {"id": 6, "name": "pick_up_the_black_bowl_next_to_the_cookie_sheet_and_place_it_on_the_plate", "language": "Pick up the black bowl next to the cookie sheet and place it on the plate"},
            {"id": 7, "name": "pick_up_the_black_bowl_on_the_stove_and_place_it_on_the_plate", "language": "Pick up the black bowl on the stove and place it on the plate"},
            {"id": 8, "name": "pick_up_the_black_bowl_next_to_the_plate_and_place_it_on_the_plate", "language": "Pick up the black bowl next to the plate and place it on the plate"},
            {"id": 9, "name": "pick_up_the_black_bowl_on_the_plate_and_place_it_on_the_wooden_cabinet", "language": "Pick up the black bowl on the plate and place it on the wooden cabinet"},
        ]
    },
    "libero_object": {
        "name": "LIBERO-Object",
        "description": "10 tasks testing object property knowledge transfer",
        "task_count": 10,
        "focus": "Object properties and affordances",
        "tasks": [
            {"id": 0, "name": "pick_up_the_alphabet_soup_and_place_it_in_the_basket", "language": "Pick up the alphabet soup and place it in the basket"},
            {"id": 1, "name": "pick_up_the_cream_cheese_and_place_it_in_the_basket", "language": "Pick up the cream cheese and place it in the basket"},
            {"id": 2, "name": "pick_up_the_salad_dressing_and_place_it_in_the_basket", "language": "Pick up the salad dressing and place it in the basket"},
            {"id": 3, "name": "pick_up_the_bbq_sauce_and_place_it_in_the_basket", "language": "Pick up the bbq sauce and place it in the basket"},
            {"id": 4, "name": "pick_up_the_ketchup_and_place_it_in_the_basket", "language": "Pick up the ketchup and place it in the basket"},
            {"id": 5, "name": "pick_up_the_tomato_sauce_and_place_it_in_the_basket", "language": "Pick up the tomato sauce and place it in the basket"},
            {"id": 6, "name": "pick_up_the_butter_and_place_it_in_the_basket", "language": "Pick up the butter and place it in the basket"},
            {"id": 7, "name": "pick_up_the_milk_and_place_it_in_the_basket", "language": "Pick up the milk and place it in the basket"},
            {"id": 8, "name": "pick_up_the_chocolate_pudding_and_place_it_in_the_basket", "language": "Pick up the chocolate pudding and place it in the basket"},
            {"id": 9, "name": "pick_up_the_orange_juice_and_place_it_in_the_basket", "language": "Pick up the orange juice and place it in the basket"},
        ]
    },
    "libero_goal": {
        "name": "LIBERO-Goal",
        "description": "10 tasks testing goal specification knowledge transfer",
        "task_count": 10,
        "focus": "Different goal specifications for similar scenes",
        "tasks": [
            {"id": 0, "name": "open_the_middle_drawer_of_the_cabinet", "language": "Open the middle drawer of the cabinet"},
            {"id": 1, "name": "put_the_bowl_on_the_stove", "language": "Put the bowl on the stove"},
            {"id": 2, "name": "put_the_wine_bottle_on_top_of_the_cabinet", "language": "Put the wine bottle on top of the cabinet"},
            {"id": 3, "name": "open_the_top_drawer_and_put_the_bowl_inside", "language": "Open the top drawer and put the bowl inside"},
            {"id": 4, "name": "put_the_bowl_on_top_of_the_cabinet", "language": "Put the bowl on top of the cabinet"},
            {"id": 5, "name": "push_the_plate_to_the_front_of_the_stove", "language": "Push the plate to the front of the stove"},
            {"id": 6, "name": "put_the_cream_cheese_in_the_bowl", "language": "Put the cream cheese in the bowl"},
            {"id": 7, "name": "turn_on_the_stove", "language": "Turn on the stove"},
            {"id": 8, "name": "put_the_bowl_on_the_plate", "language": "Put the bowl on the plate"},
            {"id": 9, "name": "put_the_wine_bottle_on_the_rack", "language": "Put the wine bottle on the rack"},
        ]
    },
    "libero_10": {
        "name": "LIBERO-10",
        "description": "10 diverse long-horizon tasks for lifelong learning evaluation",
        "task_count": 10,
        "focus": "Complex multi-step manipulation requiring entangled knowledge",
        "tasks": [
            {"id": 0, "name": "LIVING_ROOM_SCENE1_put_both_the_alphabet_soup_and_the_tomato_sauce_in_the_basket", "language": "Put both the alphabet soup and the tomato sauce in the basket"},
            {"id": 1, "name": "LIVING_ROOM_SCENE2_put_both_the_cream_cheese_box_and_the_butter_in_the_basket", "language": "Put both the cream cheese box and the butter in the basket"},
            {"id": 2, "name": "KITCHEN_SCENE3_turn_on_the_stove_and_put_the_moka_pot_on_it", "language": "Turn on the stove and put the moka pot on it"},
            {"id": 3, "name": "KITCHEN_SCENE4_put_the_black_bowl_in_the_bottom_drawer_of_the_oven_and_close_it", "language": "Put the black bowl in the bottom drawer of the oven and close it"},
            {"id": 4, "name": "LIVING_ROOM_SCENE5_put_the_white_mug_on_the_left_plate_and_put_the_yellow_and_white_mug_on_the_right_plate", "language": "Put the white mug on the left plate and put the yellow and white mug on the right plate"},
            {"id": 5, "name": "LIVING_ROOM_SCENE6_put_the_chocolate_pudding_to_the_left_of_the_plate_and_put_the_salad_dressing_to_the_right_of_the_plate", "language": "Put the chocolate pudding to the left of the plate and put the salad dressing to the right of the plate"},
            {"id": 6, "name": "KITCHEN_SCENE7_put_the_frying_pan_on_the_stove_and_put_the_lid_on_the_pan", "language": "Put the frying pan on the stove and put the lid on the pan"},
            {"id": 7, "name": "KITCHEN_SCENE8_put_both_moka_pots_on_the_stove", "language": "Put both moka pots on the stove"},
            {"id": 8, "name": "KITCHEN_SCENE9_put_the_white_bowl_on_the_plate_and_put_the_butter_on_top_of_the_cabinet", "language": "Put the white bowl on the plate and put the butter on top of the cabinet"},
            {"id": 9, "name": "KITCHEN_SCENE10_put_the_red_bowl_on_the_stove", "language": "Put the red bowl on the stove"},
        ]
    },
}


def _create_placeholder_image(task_info: Dict[str, Any], width: int = 640, height: int = 480) -> Image.Image:
    """Create a placeholder image with task information."""
    # Create a gradient background
    img = Image.new('RGB', (width, height), color=(40, 40, 50))
    draw = ImageDraw.Draw(img)

    # Draw grid pattern
    for i in range(0, width, 40):
        draw.line([(i, 0), (i, height)], fill=(50, 50, 60), width=1)
    for i in range(0, height, 40):
        draw.line([(0, i), (width, i)], fill=(50, 50, 60), width=1)

    # Draw robot workspace representation
    workspace_x = width // 2 - 150
    workspace_y = height // 2 - 100
    workspace_w = 300
    workspace_h = 200

    # Table surface
    draw.rectangle(
        [workspace_x, workspace_y + 120, workspace_x + workspace_w, workspace_y + workspace_h],
        fill=(80, 60, 40),
        outline=(100, 80, 60),
        width=2
    )

    # Robot arm representation
    draw.ellipse(
        [workspace_x + 130, workspace_y + 20, workspace_x + 170, workspace_y + 60],
        fill=(100, 100, 120),
        outline=(150, 150, 170)
    )
    draw.rectangle(
        [workspace_x + 145, workspace_y + 60, workspace_x + 155, workspace_y + 120],
        fill=(100, 100, 120),
        outline=(150, 150, 170)
    )

    # Object placeholder
    draw.ellipse(
        [workspace_x + 80, workspace_y + 130, workspace_x + 120, workspace_y + 160],
        fill=(60, 60, 80),
        outline=(100, 100, 120),
        width=2
    )

    # Target area
    draw.rectangle(
        [workspace_x + 200, workspace_y + 130, workspace_x + 260, workspace_y + 170],
        fill=None,
        outline=(100, 200, 100),
        width=2
    )

    # Title
    title = "LIBERO Task Visualization"
    draw.text((width // 2 - 100, 20), title, fill=(200, 200, 220))

    # Suite info
    suite_text = f"Suite: {task_info.get('suite_name', 'Unknown')}"
    draw.text((20, height - 80), suite_text, fill=(150, 150, 170))

    # Task instruction (wrap long text)
    instruction = task_info.get('language', 'No instruction')
    if len(instruction) > 60:
        instruction = instruction[:57] + "..."
    draw.text((20, height - 55), f"Task: {instruction}", fill=(180, 180, 200))

    # Step count
    step_text = f"Step: {task_info.get('step_count', 0)}"
    draw.text((20, height - 30), step_text, fill=(150, 150, 170))

    # Placeholder notice
    notice = "[Placeholder - Use Simulator tab for real rendering]"
    draw.text((width // 2 - 150, height - 30), notice, fill=(255, 200, 100))

    return img


class LiberoSimulator:
    """
    LIBERO Benchmark Simulator with placeholder visualization.

    Provides task metadata and placeholder images.
    For actual simulation, use the RoboSuite simulator tab.
    """

    def __init__(self):
        self._current_suite: Optional[str] = None
        self._current_task_id: Optional[int] = None
        self._task_info: Optional[Dict[str, Any]] = None
        self._step_count: int = 0

    @property
    def is_initialized(self) -> bool:
        """Check if a task is currently loaded."""
        return self._task_info is not None

    def get_task_suites(self) -> Dict[str, Any]:
        """Get all available LIBERO task suites."""
        return {
            suite_id: {
                "name": suite["name"],
                "description": suite["description"],
                "task_count": suite["task_count"],
                "focus": suite["focus"],
            }
            for suite_id, suite in LIBERO_TASK_SUITES.items()
        }

    def get_tasks(self, suite_id: str) -> List[Dict[str, Any]]:
        """Get all tasks in a specific suite."""
        if suite_id not in LIBERO_TASK_SUITES:
            raise ValueError(f"Unknown task suite: {suite_id}")

        return LIBERO_TASK_SUITES[suite_id]["tasks"]

    def get_task_info(self, suite_id: str, task_id: int) -> Dict[str, Any]:
        """Get detailed information about a specific task."""
        if suite_id not in LIBERO_TASK_SUITES:
            raise ValueError(f"Unknown task suite: {suite_id}")

        suite = LIBERO_TASK_SUITES[suite_id]
        if task_id < 0 or task_id >= len(suite["tasks"]):
            raise ValueError(f"Invalid task_id {task_id} for suite {suite_id}")

        task = suite["tasks"][task_id]
        return {
            "suite_id": suite_id,
            "suite_name": suite["name"],
            "task_id": task_id,
            "task_name": task["name"],
            "language": task["language"],
            "focus": suite["focus"],
        }

    def initialize_task(self, suite_id: str, task_id: int) -> Dict[str, Any]:
        """
        Initialize a LIBERO task with placeholder visualization.

        Args:
            suite_id: The task suite (e.g., 'libero_spatial', 'libero_10')
            task_id: The task index within the suite

        Returns:
            Dictionary with initialization result and placeholder image
        """
        logger.info(f"[LiberoSimulator] Initializing task: suite={suite_id}, task_id={task_id}")

        task_info = self.get_task_info(suite_id, task_id)

        self._current_suite = suite_id
        self._current_task_id = task_id
        self._task_info = task_info
        self._step_count = 0

        # Create placeholder image with task info
        display_info = {**task_info, "step_count": self._step_count}
        image = _create_placeholder_image(display_info)

        logger.info(f"[LiberoSimulator] Task initialized: {task_info['language']}")

        return {
            "success": True,
            "task_info": task_info,
            "image": image,
            "message": f"Initialized: {task_info['language']}",
        }

    def step(self, action: List[float]) -> Dict[str, Any]:
        """
        Execute an action (placeholder - just increments step count).

        Args:
            action: 7-DOF action [x, y, z, roll, pitch, yaw, gripper]

        Returns:
            Step result with placeholder observation
        """
        if not self.is_initialized:
            raise RuntimeError("No task initialized")

        self._step_count += 1

        # Create updated placeholder image
        display_info = {**self._task_info, "step_count": self._step_count}
        image = _create_placeholder_image(display_info)

        return {
            "success": True,
            "image": image,
            "reward": 0.0,
            "done": False,
            "step_count": self._step_count,
            "task_info": self._task_info,
        }

    def reset(self) -> Dict[str, Any]:
        """Reset the current task to initial state."""
        if not self._task_info:
            raise RuntimeError("No task initialized")

        self._step_count = 0

        # Create placeholder image
        display_info = {**self._task_info, "step_count": self._step_count}
        image = _create_placeholder_image(display_info)

        return {
            "success": True,
            "image": image,
            "message": "Task reset to initial state",
            "task_info": self._task_info,
        }

    def get_status(self) -> Dict[str, Any]:
        """Get current simulator status."""
        return {
            "available": True,
            "initialized": self.is_initialized,
            "current_suite": self._current_suite,
            "current_task_id": self._current_task_id,
            "task_info": self._task_info,
            "step_count": self._step_count,
        }

    def close(self):
        """Close the simulator and release resources."""
        self._current_suite = None
        self._current_task_id = None
        self._task_info = None
        self._step_count = 0

        logger.info("[LiberoSimulator] Simulator closed")


# Global singleton instance
_libero_simulator: Optional[LiberoSimulator] = None


def get_libero_simulator() -> LiberoSimulator:
    """Get or create the global LIBERO simulator instance."""
    global _libero_simulator
    if _libero_simulator is None:
        _libero_simulator = LiberoSimulator()
    return _libero_simulator
