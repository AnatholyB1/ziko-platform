'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoSparklesOutline, IoRefreshOutline } from 'react-icons/io5';
import gsap from 'gsap';

interface AdaptWithAIButtonProps {
  programId: string;
  programName: string;
  locale: string;
  disabled?: boolean;
}

export function AdaptWithAIButton({ programId, programName: _programName, locale, disabled }: AdaptWithAIButtonProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  function handleAdapt(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (disabled || isNavigating) return;

    // GSAP press feedback
    gsap.to('.adapt-btn', {
      scale: 0.97,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power3.out',
    });

    setIsNavigating(true);
    router.push(`/${locale}/coach/ai?template=${programId}`);
  }

  return (
    <button
      type="button"
      className="adapt-btn flex items-center gap-2 border border-primary text-primary bg-transparent rounded-lg text-sm font-semibold h-10 px-4 py-2 hover:bg-[#FF5C1A]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={disabled || isNavigating}
      onClick={handleAdapt}
      title={disabled ? "Liez d'abord un client pour adapter ce programme" : undefined}
    >
      {isNavigating ? (
        <>
          <IoRefreshOutline size={16} className="animate-spin" />
          Ouverture...
        </>
      ) : (
        <>
          <IoSparklesOutline size={16} />
          Adapter avec l&apos;IA
        </>
      )}
    </button>
  );
}
