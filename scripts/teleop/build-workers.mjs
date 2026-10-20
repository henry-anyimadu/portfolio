// Bundles the teleop workers into public/teleop/workers/, loaded by URL at runtime.
// Next's bundlers differ in how (and whether) they handle module workers, so the
// workers are built here instead and stay independent of webpack or Turbopack.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
  absWorkingDir: root,
  entryPoints: {
    agent: 'lib/teleop/agent/agent.worker.ts',
    render: 'lib/teleop/render.worker.ts',
  },
  outdir: 'public/teleop/workers',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
};

if (watch) {
  const { context } = await import('esbuild');
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
