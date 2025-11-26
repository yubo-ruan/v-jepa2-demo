export const ACTION_DISPLAY_SCALING = {
  POSITION_TO_CM: 100,
  ROTATION_TO_DEG: 114.6, // Approximation: normalized to degrees
  GRIPPER_MIN: -0.75,
  GRIPPER_MAX: 0.75,
} as const;

export const ACTION_LABELS = {
  POSITION: ['X', 'Y', 'Z'],
  ROTATION: ['Roll', 'Pitch', 'Yaw'],
  GRIPPER: 'Gripper',
} as const;

export const ACTION_COLORS = {
  POSITION: ['red', 'green', 'blue'],
  ROTATION: ['amber', 'purple', 'cyan'],
  GRIPPER: 'pink',
} as const;
