import type {
  UserProfile,
  PluginManifest,
  AISkill,
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
  type: 'chunk' | 'done' | 'error' | 'actions' | 'meta';
  content?: string;
  error?: string;
  actions?: AIAction[];
  conversation_id?: string;
}

// ── AI Action (navigation, etc.) ──────────────────────────
export interface AIAction {
  type: 'navigate';
  screen: string;
  params?: Record<string, string>;
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
  private skillsByPlugin: Map<string, AISkill[]> = new Map();
  private activePluginManifests: Map<string, PluginManifest> = new Map();

  constructor(agentUrl: string) {
    if (!agentUrl) throw new Error('AIBridge: agentUrl is required');
    this.agentUrl = agentUrl.replace(/\/$/, '');
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
    userContext: AIRequestPayload['user_context'],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    onActions?: (actions: AIAction[]) => void,
    authToken?: string,
  ): Promise<void> {
    if (!authToken) {
      return Promise.reject(new Error('AIBridge.sendMessage: authToken is required'));
    }

    const systemPrompt = this.buildSystemPrompt(
      userContext.profile,
      Array.from(this.activePluginManifests.values()),
    );

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: message },
    ];

    const payload: AIRequestPayload = {
      system: systemPrompt,
      messages,
      user_context: userContext,
    };

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;
      xhr.open('POST', `${this.agentUrl}/chat/stream`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.setRequestHeader('X-Conversation-Id', conversationId);

      let processedLength = 0;
      let buffer = '';
      let done = false;

      const processChunk = (text: string) => {
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data) as AIStreamChunk;
            if (chunk.type === 'chunk' && chunk.content) {
              onChunk(chunk.content);
            } else if (chunk.type === 'actions' && chunk.actions && onActions) {
              onActions(chunk.actions);
            } else if (chunk.type === 'error') {
              settled = true;
              reject(new Error(chunk.error ?? 'Stream error'));
            }
          } catch {
            // Ignore JSON parse errors for partial chunks
          }
        }
      };

      xhr.onprogress = () => {
        if (done) return;
        const newText = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        if (newText) processChunk(newText);
      };

      xhr.onload = () => {
        done = true;
        settled = true;
        // Process any remaining bytes
        const remaining = xhr.responseText.slice(processedLength);
        if (remaining) processChunk(remaining);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`AI API error ${xhr.status}: ${xhr.responseText.slice(0, 500)}`));
        }
      };

      xhr.onerror = () => { settled = true; reject(new Error('Network error')); };
      xhr.ontimeout = () => { settled = true; reject(new Error('Request timeout')); };

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            if (settled) return;
            settled = true;
            xhr.abort();
            reject(new Error('Aborted'));
          },
          { once: true },
        );
      }

      xhr.send(JSON.stringify(payload));
    });
  }
}
