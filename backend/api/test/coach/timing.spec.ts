import { describe, it } from 'vitest';

// INVITE-04 / T-25-02: constant-time guarantee — peek/redeem must show no
// timing differential across the 6 error causes vs. success. Full benchmark
// implementation in plan 06. Threshold per RESEARCH.md: max(p99) - min(p1) < 50ms after warmup.

describe('coach/clients constant-time guarantee', () => {
  it.todo('redeem RPC: 100 samples each across 6 error shapes + success; max(p99) - min(p1) < 50ms');
  it.todo('peek RPC: same threshold');
  it.todo('warmup of 20 samples discarded before measurement');
});
