// Starts one of the prebuilt workers in public/teleop/workers/ (see
// scripts/teleop/build-workers.mjs). Built through Reflect.construct on purpose:
// webpack and Turbopack both try to bundle anything written as `new Worker(...)`,
// and these files are already bundled.
export function spawnWorker(url: string): Worker {
  return Reflect.construct(Worker, [url, { type: 'module' }]) as Worker;
}
