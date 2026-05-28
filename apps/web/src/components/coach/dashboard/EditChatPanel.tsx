'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import type { Widget } from '@/types/dashboard';
import { MessageBubble } from '@/components/coach/MessageBubble';
import type { Message } from '@/components/coach/MessageBubble';
import { ChatInputBar } from '@/components/coach/ChatInputBar';
import { TypingIndicator } from './TypingIndicator';

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

interface EditChatPanelProps {
  clientId: string;
  configRef: React.MutableRefObject<Widget[]>;
  onWidgetsUpdate: (widgets: Widget[]) => void;
  initialWidgets: Widget[];
  onStreamingChange?: (v: boolean) => void;
}

export function EditChatPanel({
  clientId,
  configRef,
  onWidgetsUpdate,
  initialWidgets,
  onStreamingChange,
}: EditChatPanelProps) {
  // Build the opening message from current widget titles
  const openingContent = `Votre dashboard affiche actuellement : ${
    initialWidgets.map((w) => w.title).join(', ')
  }. Dites-moi ce que vous souhaitez modifier. Exemples : 'Mettez le score de sommeil en premier', 'Supprimez la note', 'Ajoutez un graphe de poids sur 30 jours'.`;

  const OPENING_MESSAGE: Message = {
    id: 'system-opening',
    role: 'assistant',
    content: openingContent,
  };

  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether we have received any chunk for the current stream (to show TypingIndicator vs bubble)
  const [hasChunk, setHasChunk] = useState(false);

  const conversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);

  // Sync isStreaming to parent
  useEffect(() => {
    onStreamingChange?.(isStreaming);
  }, [isStreaming, onStreamingChange]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Animate newly appended message bubbles
  function animateLastBubble() {
    if (messagesListRef.current) {
      const children = messagesListRef.current.children;
      const lastChild = children[children.length - 1] as HTMLElement | null;
      if (lastChild) {
        gsap.from(lastChild, { y: 8, opacity: 0, duration: 0.15, ease: 'power2.out' });
      }
    }
  }

  const streamEdit = useCallback(
    async (userMessage: string) => {
      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content: userMessage,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setHasChunk(false);
      setError(null);

      // Animate user bubble after render
      setTimeout(() => animateLastBubble(), 0);

      // Build conversation history (exclude the static opening message from API calls)
      const conversationHistory = [...messages, userMsg]
        .filter((m) => m.id !== 'system-opening')
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch(`/api/coach/dashboards/${clientId}/ai-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationHistory,
            currentWidgets: configRef.current, // always current — avoids stale closure (PITFALLS #5)
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let aiMsgId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;

            const raw = line.slice(6);
            if (raw === '[DONE]') {
              setIsStreaming(false);
              continue;
            }

            try {
              const event = JSON.parse(raw);

              if (event.type === 'meta') {
                conversationIdRef.current = event.conversation_id;
              } else if (event.type === 'chunk') {
                setHasChunk(true);
                if (aiMsgId === null) {
                  // Create assistant message placeholder on first chunk
                  const newId = genId();
                  aiMsgId = newId;
                  setMessages((prev) => [
                    ...prev,
                    { id: newId, role: 'assistant', content: event.content ?? '' },
                  ]);
                  setTimeout(() => animateLastBubble(), 0);
                } else {
                  const capturedId = aiMsgId;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === capturedId
                        ? { ...m, content: m.content + (event.content ?? '') }
                        : m,
                    ),
                  );
                }
              } else if (event.type === 'tool_result') {
                // Atomic update — snap preview to new state instantly (D-11, PITFALLS #5)
                onWidgetsUpdate(event.widgets as Widget[]);
                setIsStreaming(false);
                setHasChunk(true); // remove typing indicator
              } else if (event.type === 'error') {
                setError(event.error ?? event.message ?? 'Erreur inconnue');
                setIsStreaming(false);
              }
            } catch {
              // Malformed JSON — skip (T-03-08)
            }
          }
        }
      } catch (err) {
        console.error('[EditChatPanel] stream error:', err);
        setError('Erreur de connexion. Réessayez dans un instant.');
        setIsStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientId, configRef, messages, onWidgetsUpdate],
  );

  // Show typing indicator when streaming but no chunk received yet
  const showTypingIndicator = isStreaming && !hasChunk;

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-[#E2E0DA]"
    >
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 min-h-0">
        <div ref={messagesListRef} className="flex flex-col">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator — shown while streaming before first chunk */}
          {showTypingIndicator && <TypingIndicator />}

          {/* Error banner */}
          {error && (
            <div
              className="rounded-lg px-4 py-2 flex items-start gap-3 text-sm mt-3"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid rgba(239,68,68,0.30)',
              }}
            >
              <span style={{ color: '#1C1A17' }} className="flex-1">{error}</span>
              <button
                className="font-semibold underline cursor-pointer"
                style={{ color: '#FF5C1A' }}
                onClick={() => setError(null)}
              >
                Fermer
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div
        className="flex-shrink-0"
        style={{ borderTop: '1px solid #E2E0DA' }}
      >
        <ChatInputBar
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(msg) => {
            setInputValue('');
            streamEdit(msg);
          }}
          disabled={isStreaming}
        />
      </div>
    </div>
  );
}
