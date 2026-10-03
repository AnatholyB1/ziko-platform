// Phase 43 plan 01 (v1.18, conversational-onboarding) — ONBOARD-02/03/05
// coverage for the assess_profile tool schema, its curated micro-action
// pool, and the record_athlete_decision() executor.
//
// Pure unit spec — no database access and no conditional skip guard, so it
// runs unconditionally in CI. Mocks src/tools/db.js so clientForUser
// returns a fake whose rpc() resolves a scripted { data, error } and
// records its call arguments.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module mocks (hoisted by Vitest before imports resolve) ─────────────
const mockRpc = vi.fn();

vi.mock('../../src/tools/db.js', () => ({
  clientForUser: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

// ─── Import module under test AFTER mocks are set up ─────────────────────
import {
  assessProfileSchema,
  assess_profile,
  MICRO_ACTION_POOL,
  ONBOARDING_LEVEL,
  ONBOARDING_TIER,
} from '../../src/tools/onboarding.js';

const validParams = {
  experience_level: 'beginner',
  experience_confidence: 4,
  adherence_risk: 'medium',
  adherence_confidence: 3,
  readiness: 'building',
  readiness_confidence: 5,
  profile_summary: 'A motivated beginner easing back into training.',
  micro_action: 'hydration_log',
  mission_title: 'Log your first glass of water',
};

describe('assessProfileSchema — JSON Schema contract', () => {
  it('readiness enum equals [fragile, building, ready]', () => {
    expect(assessProfileSchema.parameters.properties.readiness.enum).toEqual([
      'fragile',
      'building',
      'ready',
    ]);
  });

  it('micro_action enum equals [hydration_log, journal_mood, measurements_weight]', () => {
    expect(assessProfileSchema.parameters.properties.micro_action.enum).toEqual([
      'hydration_log',
      'journal_mood',
      'measurements_weight',
    ]);
  });

  it('required contains all nine property names', () => {
    expect(assessProfileSchema.parameters.required).toEqual(
      expect.arrayContaining([
        'experience_level',
        'experience_confidence',
        'adherence_risk',
        'adherence_confidence',
        'readiness',
        'readiness_confidence',
        'profile_summary',
        'micro_action',
        'mission_title',
      ]),
    );
    expect(assessProfileSchema.parameters.required).toHaveLength(9);
  });
});

describe('MICRO_ACTION_POOL', () => {
  it('is restricted to exactly three curated values', () => {
    expect(MICRO_ACTION_POOL).toEqual(['hydration_log', 'journal_mood', 'measurements_weight']);
  });
});

describe('assess_profile executor', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('calls record_athlete_decision with the expected fixed fields on valid input', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'abc-123' }, error: null });

    const result = await assess_profile(validParams, 'user-1', 'token-1');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, rpcArgs] = mockRpc.mock.calls[0];
    expect(rpcName).toBe('ziko_record_athlete_decision');
    expect(rpcArgs.p_decision_type).toBe('onboarding_profile');
    expect(rpcArgs.p_source).toBe('onboarding_tool');
    expect(rpcArgs.p_week_of).toBeNull();
    expect(rpcArgs.p_state_patch.status).toBe('active');
    expect(rpcArgs.p_state_patch.level).toBe(ONBOARDING_LEVEL);
    expect(rpcArgs.p_state_patch.tier).toBe(ONBOARDING_TIER);
    expect(rpcArgs.p_state_patch.readiness).toBe(validParams.readiness);

    expect(result).toEqual({
      success: true,
      decision_id: 'abc-123',
      micro_action: validParams.micro_action,
      mission_title: validParams.mission_title,
    });
  });

  it('rejects a micro_action outside MICRO_ACTION_POOL without calling the RPC', async () => {
    const result = await assess_profile(
      { ...validParams, micro_action: 'not_a_real_action' },
      'user-1',
      'token-1',
    );

    expect(result).toEqual({ success: false, error: 'invalid_micro_action' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects a readiness outside the three allowed values without calling the RPC', async () => {
    const result = await assess_profile(
      { ...validParams, readiness: 'not_a_real_readiness' },
      'user-1',
      'token-1',
    );

    expect(result).toEqual({ success: false, error: 'invalid_readiness' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns a failure object (not success) when the RPC resolves an error-shaped payload', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'evidence_required' },
      error: null,
    });

    const result = await assess_profile(validParams, 'user-1', 'token-1');

    expect(result).toEqual({ success: false, error: 'evidence_required' });
  });

  it('throws when the supabase client returns a non-null error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

    await expect(assess_profile(validParams, 'user-1', 'token-1')).rejects.toThrow(
      /record_athlete_decision failed:/,
    );
  });
});
