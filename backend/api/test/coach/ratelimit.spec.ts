import { describe, it } from 'vitest';

// INVITE-04: full integration suite lives in plan 06. These stubs lock the contract.

describe('coach/clients/ratelimit.redemptionRateLimit', () => {
  describe('IP bucket (5 / 15min sliding)', () => {
    it.todo('6th request from same IP within 15min returns 429');
    it.todo('429 response body shape EQUALS the 200 error envelope from db.ts (deep equal except http status)');
    it.todo('429 includes Retry-After header with seconds remaining');
  });
  describe('user bucket (10 / 1h sliding)', () => {
    it.todo('11th request from same user within 1h returns 429');
    it.todo('user-bucket 429 has the same envelope shape');
  });
  describe('composition (serial, IP first)', () => {
    it.todo('blown IP bucket does NOT call user bucket (verified via redis spy / quota math)');
    it.todo('successful IP check proceeds to user bucket');
  });
  describe('safety', () => {
    it.todo('returns 401 if c.get(auth) is undefined (auth middleware missed)');
  });
});
