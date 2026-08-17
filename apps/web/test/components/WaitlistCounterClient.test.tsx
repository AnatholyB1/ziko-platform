// Phase 5 plan 05-03 (T-05-07) — pins WaitlistCounterClient's three-mutually-exclusive-
// state contract: no number below the reveal point (FOND-01), a live descending count
// above it (FOND-02), exactly one fetch per mount and no polling (FOND-04), and a
// distinct completion panel — never a zero-as-count — once the offer is full (FOND-05).
// happy-dom (this file matches `**/*.test.tsx`, which `environmentMatchGlobs` routes to
// `happy-dom`). No @testing-library/jest-dom in this repo — assertions read plain DOM
// properties/text content rather than jest-dom matchers, mirroring WaitlistRoleForm.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WaitlistCounterClient } from '@/components/marketing/WaitlistCounterClient';

const frProps = {
  staticOfferSentence: 'Les 200 premiers membres obtiennent le premium à vie.',
  remainingTemplate: 'Plus que {remaining} places fondateur',
  completeHeading: 'Les 200 places fondateurs sont prises',
  completeBody: 'Inscrivez-vous quand même pour être averti·e du lancement.',
};

const enProps = {
  staticOfferSentence: 'The first 200 members get lifetime premium.',
  remainingTemplate: 'Only {remaining} founder spots left',
  completeHeading: 'All 200 founder spots are taken',
  completeBody: 'Sign up anyway to be notified when we launch.',
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WaitlistCounterClient (T-05-07)', () => {
  it('renders a placeholder shape before the fetch resolves, with no digit and no error text', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    render(<WaitlistCounterClient {...frProps} />);

    expect(screen.queryByText(/\d/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/error|erreur/i);
  });

  it('renders the static offer sentence and no remaining value when the display verdict is false (FOND-01)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ shouldDisplay: false, remaining: 170, isFull: false }));
    render(<WaitlistCounterClient {...frProps} />);

    await screen.findByText(frProps.staticOfferSentence);
    expect(document.body.textContent).not.toContain('170');
  });

  it('renders the live count and no placeholder token when the display verdict is true (FOND-02)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ shouldDisplay: true, remaining: 12, isFull: false }));
    render(<WaitlistCounterClient {...frProps} />);

    await waitFor(() => {
      expect(document.body.textContent).toContain('12');
    });
    expect(document.body.textContent).not.toContain('{remaining}');
  });

  it('renders the completion heading and body, with no standalone zero-as-count, when the offer is full (FOND-05, D-10)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ shouldDisplay: true, remaining: 0, isFull: true }));
    render(<WaitlistCounterClient {...frProps} />);

    await screen.findByText(frProps.completeHeading);
    expect(screen.getByText(frProps.completeBody)).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/plus que 0|only 0/i);
  });

  it('the full verdict wins over the count even when the display verdict is also true (belt and braces on D-10)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ shouldDisplay: true, remaining: 12, isFull: true }));
    render(<WaitlistCounterClient {...frProps} />);

    await screen.findByText(frProps.completeHeading);
    expect(document.body.textContent).not.toContain('12');
  });

  it('renders the static offer sentence with no visible error when the fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    render(<WaitlistCounterClient {...frProps} />);

    await screen.findByText(frProps.staticOfferSentence);
    expect(document.body.textContent).not.toMatch(/error|erreur/i);
  });

  it('renders the static offer sentence when the response body is missing fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ shouldDisplay: true }));
    render(<WaitlistCounterClient {...frProps} />);

    await screen.findByText(frProps.staticOfferSentence);
  });

  it('renders the static offer sentence on a non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, false));
    render(<WaitlistCounterClient {...frProps} />);

    await screen.findByText(frProps.staticOfferSentence);
  });

  it('calls fetch exactly once across a mounted lifetime advanced well past thirty seconds (FOND-04)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ shouldDisplay: false, remaining: 170, isFull: false }));
    render(<WaitlistCounterClient {...frProps} />);
    await screen.findByText(frProps.staticOfferSentence);

    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(60_000);
    vi.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders the same output for English copy as for French, differing only in the given strings', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ shouldDisplay: true, remaining: 12, isFull: false }));
    render(<WaitlistCounterClient {...enProps} />);

    await waitFor(() => {
      expect(document.body.textContent).toContain('12');
    });
    expect(document.body.textContent).toContain('Only');
  });
});
