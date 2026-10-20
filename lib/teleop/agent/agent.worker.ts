// Runs the robot agent off the page's main thread, the way the agent would run
// on the robot's own computer. It talks to the station only through
// postMessage, which the station routes through the emulated network.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FromWorker, ToWorker } from '../types';
import { compileBundle, parseBundle } from './bundle';
import { RobotAgent } from './robot-agent';

const post = (m: FromWorker, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);
let agent: RobotAgent | null = null;
const early: ToWorker[] = [];

self.onmessage = (e: MessageEvent<ToWorker | { t: 'init'; assetBase: string }>) => {
  const m = e.data;
  if (m.t === 'init') return void boot(m.assetBase);
  if (!agent) return void early.push(m);
  handle(m);
};

function handle(m: ToWorker) {
  if (!agent) return;
  if (m.t === 'net') agent.receive(m.bytes);
  else if (m.t === 'harness') agent.harness(m.fault);
  else if (m.t === 'uploaded') agent.uploaded(m.ids);
  else if (m.t === 'cloud') agent.setCloud(m.up);
}

async function boot(assetBase: string) {
  try {
    post({ t: 'boot', stage: 'Loading the physics engine' });
    const url = `${assetBase}/mujoco/mujoco.js`;
    const { default: load } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
    const [mj, bundleBuf] = await Promise.all([
      load(),
      (async () => {
        post({ t: 'boot', stage: 'Downloading the G1 description' });
        const res = await fetch(`${assetBase}/g1_workcell.bin`);
        if (!res.ok) throw new Error(`Robot description: HTTP ${res.status}`);
        return res.arrayBuffer();
      })(),
    ]);
    post({ t: 'boot', stage: 'Compiling the model' });
    const bundle = parseBundle(bundleBuf);
    const model = compileBundle(mj, bundle);
    post({ t: 'boot', stage: 'Starting the agent' });
    agent = new RobotAgent(
      mj, model,
      (bytes, reliable) => post({ t: 'net', bytes, reliable }),
      records => post({ t: 'upload', records }),
      bundle.hash,
    );
    const rm = agent.renderModel();
    post({ t: 'ready', model: rm }, rm.meshes.flatMap(x => [x.vert.buffer, x.face.buffer]));
    for (const m of early.splice(0)) handle(m);
    setInterval(() => agent!.tick(), 4);
  } catch (err) {
    post({ t: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}
