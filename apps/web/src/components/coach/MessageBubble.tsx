'use client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-surface-alt rounded-2xl rounded-tr-sm px-4 py-2 max-w-[640px] ml-auto message-bubble">
          <p className="text-sm text-text">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div className="flex items-start gap-3 mb-3 message-bubble">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-primary"
      >
        Z
      </div>
      <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-2 max-w-[640px]">
        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}
