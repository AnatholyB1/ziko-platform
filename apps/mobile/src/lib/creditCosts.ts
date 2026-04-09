// Static credit costs mirroring backend/api/src/config/credits.ts
// These are display-only constants for cost labels on UI buttons.
// Authoritative costs are enforced server-side by creditGate middleware.
export const CREDIT_COSTS = {
  chat: 4,
  scan: 3,
  program: 4,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
