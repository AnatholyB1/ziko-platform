import { AIBridge } from '@ziko/ai-client';

const agentUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const apiKey = process.env.EXPO_PUBLIC_AI_AGENT_API_KEY ?? '';

export const aiBridge = new AIBridge(agentUrl, apiKey);
