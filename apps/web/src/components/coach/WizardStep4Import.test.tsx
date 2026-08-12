import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { WizardStep4Import } from './WizardStep4Import';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import frMessages from '../../../messages/fr.json';

// RED harness — the review screen (view: 'review') does not exist yet on
// WizardStep4Import.tsx. Every test below drives the component through the
// existing (Phase 3) import pipeline up to the "Continuer ->" click, then
// asserts on review-screen copy/behavior that ships in plan 04-04.
// These tests are EXPECTED TO FAIL until 04-04 lands.

type CommitResult = { status: number; body: unknown };

const TEMPLATE_PARSED = {
  overall_confidence: 0.9,
  name: 'Programme Force',
  weeks: [{ sessions: [{}, {}, {}] }],
};
const DA_PARSED = { overall_confidence: 0.2 };

let commitHandlers: Record<string, () => Promise<CommitResult>>;
let uuidCounter = 0;

function defaultCommitHandlers(): Record<string, () => Promise<CommitResult>> {
  return {
    'imp-template': () => Promise.resolve({ status: 200, body: { program_id: 'prog-imp-template' } }),
    'imp-da': () => Promise.resolve({ status: 200, body: { program_id: 'prog-imp-da' } }),
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function routerImpl(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = (init?.method ?? 'GET').toUpperCase();

  if (method === 'POST' && url === 'https://api.test/coach/imports') {
    const parsedBody = JSON.parse(String(init?.body ?? '{}')) as { filename: string };
    const id = parsedBody.filename === 'programme.pdf' ? 'imp-template' : 'imp-da';
    return jsonResponse(200, { import_id: id, signed_upload_url: `https://storage.test/upload/${id}` });
  }
  if (method === 'PUT' && url.startsWith('https://storage.test/upload/')) {
    return jsonResponse(200, {});
  }
  if (method === 'PUT' && url.endsWith('/status')) {
    return jsonResponse(200, {});
  }
  if (method === 'POST' && url.endsWith('/parse')) {
    return jsonResponse(202, {});
  }
  if (method === 'GET' && url === 'https://api.test/coach/imports/imp-template') {
    return jsonResponse(200, { import: { status: 'ready', error_message: null, parsed_data: TEMPLATE_PARSED } });
  }
  if (method === 'GET' && url === 'https://api.test/coach/imports/imp-da') {
    return jsonResponse(200, { import: { status: 'ready', error_message: null, parsed_data: DA_PARSED } });
  }
  if (method === 'PUT' && url.endsWith('/commit')) {
    const match = url.match(/\/coach\/imports\/([^/]+)\/commit$/);
    const importId = match ? match[1] : '';
    const handler = commitHandlers[importId];
    if (!handler) throw new Error(`unmocked fetch: ${method} ${url}`);
    const result = await handler();
    return jsonResponse(result.status, result.body);
  }
  throw new Error(`unmocked fetch: ${method} ${url}`);
}

function renderStep4(onSuccess: () => void, onSkip: () => void): HTMLElement {
  const { container } = render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      <WizardStep4Import
        userId="coach-1"
        apiUrl="https://api.test"
        jwt="jwt-token"
        onSuccess={onSuccess}
        onSkip={onSkip}
      />
    </NextIntlClientProvider>,
  );
  return container;
}

const templateFile = new File(['dummy content'], 'programme.pdf', { type: 'application/pdf' });
const daFile = new File(['dummy content'], 'da-coach.pdf', { type: 'application/pdf' });

function selectFiles(container: HTMLElement, files: File[]): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
}

async function driveToReview(container: HTMLElement): Promise<void> {
  await act(async () => {
    selectFiles(container, [templateFile, daFile]);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Continuer →' }));
  });
}

function fetchMockCalls(): Array<[string, RequestInit | undefined]> {
  return (globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit | undefined]> } }).mock.calls.map(
    ([input, init]) => [String(input), init],
  );
}

