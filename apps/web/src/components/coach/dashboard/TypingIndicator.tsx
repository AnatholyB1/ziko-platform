'use client';

export function TypingIndicator() {
  return (
    <>
      <style>{`
        @keyframes typing-dot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-[#FF5C1A]">
          Z
        </div>
        <div className="bg-white border border-[#E2E0DA] rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center">
          <div className="flex items-center gap-1">
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#6B6963',
                animation: 'typing-dot 0.9s ease-in-out infinite',
                animationDelay: '0ms',
              }}
            />
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#6B6963',
                animation: 'typing-dot 0.9s ease-in-out infinite',
                animationDelay: '200ms',
              }}
            />
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#6B6963',
                animation: 'typing-dot 0.9s ease-in-out infinite',
                animationDelay: '400ms',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
