// Re-export from @ziko/plugin-sdk so the entire app shares one store instance.
// The store definition now lives in packages/plugin-sdk/src/creditStore.ts.
export { useCreditStore } from '@ziko/plugin-sdk';
export type { CreditExhaustionData } from '@ziko/plugin-sdk';
