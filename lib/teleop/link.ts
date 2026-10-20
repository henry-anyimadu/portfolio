// An emulated network path between the operator station and the robot.
//
// Each direction has two lanes, like a pair of WebRTC data channels:
//  - unreliable: unordered, no retransmits. Lost packets are gone; jitter can
//    reorder them. Used for commands, state and video, where newer supersedes older.
//  - reliable: ordered, retransmitted until delivered. Used for control requests
//    and events. Delivery can be late but never missing or out of order.
//
// Conditions (latency, jitter, loss, link down) are read on every send, so
// changing them mid-session behaves like a real link degrading.

export type LinkConditions = {
  latencyMs: number; // one-way base latency
  jitterMs: number; // uniform extra delay, 0..jitter
  lossPct: number; // independent packet loss, 0..100
  down: boolean; // nothing gets through
};

export const NOMINAL: LinkConditions = { latencyMs: 18, jitterMs: 6, lossPct: 0, down: false };

export type LaneStats = { sent: number; delivered: number; dropped: number; retransmits: number; bytes: number };

const zero = (): LaneStats => ({ sent: 0, delivered: 0, dropped: 0, retransmits: 0, bytes: 0 });

export class LinkDirection {
  readonly unreliableStats = zero();
  readonly reliableStats = zero();
  private reliableSeq = 0;
  private nextToDeliver = 0;
  private readonly waiting = new Map<number, Uint8Array>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private closed = false;

  constructor(
    private readonly conditions: () => LinkConditions,
    private readonly deliver: (bytes: Uint8Array, reliable: boolean) => void,
    private readonly random: () => number = Math.random,
  ) {}

  send(bytes: Uint8Array, reliable: boolean) {
    if (reliable) this.sendReliable(bytes);
    else this.sendUnreliable(bytes);
  }

  close() {
    this.closed = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private delay(): number {
    const c = this.conditions();
    return c.latencyMs + this.random() * c.jitterMs;
  }

  private lost(): boolean {
    const c = this.conditions();
    return c.down || this.random() * 100 < c.lossPct;
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.closed) fn();
    }, ms);
    this.timers.add(t);
  }

  private sendUnreliable(bytes: Uint8Array) {
    const s = this.unreliableStats;
    s.sent++;
    s.bytes += bytes.byteLength;
    if (this.lost()) {
      s.dropped++;
      return;
    }
    this.later(this.delay(), () => {
      s.delivered++;
      this.deliver(bytes, false);
    });
  }

  private sendReliable(bytes: Uint8Array) {
    const seq = this.reliableSeq++;
    this.reliableStats.sent++;
    this.reliableStats.bytes += bytes.byteLength;
    this.attempt(seq, bytes);
  }

  private attempt(seq: number, bytes: Uint8Array) {
    if (this.lost()) {
      // Retransmit timeout: a bit over one round trip, never faster than 120 ms.
      const rto = Math.max(120, 2.5 * this.conditions().latencyMs);
      this.reliableStats.retransmits++;
      this.later(rto, () => this.attempt(seq, bytes));
      return;
    }
    this.later(this.delay(), () => this.arrive(seq, bytes));
  }

  // Reorder buffer: hold anything that arrives ahead of a gap.
  private arrive(seq: number, bytes: Uint8Array) {
    if (seq < this.nextToDeliver || this.waiting.has(seq)) return;
    this.waiting.set(seq, bytes);
    while (this.waiting.has(this.nextToDeliver)) {
      const b = this.waiting.get(this.nextToDeliver)!;
      this.waiting.delete(this.nextToDeliver);
      this.nextToDeliver++;
      this.reliableStats.delivered++;
      this.deliver(b, true);
    }
  }
}
