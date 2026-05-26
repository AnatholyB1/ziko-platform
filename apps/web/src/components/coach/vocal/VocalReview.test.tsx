import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VocalReview } from './VocalReview';

// RED stub — VocalReview.tsx does not exist yet.
// These tests will fail with "Cannot find module './VocalReview'" until Wave 2.

describe('VocalReview', () => {
  it('renders transcript text', () => {
    render(
      <VocalReview
        transcript="test text"
        onValidate={vi.fn()}
        onRelaunch={vi.fn()}
      />
    );
    expect(screen.getByText('test text')).toBeDefined();
  });

  it('renders Valider and Relancer buttons', () => {
    render(
      <VocalReview
        transcript="Some transcript"
        onValidate={vi.fn()}
        onRelaunch={vi.fn()}
      />
    );
    expect(screen.getByText('Valider')).toBeDefined();
    expect(screen.getByText('Relancer')).toBeDefined();
  });
});
