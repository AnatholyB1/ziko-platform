import { AIBridge } from '@ziko/ai-client';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const agentUrl = `${apiUrl}/ai`;
const apiKey = process.env.EXPO_PUBLIC_AI_AGENT_API_KEY ?? '';

export const aiBridge = new AIBridge(agentUrl, apiKey);
