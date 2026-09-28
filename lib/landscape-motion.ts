export type ViewMode = 'overview' | 'held' | 'latched';
export type ViewAction = 'press' | 'release' | 'toggle' | 'reset';
export type Point = Readonly<{ x: number; y: number }>;
export type Spring = Readonly<{ value: number; velocity: number }>;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function nextView(mode: ViewMode, action: ViewAction): ViewMode {
  switch (action) {
    case 'press': return mode === 'latched' ? mode : 'held';
    case 'release': return mode === 'held' ? 'overview' : mode;
    case 'toggle': return mode === 'overview' ? 'latched' : 'overview';
    case 'reset': return 'overview';
  }
}

export function normalizePoint(point: Point, rect: { left: number; top: number; width: number; height: number }): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp(((point.x - rect.left) / rect.width) * 2 - 1, -1, 1),
    y: clamp(((point.y - rect.top) / rect.height) * 2 - 1, -1, 1),
  };
}

export function cameraTarget(mode: ViewMode, point: Point, width: number, height: number) {
  const scale = mode === 'overview' ? 1.04 : 1.62;
  const travel = mode === 'overview' ? 0.009 : 0.25;
  return { scale, x: -clamp(point.x, -1, 1) * width * travel, y: -clamp(point.y, -1, 1) * height * travel };
}

// Closed-form critically damped spring: stable at any refresh rate, with no
// numerical integration explosion after a suspended frame. Units are seconds.
export function advanceSpring(spring: Spring, target: number, seconds: number, frequency = 12): Spring {
  const elapsed = clamp(seconds, 0, 0.064);
  const displacement = spring.value - target;
  const coefficient = spring.velocity + frequency * displacement;
  const decay = Math.exp(-frequency * elapsed);
  return {
    value: target + (displacement + coefficient * elapsed) * decay,
    velocity: (spring.velocity - frequency * coefficient * elapsed) * decay,
  };
}

export function atRest(spring: Spring, target: number, epsilon = 0.01) {
  return Math.abs(spring.value - target) < epsilon && Math.abs(spring.velocity) < epsilon;
}
