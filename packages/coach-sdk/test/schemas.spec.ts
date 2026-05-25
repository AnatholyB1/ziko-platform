import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ImportedProgramSchema,
  CoachClientLinkSchema,
  CoachProfileSchema,
} from '../src/schemas/index.js';

// Valid v4 UUIDs (Zod v4 uses RFC 4122 strict validation — version/variant bits required)
const UUID_LINK = '19e3cefa-dd66-4cc8-859c-36c0a54f62d8';
const UUID_COACH = '537e232c-5be5-411d-b729-6905971fe068';
const UUID_CLIENT = '4219ca2e-ebc2-4b70-be5d-e816e225b5d4';
const UUID_USER = 'a8727855-b591-4a93-b53f-e201f707d32b';

describe('ImportedProgramSchema', () => {
  it('parses a minimal valid program', () => {
    const r = ImportedProgramSchema.safeParse({
      name: 'Hyrox 8w',
      weeks: [
        {
          week_number: 1,
          sessions: [
            {
              name: 'Day 1',
              exercises: [{ name: 'Squat', sets: 5, reps: 5 }],
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative reps', () => {
    const r = ImportedProgramSchema.safeParse({
      name: 'x',
      weeks: [{ week_number: 1, sessions: [{ name: 'd', exercises: [{ name: 'x', sets: 1, reps: -1 }] }] }],
    });
    expect(r.success).toBe(false);
    expect(r.error).toBeInstanceOf(z.ZodError);  // boundary instanceof check
  });
});

describe('CoachClientLinkSchema', () => {
  it('accepts active link', () => {
    const r = CoachClientLinkSchema.safeParse({
      id: UUID_LINK,
      coach_id: UUID_COACH,
      client_id: UUID_CLIENT,
      created_at: new Date().toISOString(),
      expires_at: null,
      revoked_at: null,
    });
    expect(r.success).toBe(true);
  });
});

describe('CoachProfileSchema', () => {
  it('accepts valid kyc_status', () => {
    const r = CoachProfileSchema.safeParse({
      user_id: UUID_USER,
      display_name: 'Anne',
      bio: null,
      specialties: ['hyrox', 'mobility'],
      website: null,
      photo_url: null,
      kyc_status: 'pending',
      kyc_docs: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(r.success).toBe(true);
  });
});
