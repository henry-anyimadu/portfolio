'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CASES, runSuite, type CaseResult } from '@/lib/teleop/fault-suite';
import { NOMINAL, type LinkConditions } from '@/lib/teleop/link';
import { LIMITS, AGENT_VERSION } from '@/lib/teleop/agent/robot-agent';
import { describeFault, type Snapshot, type Station, type TimeBucket } from '@/lib/teleop/station';
import type { HarnessFault } from '@/lib/teleop/types';
import { cn } from '@/lib/utils';
import { Sparkline } from './sparkline';
import { fmtDuration, fmtMs, severityTone, tone } from './status';

// The case-study dialog's treatment from the home page: ink ground, stone
// text, sky mono labels, sections with a label column.
const label = 'text-sm leading-[1.7] font-normal text-sky';
const section = 'grid grid-cols-[9rem_minmax(0,1fr)] gap-6 border-t border-border py-6 first:border-t-0 first:pt-2 compact:grid-cols-1 compact:gap-3';
const link = 'relative inline-flex min-h-9 cursor-pointer items-center gap-[.35rem] border-0 bg-transparent p-0 text-sm text-stone after:absolute after:inset-x-0 after:bottom-[3px] after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-320 hover:after:scale-x-100 focus-visible:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:after:transition-none';
const toggleCls = (on: boolean) => cn('inline-flex min-h-9 cursor-pointer items-center gap-2 border px-3 text-[.8125rem] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:cursor-not-allowed disabled:opacity-40', on ? 'border-stone bg-stone text-ink' : 'border-border bg-transparent text-stone hover:bg-stone/8');

