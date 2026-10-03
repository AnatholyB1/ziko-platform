import { AIBridge } from '@ziko/ai-client';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const agentUrl = `${apiUrl}/ai`;

export const aiBridge = new AIBridge(agentUrl);
