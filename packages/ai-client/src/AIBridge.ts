import type {
  UserProfile,
  PluginManifest,
  AISkill,
  AIMessage,
} from '@ziko/plugin-sdk';

// ── Payload sent to the AI agent API ────────────────────
export interface AIRequestPayload {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  user_context: {
    profile: UserProfile | null;
    today_workout: Record<string, unknown> | null;
    active_plugins: string[];
    plugin_contexts: Record<string, unknown>;
  };
}

// ── SSE chunk from the agent ─────────────────────────────
export interface AIStreamChunk {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  error?: string;
}

// ── Core system prompt ────────────────────────────────────
const CORE_SYSTEM_PROMPT = `You are Ziko, an expert AI fitness coach. 
You are empathetic, motivating, and science-based. 
You have access to the user's fitness profile, workout history, and any active plugin data.
Always personalise your advice based on the user's goals and context provided.
Keep responses concise unless the user asks for detail. Use markdown sparingly.`;

// ── AIBridge ─────────────────────────────────────────────
export class AIBridge {
  private agentUrl: string;
  private apiKey: string;
  private skillsByPlugin: Map<string, AISkill[]> = new Map();
  private activePluginManifests: Map<string, PluginManifest> = new Map();

  constructor(agentUrl: string, apiKey: string) {
    if (!agentUrl) throw new Error('AIBridge: agentUrl is required');
    this.agentUrl = agentUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  // ── Plugin & Skill management ─────────────────────────

  registerSkill(pluginId: string, skill: AISkill): void {
    const existing = this.skillsByPlugin.get(pluginId) ?? [];
    const deduplicated = existing.filter((s) => s.name !== skill.name);
    this.skillsByPlugin.set(pluginId, [...deduplicated, skill]);
  }

  registerPlugin(manifest: PluginManifest): void {
    this.activePluginManifests.set(manifest.id, manifest);
    for (const skill of manifest.aiSkills ?? []) {
      this.registerSkill(manifest.id, skill);
    }
  }

  unregisterPlugin(pluginId: string): void {
    this.skillsByPlugin.delete(pluginId);
    this.activePluginManifests.delete(pluginId);
  }

  // ── System prompt assembly ────────────────────────────

  buildSystemPrompt(
    userProfile: UserProfile | null,
    activePlugins: PluginManifest[],
  ): string {
    const parts: string[] = [CORE_SYSTEM_PROMPT];

    if (userProfile) {
      parts.push(
        `\n## User Profile\n` +
          `Name: ${userProfile.name ?? 'Unknown'}\n` +
          `Age: ${userProfile.age ?? 'N/A'}\n` +
          `Weight: ${userProfile.weight_kg ? `${userProfile.weight_kg} kg` : 'N/A'}\n` +
          `Height: ${userProfile.height_cm ? `${userProfile.height_cm} cm` : 'N/A'}\n` +
          `Goal: ${userProfile.goal ?? 'N/A'}\n` +
          `Units: ${userProfile.units}`,
      );
    }

    for (const plugin of activePlugins) {
      if (plugin.aiSystemPromptAddition) {
        parts.push(`\n## Plugin: ${plugin.name}\n${plugin.aiSystemPromptAddition}`);
      }
      if (plugin.aiPersonaTraits?.length) {
        parts.push(
          `\n## Personality Traits (from ${plugin.name})\n` +
            plugin.aiPersonaTraits.map((t) => `- ${t}`).join('\n'),
        );
      }
    }

    const allSkills = activePlugins.flatMap((p) => p.aiSkills ?? []);
    if (allSkills.length > 0) {
      parts.push(
        '\n## Available Skills\n' +
          allSkills
            .map((s) => `- **${s.name}**: ${s.description}`)
            .join('\n'),
      );
    }

    return parts.join('\n');
  }

  // ── Message sending with SSE streaming ───────────────

  async sendMessage(
    conversationId: string,
    message: string,
    history: AIMessage[],
    userContext: AIRequestPayload['user_context'],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const systemPrompt = this.buildSystemPrompt(
      userContext.profile,
      Array.from(this.activePluginManifests.values()),
    );

    const messages = history
      .filter((m) => m.role !== 'system')
      .slice(-20) // last 20 messages for context window
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    messages.push({ role: 'user', content: message });

    const payload: AIRequestPayload = {
      system: systemPrompt,
      messages,
      user_context: userContext,
    };

    const response = await fetch(`${this.agentUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Conversation-Id': conversationId,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error ${response.status}: ${error}`);
    }

    // SSE parsing
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const chunk: AIStreamChunk = JSON.parse(data);
            if (chunk.type === 'chunk' && chunk.content) {
              onChunk(chunk.content);
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error ?? 'Stream error');
            }
          } catch {
            // non-JSON SSE line, treat as raw text
            if (data && data !== '[DONE]') onChunk(data);
          }
        }
      }
    }
  }

  // ── Non-streaming fallback ────────────────────────────

  async sendMessageSync(
    conversationId: string,
    message: string,
    history: AIMessage[],
    userContext: AIRequestPayload['user_context'],
    signal?: AbortSignal,
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(
      userContext.profile,
      Array.from(this.activePluginManifests.values()),
    );

    const messages = history
      .filter((m) => m.role !== 'system')
      .slice(-20)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    messages.push({ role: 'user', content: message });

    const payload: AIRequestPayload = {
      system: systemPrompt,
      messages,
      user_context: userContext,
    };

    const response = await fetch(`${this.agentUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Conversation-Id': conversationId,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    return data.content ?? data.message ?? '';
  }
}
