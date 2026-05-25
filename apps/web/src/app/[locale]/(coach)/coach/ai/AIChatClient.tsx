'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import gsap from 'gsap';
import { useReducedMotion } from 'framer-motion';
import { IoSparklesOutline, IoAlertCircleOutline } from 'react-icons/io5';
import { MessageBubble } from '@/components/coach/MessageBubble';
import { ChatInputBar } from '@/components/coach/ChatInputBar';
import { CreditWidget } from '@/components/coach/CreditWidget';
import { ToolResultCard } from '@/components/coach/ToolResultCard';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ToolInvocation {
  toolName: string;
  status: 'pending' | 'success' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolInvocation[];
}

interface AIChatClientProps {
  initialConversationId: string | null;
}

// ─── Suggestion chips ──────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  'Analyser un client',
  'Générer un programme',
  'Voir les alertes',
];

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Component ─────────────────────────────────────────────────────────────

export function AIChatClient({ initialConversationId }: AIChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  // ── Page entrance animation ──────────────────────────────────────────────
  useEffect(() => {
    if (pageRef.current) {
      if (!prefersReducedMotion) {
        gsap.from(pageRef.current, { opacity: 0, y: 16, duration: 0.2, ease: 'power2.out' });
        if (messages.length === 0) {
          gsap.from(pageRef.current.querySelectorAll('.suggestion-chip'), {
            opacity: 0,
            y: 8,
            duration: 0.2,
            stagger: 0.06,
            ease: 'power2.out',
            delay: 0.1,
          });
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Streaming cursor blink ───────────────────────────────────────────────
  useEffect(() => {
    if (isStreaming && cursorRef.current && !prefersReducedMotion) {
      const tween = gsap.to(cursorRef.current, {
        opacity: 0,
        duration: 0.3,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
      return () => {
        tween.kill();
      };
    }
    if (!isStreaming && cursorRef.current) {
      gsap.killTweensOf(cursorRef.current);
    }
  }, [isStreaming, prefersReducedMotion]);

  // ── Auto-scroll to bottom ────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // ── Deep-link prefill ────────────────────────────────────────────────────
  useEffect(() => {
    const template = searchParams.get('template');
    const client = searchParams.get('client');
    if (template) {
      const prefill = `Adapte le programme [template: ${template}] pour [client: ${client ?? 'un de mes clients'}]. Analyse ses données récentes et ajuste les volumes si nécessaire.`;
      setInputValue(prefill);
      const timer = setTimeout(() => {
        if (prefill) streamChat(prefill);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── streamChat ───────────────────────────────────────────────────────────
  const streamChat = useCallback(async (userMessage: string) => {
    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: userMessage,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setError(null);

    // Placeholder AI message
    const aiId = genId();
    setMessages((prev) => [
      ...prev,
      { id: aiId, role: 'assistant', content: '' },
    ]);

    // Animate new user bubble
    setTimeout(() => {
      gsap.from(messagesRef.current?.lastElementChild ?? null, {
        opacity: 0,
        y: 12,
        duration: 0.18,
        ease: 'power2.out',
      });
    }, 0);

    try {
      const res = await fetch('/api/coach/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage }],
          conversation_id: conversationId,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
              setConversationId(event.conversation_id);
            } else if (event.type === 'chunk') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId
                    ? { ...m, content: m.content + (event.content ?? '') }
                    : m
                )
              );
            } else if (event.type === 'error') {
              setError(event.error ?? 'Erreur inconnue');
              setIsStreaming(false);
            }
          } catch {
            // Malformed JSON — skip
          }
        }
      }
    } catch (err) {
      console.error('[AIChatClient] stream error:', err);
      setError('Erreur de connexion. Réessayez dans un instant.');
      setIsStreaming(false);
    }
  }, [conversationId]);

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove any failed assistant message + error
      setMessages((prev) => prev.filter((m) => m.role !== 'assistant' || m.content.length > 0));
      setError(null);
      streamChat(lastUserMsg.content);
    }
  }, [messages, streamChat]);

  const lastMsg = messages[messages.length - 1];
  const isLastMsgStreaming = isStreaming && lastMsg?.role === 'assistant';

  return (
    <div ref={pageRef} className="absolute inset-0 flex flex-col bg-background chat-page overflow-hidden">
      {/* Screen-reader streaming announcement */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {isStreaming ? 'Génération de la réponse en cours...' : ''}
      </span>

      {/* Header */}
      <div className="hidden lg:flex h-16 bg-white border-b border-border px-6 items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <IoSparklesOutline size={20} className="text-primary" />
          <span className="text-lg font-semibold text-text">IA Coach</span>
          <span className="text-sm text-muted"> — Votre assistant coaching</span>
        </div>
        <CreditWidget />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4 min-h-0">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <IoSparklesOutline size={48} className="text-border" aria-hidden="true" />
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-text">
                Commencez une conversation
              </h2>
              <p className="text-sm text-muted max-w-sm">
                Demandez une analyse client, générez un programme ou consultez les alertes de surveillance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  className="suggestion-chip border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm text-text hover:bg-background cursor-pointer transition-colors bg-white"
                  onClick={() => {
                    setInputValue('');
                    streamChat(chip);
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div ref={messagesRef} className="flex flex-col gap-0">
            {messages.map((msg) => (
              <div key={msg.id}>
                {/* Tool invocation cards (within assistant messages) */}
                {msg.role === 'assistant' && msg.toolInvocations && msg.toolInvocations.length > 0 && (
                  <div className="mb-1">
                    {msg.toolInvocations.map((inv, i) => (
                      <ToolResultCard
                        key={i}
                        toolName={inv.toolName}
                        status={inv.status}
                        args={inv.args}
                        result={inv.result}
                      />
                    ))}
                  </div>
                )}
                <MessageBubble message={msg} />
                {/* Streaming indicator on last assistant message */}
                {isLastMsgStreaming && msg.id === lastMsg?.id && (
                  <div className="flex items-center gap-1 ml-11 mb-2">
                    <span ref={cursorRef} className="stream-cursor text-primary font-bold">|</span>
                    <p className="text-xs text-muted">Génération en cours...</p>
                  </div>
                )}
              </div>
            ))}

            {/* Error state */}
            {error && (
              <div className="bg-danger-subtle border border-danger/30 rounded-lg px-4 py-2 flex items-start gap-3 text-sm mt-3 error-card">
                <IoAlertCircleOutline size={16} className="flex-shrink-0 mt-0.5 text-danger" />
                <span className="text-text flex-1">{error}</span>
                <button
                  className="text-primary font-semibold underline cursor-pointer ml-auto flex-shrink-0"
                  onClick={handleRetry}
                >
                  Réessayer
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-border bg-white">
        <ChatInputBar
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(msg) => {
            setInputValue('');
            streamChat(msg);
          }}
          disabled={isStreaming}
        />
      </div>
    </div>
  );
}