export function DetailPanel({ station, snap }: { station: Station; snap: Snapshot }) {
  return (
    <section aria-label="Station details" className="border border-border bg-ink px-10 pt-7 pb-8 text-stone shadow-[0_20px_80px_rgb(30_30_23/20%)] compact:px-6 phone:px-5">
      <Tabs defaultValue="shift">
        <div className="mb-4 flex items-center justify-between gap-6 compact:flex-col compact:items-start compact:gap-3">
          <span className="font-mono text-sm text-sky">Station</span>
          <TabsList variant="line" className="h-auto flex-wrap justify-start gap-x-5 gap-y-1 p-0">
            {[['shift', 'Shift'], ['link', 'Network and faults'], ['suite', 'Fault suite'], ['telemetry', 'Telemetry'], ['how', 'How it works']].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="h-9 flex-none rounded-none px-0 text-sm font-normal text-stone/60 hover:text-stone data-active:text-stone after:bg-stone">{l}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="shift"><Shift station={station} snap={snap} /></TabsContent>
        <TabsContent value="link"><LinkAndFaults station={station} snap={snap} /></TabsContent>
        <TabsContent value="suite"><Suite station={station} snap={snap} /></TabsContent>
        <TabsContent value="telemetry"><Telemetry snap={snap} /></TabsContent>
        <TabsContent value="how"><How /></TabsContent>
      </Tabs>
    </section>
  );
}

// ------------------------------------------------------------------ shift

const BUCKETS: { key: TimeBucket; label: string; color: string }[] = [
  { key: 'driving', label: 'Driving', color: tone.go },
  { key: 'ready', label: 'Ready, not driving', color: '#d1beb1' },
  { key: 'held', label: 'Held', color: tone.wait },
  { key: 'stopped', label: 'Stopped or faulted', color: tone.stop },
  { key: 'idle', label: 'Disarmed', color: '#51523f' },
  { key: 'offline', label: 'No robot data', color: '#989fb7' },
];

function Shift({ station, snap }: { station: Station; snap: Snapshot }) {
  const total = Object.values(snap.time).reduce((a, b) => a + b, 0);
  const ok = snap.done.filter(d => d.outcome === 'success');
  const durations = ok.map(d => d.durationS).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : NaN;
  const holds = snap.done.reduce((s, d) => s + d.holds, 0);
  const buffered = snap.state?.outbox ?? 0;
  return (
    <div>
      <div className={section}>
        <h2 className={label}>Where time went</h2>
        <div>
          <div className="flex h-3 w-full overflow-hidden bg-stone/10" role="img" aria-label="Session time by state">
            {total > 0 && BUCKETS.map(b => snap.time[b.key] > 0 && <div key={b.key} style={{ width: `${(100 * snap.time[b.key]) / total}%`, background: b.color }} />)}
          </div>
          <ul className="mt-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[.8125rem]">
            {BUCKETS.map(b => (
              <li key={b.key} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2" style={{ background: b.color }} />
                {b.label} <span className="font-mono text-sky tabular-nums">{fmtDuration(snap.time[b.key])}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[.8125rem] leading-[1.6] text-stone/70">Counted only while an episode is running. Time a robot is held or stopped mid-episode is time the operation loses; this bar is the first place to look.</p>
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>Episodes</h2>
        <div>
          <dl className="m-0 grid grid-cols-4 gap-4 phone:grid-cols-2">
            {[['Completed', String(ok.length)], ['Aborted', String(snap.done.length - ok.length)], ['Median time', Number.isFinite(median) ? `${median.toFixed(1)} s` : '—'], ['Holds', String(holds)]].map(([k, v]) => (
              <div key={k}><dt className="text-[.75rem] text-stone/60">{k}</dt><dd className="m-0 font-title text-[1.6rem] leading-tight font-semibold">{v}</dd></div>
            ))}
          </dl>
          {snap.done.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-[.8125rem]">
                <thead className="text-stone/60"><tr>{['Task', 'Result', 'Time', 'Holds', 'Path', 'Log'].map(h => <th key={h} className="border-b border-border py-2 pr-4 font-normal">{h}</th>)}</tr></thead>
                <tbody>
                  {snap.done.slice(0, 8).map(d => (
                    <tr key={d.id + d.endedAt}>
                      <td className="border-b border-border/60 py-2 pr-4">{d.taskLabel}</td>
                      <td className="border-b border-border/60 py-2 pr-4" style={{ color: d.outcome === 'success' ? tone.go : tone.wait }}>{d.outcome === 'success' ? 'Done' : 'Aborted'}</td>
                      <td className="border-b border-border/60 py-2 pr-4 font-mono tabular-nums">{d.durationS.toFixed(1)} s</td>
                      <td className="border-b border-border/60 py-2 pr-4 font-mono tabular-nums">{d.uploaded ? d.holds : '—'}</td>
                      <td className="border-b border-border/60 py-2 pr-4 font-mono tabular-nums">{d.uploaded ? `${(d.pathM * 100).toFixed(0)} cm` : '—'}</td>
                      <td className="border-b border-border/60 py-2 pr-4 text-stone/70">{d.uploaded ? 'Uploaded' : 'On robot'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>Queue</h2>
        <ol className="m-0 grid list-none gap-2 p-0 text-[.8125rem]">
          {snap.tasks.slice(0, 4).map((t, i) => (
            <li key={t.id} className="flex items-center justify-between gap-4">
              <span><span className="mr-3 font-mono text-sky">{String(i + 1).padStart(2, '0')}</span>{t.label}</span>
              {i === 0 && !snap.current && <button type="button" className={link} disabled={snap.phase !== 'running'} onClick={() => station.startTask(t)}>Start <ArrowUpRight size={13} aria-hidden="true" /></button>}
            </li>
          ))}
        </ol>
      </div>
      <div className={section}>
        <h2 className={label}>Control plane</h2>
        <p className="m-0 text-[.8125rem] leading-[1.6]">
          {snap.cloudUp ? 'Reachable.' : 'Unreachable.'} {snap.cloudLogs.length} episode log(s) received.
          {buffered > 0 && ` ${buffered} waiting on the robot.`} Teleop never depends on this link: tasks are cached at the station and logs wait on the robot.
        </p>
      </div>
      <div className={section}>
        <h2 className={label}>Log</h2>
        <ol className="m-0 grid max-h-64 list-none gap-1.5 overflow-y-auto p-0 font-mono text-[.75rem]" aria-label="Recent events">
          {snap.log.slice(0, 30).map((e, i) => (
            <li key={e.at + i} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
              <span className="text-stone/50 tabular-nums">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span>
              <span style={{ color: e.severity === 'info' ? undefined : tone[severityTone(e.severity)] }}>{e.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// -------------------------------------------------------- network + faults

const PRESETS: { name: string; c: Omit<LinkConditions, 'down'> }[] = [
  { name: 'Nominal', c: { latencyMs: NOMINAL.latencyMs, jitterMs: NOMINAL.jitterMs, lossPct: 0 } },
  { name: 'Busy Wi-Fi', c: { latencyMs: 45, jitterMs: 35, lossPct: 3 } },
  { name: 'Warehouse edge', c: { latencyMs: 90, jitterMs: 80, lossPct: 8 } },
  { name: 'LTE backhaul', c: { latencyMs: 160, jitterMs: 60, lossPct: 2 } },
];

const HARNESS: { label: string; fault: HarnessFault; why: string }[] = [
  { label: 'Head camera dies', fault: { kind: 'camera_dead', camera: 'head', on: true }, why: 'Primary view: the robot stops.' },
  { label: 'Head camera freezes', fault: { kind: 'camera_frozen', camera: 'head', on: true }, why: 'Frames keep arriving with an old image. Caught once the robot moves.' },
  { label: 'Workcell camera dies', fault: { kind: 'camera_dead', camera: 'workcell', on: true }, why: 'Secondary view: a warning only.' },
  { label: 'Left elbow encoder freezes', fault: { kind: 'encoder_freeze', joint: 'left_elbow_joint', on: true }, why: 'Caught by comparing motor-side and joint-side encoders.' },
  { label: 'Right shoulder motor weakens', fault: { kind: 'weak_motor', joint: 'right_shoulder_pitch_joint', on: true }, why: 'Caught as sustained torque saturation under load.' },
];

function LinkAndFaults({ station, snap }: { station: Station; snap: Snapshot }) {
  const c = snap.conditions;
  const running = snap.phase === 'running';
  const isOn = (f: HarnessFault) => snap.harness.some(h => h.kind === f.kind && ('camera' in h ? h.camera === ('camera' in f ? f.camera : '') : h.joint === ('joint' in f ? f.joint : '')));
  const slider = (key: 'latencyMs' | 'jitterMs' | 'lossPct', name: string, max: number, unit: string) => (
    <label className="grid grid-cols-[7rem_minmax(0,1fr)_4rem] items-center gap-4 text-[.8125rem] phone:grid-cols-[5.5rem_minmax(0,1fr)_3.5rem]">
      <span>{name}</span>
      <input type="range" min={0} max={max} step={1} value={c[key]} onChange={e => station.setConditions({ [key]: Number(e.target.value) })} className="w-full cursor-pointer accent-[#d1beb1]" />
      <span className="text-right font-mono text-sky tabular-nums">{c[key]} {unit}</span>
    </label>
  );
  return (
    <div>
      <div className={section}>
        <h2 className={label}>Operator link</h2>
        <div className="grid gap-3">
          {slider('latencyMs', 'Latency, one way', 600, 'ms')}
          {slider('jitterMs', 'Jitter', 200, 'ms')}
          {slider('lossPct', 'Packet loss', 60, '%')}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {PRESETS.map(p => <button key={p.name} type="button" className={toggleCls(c.latencyMs === p.c.latencyMs && c.jitterMs === p.c.jitterMs && c.lossPct === p.c.lossPct)} onClick={() => station.setConditions(p.c)}>{p.name}</button>)}
            <button type="button" className={cn(toggleCls(c.down), 'ml-auto')} style={c.down ? { background: tone.stop, borderColor: tone.stop, color: 'white' } : undefined} onClick={() => station.setConditions({ down: !c.down })} aria-pressed={c.down}>
              {c.down ? 'Link cut: restore' : 'Cut the link'}
            </button>
          </div>
          <p className="m-0 text-[.8125rem] leading-[1.6] text-stone/70">
            Applies in both directions. Commands, state and video ride an unreliable, unordered lane; control requests and events ride a reliable, ordered one, so an E-stop is retransmitted until it lands. The robot holds {LIMITS.staleMs} ms after the last command and retracts at {LIMITS.safeStopMs / 1000} s.
          </p>
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>Control plane</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={toggleCls(!snap.cloudUp)} onClick={() => station.setCloud(!snap.cloudUp)} aria-pressed={!snap.cloudUp}>{snap.cloudUp ? 'Take the control plane down' : 'Bring the control plane back'}</button>
          <span className="text-[.8125rem] text-stone/70">A separate path from the robot to the cloud. Losing it must not touch teleop.</span>
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>Bench harness</h2>
        <div>
          <ul className="m-0 grid list-none gap-3 p-0">
            {HARNESS.map(h => {
              const on = isOn(h.fault);
              return (
                <li key={h.label} className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)] items-center gap-4 phone:grid-cols-1 phone:gap-1">
                  <button type="button" disabled={!running} className={toggleCls(on)} style={on ? { background: tone.wait, borderColor: tone.wait } : undefined} onClick={() => station.inject({ ...h.fault, on: !on })} aria-pressed={on}>
                    {on ? `Remove: ${describeFault(h.fault)}` : h.label}
                  </button>
                  <span className="text-[.8125rem] text-stone/70">{h.why}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[.8125rem] leading-[1.6] text-stone/70">The harness talks to the robot directly, the way a bench rig would. It never goes over the operator link, so it works while that link is cut.</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ suite

function Suite({ station, snap }: { station: Station; snap: Snapshot }) {
  const [results, setResults] = useState<CaseResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const start = async () => {
    abort.current = new AbortController();
    setBusy(true);
    setResults([]);
    try {
      await runSuite(station, (r, id) => { setResults(r); setRunning(id); }, abort.current.signal);
    } catch { /* stopped */ }
    setBusy(false);
    setRunning(null);
  };
  const download = () => {
    const blob = new Blob([JSON.stringify({ agent: AGENT_VERSION, model: snap.model?.modelHash, ranAt: new Date().toISOString(), userAgent: navigator.userAgent, results }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'g1-teleop-fault-suite.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const passed = results.filter(r => r.pass).length;
  return (
    <div>
      <div className={section}>
        <h2 className={label}>What it does</h2>
        <div>
          <p className="m-0 max-w-2xl text-base leading-[1.7]">
            A scripted operator drives the arms while each fault is injected in turn. The suite records how fast the robot reacted, how far a hand travelled after the fault, and what it took to get driving again. About a minute and a half.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            {!busy
              ? <button type="button" className={cn(toggleCls(false), 'border-stone')} disabled={snap.phase !== 'running'} onClick={start}>Run {CASES.length} cases</button>
              : <button type="button" className={toggleCls(true)} onClick={() => abort.current?.abort()}>Stop</button>}
            {results.length > 0 && !busy && <button type="button" className={link} onClick={download}><Download size={14} aria-hidden="true" /> Download results</button>}
            {busy && <span className="font-mono text-[.8125rem] text-sky" role="status">Running {results.length + 1} of {CASES.length}: {CASES.find(c => c.id === running)?.name ?? '…'}</span>}
            {!busy && results.length === CASES.length && <span className="font-mono text-[.8125rem] text-sky">{passed} of {results.length} behaved as expected</span>}
          </div>
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>Results</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-[.8125rem]">
            <thead className="text-stone/60">
              <tr>{['Fault', 'Expected', 'What happened', 'Reacted in', 'Travel after', 'Recovery', ''].map(h => <th key={h} className="border-b border-border py-2 pr-4 align-bottom font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              {CASES.map(c => {
                const r = results.find(x => x.id === c.id);
                return (
                  <tr key={c.id} className={cn(!r && 'text-stone/45', running === c.id && 'bg-stone/6')}>
                    <td className="border-b border-border/60 py-2 pr-4 align-top">{c.name}</td>
                    <td className="border-b border-border/60 py-2 pr-4 align-top text-stone/70">{c.expected}</td>
                    <td className="border-b border-border/60 py-2 pr-4 align-top">{r ? <>{r.reaction}{r.note && <span className="block text-stone/60">{r.note}</span>}</> : '—'}</td>
                    <td className="border-b border-border/60 py-2 pr-4 align-top font-mono tabular-nums">{r?.detectMs != null ? fmtMs(r.detectMs) : '—'}</td>
                    <td className="border-b border-border/60 py-2 pr-4 align-top font-mono tabular-nums">{r ? `${r.travelMm.toFixed(0)} mm` : '—'}</td>
                    <td className="border-b border-border/60 py-2 pr-4 align-top">{r ? `${r.recovery}${r.recoveryMs != null && r.recovery !== 'Not needed' ? `, ${fmtMs(r.recoveryMs)}` : ''}` : '—'}</td>
                    <td className="border-b border-border/60 py-2 align-top font-mono" style={{ color: r ? (r.pass ? tone.go : tone.stop) : undefined }}>{r ? (r.pass ? 'pass' : 'fail') : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-[.8125rem] leading-[1.6] text-stone/70">
            Reaction time and the path come from the robot&apos;s own timestamped events, so they hold even when the link is down. Travel after is how far either hand moved once the robot had reacted, as its encoders report it: near zero for a hold, larger when a weak motor lets the arm sag. Rows that keep driving have no reaction to time.
          </p>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- telemetry

function Telemetry({ snap }: { snap: Snapshot }) {
  const m = snap.metrics;
  const stat = (k: string, v: string) => <div><dt className="text-[.75rem] text-stone/60">{k}</dt><dd className="m-0 font-mono text-[.9375rem] tabular-nums">{v}</dd></div>;
  const lane = (name: string, l: Snapshot['metrics']['up']) => (
    <tr><td className="py-1 pr-4">{name}</td><td className="py-1 pr-4 font-mono tabular-nums">{l.sent}</td><td className="py-1 pr-4 font-mono tabular-nums">{l.dropped}</td><td className="py-1 pr-4 font-mono tabular-nums">{l.retransmits}</td><td className="py-1 pr-4 font-mono tabular-nums">{l.kbps.toFixed(0)} kb/s</td></tr>
  );
  const torque = (side: 'left' | 'right') => {
    const v = m.torqueMax[side];
    return (
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-[.8125rem]">
        <span className="capitalize">{side}</span>
        <span className="h-1.5 bg-stone/12"><span className="block h-full" style={{ width: `${Math.round(100 * v)}%`, background: v > 0.9 ? tone.stop : v > 0.6 ? tone.wait : tone.go }} /></span>
        <span className="text-right font-mono tabular-nums">{Math.round(100 * v)}%</span>
      </div>
    );
  };
  return (
    <div>
      <div className={section}>
        <h2 className={label}>Command to video</h2>
        <div>
          <Sparkline values={m.cmdToVideo.values} label="Command to video latency, recent samples" />
          <p className="mt-2 m-0 text-[.8125rem] text-stone/70">
            p50 <span className="font-mono text-stone">{fmtMs(m.cmdToVideo.p50)}</span>, p95 <span className="font-mono text-stone">{fmtMs(m.cmdToVideo.p95)}</span>. From sending a command to the first head-camera frame that includes it. This is the delay an operator feels.
          </p>
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>Round trip</h2>
        <div>
          <Sparkline values={m.rtt.values} label="Round trip time, recent samples" color="#d1beb1" />
          <p className="mt-2 m-0 text-[.8125rem] text-stone/70">p50 <span className="font-mono text-stone">{fmtMs(m.rtt.p50)}</span>, p95 <span className="font-mono text-stone">{fmtMs(m.rtt.p95)}</span>. Ping and pong on the unreliable lane.</p>
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>Streams</h2>
        <div>
          <dl className="m-0 grid grid-cols-4 gap-4 phone:grid-cols-2">
            {stat('Head camera', `${m.fps.head} fps · ${fmtMs(m.frameAge.head)}`)}
            {stat('Workcell camera', `${m.fps.workcell} fps · ${fmtMs(m.frameAge.workcell)}`)}
            {stat('State frames lost', `${m.stateLossPct.toFixed(1)}%`)}
            {stat('Robot physics load', `${Math.round(100 * m.simLoad)}%`)}
          </dl>
          <table className="mt-5 border-collapse text-left text-[.8125rem]">
            <thead className="text-stone/60"><tr>{['Direction', 'Packets', 'Dropped', 'Retransmits', 'Rate'].map(h => <th key={h} className="pr-4 pb-1 font-normal">{h}</th>)}</tr></thead>
            <tbody>{lane('Station to robot', m.up)}{lane('Robot to station', m.down)}</tbody>
          </table>
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>Arm torque</h2>
        <div className="grid max-w-md gap-2">
          {torque('left')}
          {torque('right')}
          <p className="m-0 text-[.8125rem] text-stone/70">Highest actuator torque in each arm as a share of its limit. Held at the limit for {LIMITS.torquePersistMs} ms, the robot stops.</p>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- how

function How() {
  return (
    <div>
      <div className={section}>
        <h2 className={label}>The setup</h2>
        <div className="max-w-2xl text-base leading-[1.7]">
          <p className="m-0">A Unitree G1 humanoid from Google DeepMind&apos;s MuJoCo Menagerie, simulated in your browser with MuJoCo compiled to WebAssembly. Its pelvis is bolted to a test stand, so this is upper-body teleoperation: two seven-joint arms reaching for pads on a table.</p>
          <p className="mt-4 mb-0">The robot agent runs in a Web Worker, standing in for the robot&apos;s own computer. The station, this page, talks to it only through an emulated network with real latency, jitter, loss and outages. Every message is a protobuf Envelope.</p>
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>How it fits</h2>
        <ArchitectureDiagram />
      </div>
      <div className={section}>
        <h2 className={label}>Device or cloud</h2>
        <div className="grid grid-cols-3 gap-6 text-[.8125rem] leading-[1.6] compact:grid-cols-1">
          {[
            ['On the robot', ['Watchdog and mode machine', 'Workspace and rate limits', 'Inverse kinematics', 'Fault detection: encoders, torque, cameras', 'Safe stop and E-stop latch', 'Episode success, logs buffered until uploaded']],
            ['At the station', ['Input devices and the deadman', 'Command stream at 60 Hz', 'Video rendered off the main thread, so a slow GPU costs image quality, never control latency', 'Local target overlay with zero lag', 'One prioritised attention message', 'Stuck detection, shift bookkeeping']],
            ['In the control plane', ['Task queue', 'Episode logs', 'Agent version and model hash', 'Nothing the robot needs to stop safely']],
          ].map(([h, items]) => (
            <div key={h as string}>
              <h3 className="mb-2 text-sm font-medium text-stone">{h}</h3>
              <ul className="m-0 grid list-none gap-1 p-0 text-stone/75">{(items as string[]).map(i => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
      <div className={section}>
        <h2 className={label}>The numbers</h2>
        <table className="border-collapse text-left text-[.8125rem]">
          <tbody>
            {[
              ['Hold after the last command', `${LIMITS.staleMs} ms`],
              ['Retract and disarm after', `${LIMITS.safeStopMs / 1000} s`],
              ['Refuse to resume onto a target further than', `${LIMITS.jumpM * 100} cm`],
              ['Hand target slew limit', `${LIMITS.handSpeed} m/s`],
              ['Joint rate limit, driving / retracting', `${LIMITS.jointSpeed} / ${LIMITS.retractSpeed} rad/s`],
              ['Encoder disagreement', `${(LIMITS.encoderDisagreeRad * 57.3).toFixed(1)}° for ${LIMITS.encoderPersistMs} ms`],
              ['Torque saturation', `${LIMITS.torqueFrac * 100}% for ${LIMITS.torquePersistMs} ms`],
              ['Camera lost / frozen', `${LIMITS.cameraLostMs} / ${LIMITS.cameraFrozenMs} ms`],
              ['Physics / IK / state / video', '500 / 100 / 50 / 30 Hz'],
            ].map(([k, v]) => <tr key={k}><td className="py-1 pr-8 text-stone/75">{k}</td><td className="py-1 font-mono tabular-nums">{v}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className={section}>
        <h2 className={label}>Honest limits</h2>
        <ul className="m-0 grid max-w-2xl list-disc gap-1.5 pl-5 text-[.8125rem] leading-[1.6] text-stone/80">
          <li>Video is not encoded video. A frame carries the pose of every body at capture time and the station renders it, so frames behave like video on the network (late, lost, frozen) without the codec.</li>
          <li>The E-stop here travels over the network. A real cell also has a hardwired, safety-rated stop that does not.</li>
          <li>Faults are injected by a bench harness. Real failures are messier, but the detection logic is the same.</li>
          <li>No locomotion, no hands, no policy. The point is the interface around the robot, not the robot&apos;s brain.</li>
        </ul>
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  const box = 'fill-[#1e1e17] stroke-[#d1beb1]/40';
  return (
    <svg viewBox="0 0 720 260" className="h-auto w-full max-w-3xl" role="img" aria-label="Station and robot agent connected by an emulated network with two lanes; both reach a control plane on separate paths.">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#989fb7" /></marker>
      </defs>
      <g fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif" fontSize="12" fill="#d1beb1">
        <rect x="10" y="20" width="200" height="150" className={box} strokeWidth="1" />
        <text x="26" y="44" fontSize="14" fill="#f3eee6">Operator station</text>
        <text x="26" y="64" fill="#989fb7" fontFamily="SFMono-Regular, Consolas, monospace" fontSize="11">this page</text>
        {['Gamepad, keys, pedal', 'Command stream, 60 Hz', 'Video: own render threads', 'Attention, shift'].map((t, i) => <text key={t} x="26" y={92 + i * 19}>{t}</text>)}

        <rect x="510" y="20" width="200" height="150" className={box} strokeWidth="1" />
        <text x="526" y="44" fontSize="14" fill="#f3eee6">Robot agent</text>
        <text x="526" y="64" fill="#989fb7" fontFamily="SFMono-Regular, Consolas, monospace" fontSize="11">Web Worker</text>
        {['Watchdog, modes', 'IK, limits', 'Fault detection', 'MuJoCo G1, 500 Hz'].map((t, i) => <text key={t} x="526" y={92 + i * 19}>{t}</text>)}

        <text x="360" y="40" textAnchor="middle" fill="#989fb7" fontFamily="SFMono-Regular, Consolas, monospace" fontSize="11">emulated network</text>
        <line x1="214" y1="70" x2="506" y2="70" stroke="#989fb7" strokeWidth="1.2" markerEnd="url(#arr)" markerStart="url(#arr)" strokeDasharray="5 4" />
        <text x="360" y="62" textAnchor="middle">unreliable: commands, state, video</text>
        <line x1="214" y1="110" x2="506" y2="110" stroke="#989fb7" strokeWidth="1.2" markerEnd="url(#arr)" markerStart="url(#arr)" />
        <text x="360" y="102" textAnchor="middle">reliable: control, events</text>
        <text x="360" y="140" textAnchor="middle" fill="#989fb7" fontSize="11">protobuf Envelope</text>

        <rect x="260" y="196" width="200" height="52" className={box} strokeWidth="1" strokeDasharray="4 3" />
        <text x="360" y="218" textAnchor="middle" fontSize="13" fill="#f3eee6">Control plane</text>
        <text x="360" y="236" textAnchor="middle" fill="#989fb7" fontSize="11">tasks, logs, versions</text>
        <path d="M110 172 L110 222 L256 222" fill="none" stroke="#d1beb1" strokeOpacity=".5" strokeDasharray="3 4" markerEnd="url(#arr)" />
        <path d="M610 172 L610 222 L464 222" fill="none" stroke="#d1beb1" strokeOpacity=".5" strokeDasharray="3 4" markerEnd="url(#arr)" />
      </g>
    </svg>
  );
}
