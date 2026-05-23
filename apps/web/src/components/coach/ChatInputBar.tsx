'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { IoSendOutline } from 'react-icons/io5';

interface ChatInputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (msg: string) => void;
  disabled: boolean;
}

export function ChatInputBar({ value, onChange, onSubmit, disabled }: ChatInputBarProps) {
  const sendBtnRef = useRef<HTMLButtonElement>(null);

  function handleSend() {
    if (!value.trim() || disabled) return;
    if (sendBtnRef.current) {
      gsap.to(sendBtnRef.current, {
        scale: 0.94,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power3.out',
      });
    }
    onSubmit(value.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) handleSend();
    }
  }

  return (
    <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-white border-t border-border px-6 py-4">
      <div className="flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">Message à l'IA Coach</label>
        <textarea
          id="chat-input"
          className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none min-h-[44px] max-h-[120px]"
          placeholder="Posez une question à votre IA Coach..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />
        <button
          ref={sendBtnRef}
          aria-label="Envoyer"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="ml-3 w-10 h-10 rounded-lg flex items-center justify-center bg-primary hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <IoSendOutline size={18} color="#FFFFFF" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted">
        <span>Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</span>
      </div>
    </div>
  );
}
