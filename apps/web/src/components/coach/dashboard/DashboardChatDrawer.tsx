'use client';

import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { MessageBubble } from '@/components/coach/MessageBubble';
import type { Message } from '@/components/coach/MessageBubble';
import { ChatInputBar } from '@/components/coach/ChatInputBar';
import { TypingIndicator } from './TypingIndicator';

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

interface DashboardContext {
  sport_type: string;
  metrics: Record<string, string>;
}

interface DashboardChatDrawerProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  dashboardContextRef: React.MutableRefObject<DashboardContext | null>;
}

export function DashboardChatDrawer({
  clientId,
  isOpen,
  onClose,
  dashboardContextRef,
}: DashboardChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasChunk, setHasChunk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);

  const streamChat = useCallback(
    async (userMessage: string) => {
      const userMsg: Message = { id: genId(), role: 'user', content: userMessage };
      const updatedHistory = [...messages, userMsg]
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setHasChunk(false);
      setError(null);

      try {
        const res = await fetch('/api/coach/ai/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedHistory,
            conversation_id: conversationIdRef.current ?? undefined,
            dashboard_context: dashboardContextRef.current,
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
                  const newId = genId();
                  aiMsgId = newId;
                  setMessages((prev) => [
                    ...prev,
                    { id: newId, role: 'assistant', content: event.content ?? '' },
                  ]);
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
        console.error('[DashboardChatDrawer] stream error:', err);
        setError('Erreur de connexion. Réessayez dans un instant.');
        setIsStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientId, messages, dashboardContextRef],
  );

  const showTypingIndicator = isStreaming && !hasChunk;

  return (
    <>
      {/* Backdrop — 20% opacity, does not block chart area */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[420px] bg-white border-l border-[#E2E0DA] z-30 transform transition-transform duration-200 ease-out shadow-xl flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Chat IA — contexte dashboard"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 border-b border-[#E2E0DA] flex-shrink-0"
          style={{ height: 56 }}
        >
          <span className="text-[15px] font-semibold text-[#1C1A17]">IA Coach</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-[#6B6963] hover:text-[#1C1A17] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto bg-[#F7F6F3] p-4 min-h-0">
          <div className="flex flex-col">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {showTypingIndicator && <TypingIndicator />}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mt-2">
                <span>Impossible d&apos;envoyer le message. Réessayer.</span>
                <button
                  className="ml-2 font-medium"
                  style={{ color: '#FF5C1A' }}
                  onClick={() => setError(null)}
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 bg-white border-t border-[#E2E0DA]">
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
    </>
  );
}