beforeEach(() => {
  commitHandlers = defaultCommitHandlers();
  vi.stubGlobal('fetch', vi.fn(routerImpl));
  vi.useFakeTimers();
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-' + ++uuidCounter });
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('WizardStep4Import review screen', () => {
  it('renders a consolidated review list of every analysed doc', async () => {
    const container = renderStep4(vi.fn(), vi.fn());
    await driveToReview(container);

    expect(screen.getByText("Vérifie tes documents avant l'import")).toBeDefined();
    expect(screen.getByText('Confirme le type de chaque document, puis lance l\'import.')).toBeDefined();
    expect(screen.getByText('programme.pdf')).toBeDefined();
    expect(screen.getByText('da-coach.pdf')).toBeDefined();
    expect(screen.getAllByText('Enregistré comme contexte')).toHaveLength(1);
    expect(screen.queryByText("Envoie-moi tes docs et je m'occupe du reste.")).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('type correction updates count and the live commit set', async () => {
    const container = renderStep4(vi.fn(), vi.fn());
    await driveToReview(container);

    expect(screen.getByText('1 programme sera importé')).toBeDefined();

    // Row order follows fileStates insertion order: [programme.pdf, da-coach.pdf]
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Template programme' })[1]);
    });
    expect(screen.getByText('2 programmes seront importés')).toBeDefined();
    expect(screen.queryByText('1 programme sera importé')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'DA coach' })[0]);
    });
    expect(screen.getByText('1 programme sera importé')).toBeDefined();
  });

  it('skip on review screen exits without committing', async () => {
    const onSuccess = vi.fn();
    const onSkip = vi.fn();
    const container = renderStep4(onSuccess, onSkip);
    await driveToReview(container);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Ignorer pour l'instant" }));
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    const calls = fetchMockCalls();
    expect(calls.some(([url]) => url.endsWith('/commit'))).toBe(false);
  });

  it('parallel commit fires only for template docs', async () => {
    const container = renderStep4(vi.fn(), vi.fn());
    await driveToReview(container);

    // Correct da-coach.pdf (second row) to 'Template programme' so both docs are committable.
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Template programme' })[1]);
    });

    let resolveTemplate!: (value: CommitResult) => void;
    let resolveDa!: (value: CommitResult) => void;
    const templatePromise = new Promise<CommitResult>((resolve) => {
      resolveTemplate = resolve;
    });
    const daPromise = new Promise<CommitResult>((resolve) => {
      resolveDa = resolve;
    });
    commitHandlers['imp-template'] = () => templatePromise;
    commitHandlers['imp-da'] = () => daPromise;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer et importer' }));
    });

    // Before either deferred resolves, both commit calls must already have fired (D-08 parallelism).
    const callsBeforeResolve = fetchMockCalls().filter(([url]) => url.endsWith('/commit'));
    expect(callsBeforeResolve).toHaveLength(2);

    const templateCall = callsBeforeResolve.find(([url]) => url.includes('imp-template'));
    expect(templateCall).toBeDefined();
    const [, templateInit] = templateCall as [string, RequestInit];
    expect(templateInit.method).toBe('PUT');
    const templateHeaders = templateInit.headers as Record<string, string>;
    expect(templateHeaders.Authorization).toBe('Bearer jwt-token');
    expect(templateHeaders['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(templateInit.body))).toEqual({ parsed_data: TEMPLATE_PARSED });

    await act(async () => {
      resolveTemplate({ status: 200, body: { program_id: 'prog-imp-template' } });
      resolveDa({ status: 200, body: { program_id: 'prog-imp-da' } });
    });

    // Second render: leave da-coach.pdf as 'DA coach' (default) — only the template doc commits.
    commitHandlers = defaultCommitHandlers();
    const container2 = renderStep4(vi.fn(), vi.fn());
    await driveToReview(container2);

    const callsBeforeSecondConfirm = fetchMockCalls().length;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer et importer' }));
    });
    const newCalls = fetchMockCalls().slice(callsBeforeSecondConfirm);
    const newCommitCalls = newCalls.filter(([url]) => url.endsWith('/commit'));
    expect(newCommitCalls).toHaveLength(1);
    expect(newCommitCalls[0][0]).toContain('imp-template');
    expect(newCommitCalls.some(([url]) => url.includes('imp-da'))).toBe(false);
  });

  it('auto-redirect after commit', async () => {
    const onSuccess = vi.fn();
    const container = renderStep4(onSuccess, vi.fn());
    await driveToReview(container);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer et importer' }));
    });

    expect(screen.getByText('1 programme importé !')).toBeDefined();
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
    });
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('per-doc retry isolation', async () => {
    const onSuccess = vi.fn();
    const container = renderStep4(onSuccess, vi.fn());
    await driveToReview(container);

    // Correct da-coach.pdf (second row) to 'Template programme' so both docs are committable.
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Template programme' })[1]);
    });

    commitHandlers['imp-template'] = () => Promise.resolve({ status: 200, body: { program_id: 'prog-1' } });
    commitHandlers['imp-da'] = () => Promise.resolve({ status: 500, body: { error: 'boom' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer et importer' }));
    });

    expect(screen.getAllByText("L'import de ce document a échoué.")).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Réessayer' })).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSuccess).not.toHaveBeenCalled();

    const callsBeforeRetry = fetchMockCalls().filter(([url]) => url.endsWith('/commit'));
    const templateCountBeforeRetry = callsBeforeRetry.filter(([url]) => url.includes('imp-template')).length;
    const daCountBeforeRetry = callsBeforeRetry.filter(([url]) => url.includes('imp-da')).length;
    expect(templateCountBeforeRetry).toBe(1);
    expect(daCountBeforeRetry).toBe(1);

    commitHandlers['imp-da'] = () => Promise.resolve({ status: 200, body: { program_id: 'prog-2' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    });

    const callsAfterRetry = fetchMockCalls().filter(([url]) => url.endsWith('/commit'));
    const templateCountAfterRetry = callsAfterRetry.filter(([url]) => url.includes('imp-template')).length;
    const daCountAfterRetry = callsAfterRetry.filter(([url]) => url.includes('imp-da')).length;
    expect(templateCountAfterRetry).toBe(1);
    expect(daCountAfterRetry).toBe(2);

    expect(screen.queryByText("L'import de ce document a échoué.")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    expect(screen.getByText('2 programmes importés !')).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
