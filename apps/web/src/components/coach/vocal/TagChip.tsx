'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import type { TagKey } from './vocalReducer';

const TAG_LABELS: Record<TagKey, string> = {
  force: 'force',
  technique: 'technique',
  mental: 'mental',
  cardio: 'cardio',
  recuperation: 'récupération',
};

interface TagChipProps {
  tag: TagKey;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function TagChip({ tag, selected, onToggle, disabled, className }: TagChipProps): React.ReactElement {
  const chipRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (disabled) return;

    if (selected) {
      // Toggle OFF: scale shrink
      gsap.to(chipRef.current, { scale: 0.95, duration: 0.05, yoyo: true, repeat: 1 });
    } else {
      // Toggle ON: scale bounce
      gsap.fromTo(chipRef.current, { scale: 0.85 }, { scale: 1, duration: 0.15, ease: 'back.out(1.4)' });
    }

    onToggle();
  };

  const selectedStyles: React.CSSProperties = {
    backgroundColor: '#1C1A17',
    color: '#FFFFFF',
    border: 'none',
  };

  const deselectedStyles: React.CSSProperties = {
    backgroundColor: '#F0EFE9',
    color: '#6B6963',
    border: '1px solid #E2E0DA',
  };

  return (
    <button
      ref={chipRef}
      role="checkbox"
      aria-checked={selected}
      aria-label={TAG_LABELS[tag]}
      onClick={handleClick}
      disabled={disabled}
      className={className}
      style={{
        height: 28,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 150ms ease, color 150ms ease',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        outline: 'none',
        ...(selected ? selectedStyles : deselectedStyles),
      }}
    >
      {TAG_LABELS[tag]}
    </button>
  );
}
