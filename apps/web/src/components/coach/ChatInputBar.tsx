'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { IoSendOutline, IoSparklesOutline } from 'react-icons/io5';

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
    <div
      className="fixed bottom-0 bg-white border-t border-[#E2E0DA] px-6 py-4"
      style={{ left: '240px', right: 0 }}
    >
      <div className="flex items-end gap-2">
        <textarea
          className="flex-1 bg-[#F7F6F3] border border-[#E2E0DA] rounded-lg px-4 py-2 text-sm text-[#1C1A17] placeholder:text-[#6B6963] focus:outline-none focus:ring-2 focus:ring-[#FF5C1A]/20 focus:border-[#FF5C1A] resize-none min-h-[44px] max-h-[120px]"
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
          className="ml-3 w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          style={{ backgroundColor: '#FF5C1A' }}
        >
          <IoSendOutline size={18} color="#FFFFFF" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-[#6B6963]">
        <IoSparklesOutline size={12} />
        <span>Propulsé par Claude Sonnet · 3 outils disponibles</span>
      </div>
    </div>
  );
}
