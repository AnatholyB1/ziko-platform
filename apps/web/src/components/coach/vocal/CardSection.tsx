'use client';

import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import type { CardSection as CardSectionKey } from './vocalReducer';

interface CardSectionProps {
  sectionKey: CardSectionKey;
  label: string;
  value: string;
  isEditing: boolean;
  disabled: boolean;
  onEdit: (sectionKey: CardSectionKey) => void;
  onChange: (value: string) => void;
}

export function CardSection({
  sectionKey,
  label,
  value,
  isEditing,
  disabled,
  onEdit,
  onChange,
}: CardSectionProps): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      gsap.from(textareaRef.current, { opacity: 0, y: 4, duration: 0.15, ease: 'power2.out' });
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEdit(sectionKey);
    }
  };

  return (
    <div className="card-section" style={{ marginBottom: 0 }}>
      <p
        style={{
          fontSize: 12,
          fontWeight: 400,
          color: '#6B6963',
          marginBottom: 8,
          margin: '0 0 8px 0',
        }}
      >
        {label}
      </p>

      {isEditing ? (
        <textarea
          ref={textareaRef}
          aria-label={label}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #1C1A17',
            borderRadius: 6,
            padding: 12,
            minHeight: 80,
            fontSize: 16,
            fontWeight: 400,
            color: '#1C1A17',
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            boxShadow: '0 0 0 3px rgba(28,26,23,0.06)',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <div
          role="button"
          aria-label={`Modifier : ${label}`}
          tabIndex={0}
          onClick={() => {
            if (!disabled) onEdit(sectionKey);
          }}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => { if (!disabled) setIsHovered(true); }}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            backgroundColor: '#F0EFE9',
            border: isHovered && !disabled ? '1px solid #1C1A17' : '1px solid #E2E0DA',
            borderRadius: 6,
            padding: 12,
            minHeight: 60,
            fontSize: 16,
            fontWeight: 400,
            color: '#1C1A17',
            lineHeight: 1.6,
            cursor: disabled ? 'default' : 'pointer',
            transition: 'border-color 150ms ease',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
