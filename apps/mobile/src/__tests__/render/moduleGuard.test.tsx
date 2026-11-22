import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { vi } from 'vitest';
import { routerCalls } from './stubs/expo-router';
import { captured } from './stubs/sentry';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// The plugin layout reads the auth store (supabase client) — replace it with fixed values.
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: any) => unknown) => sel({ effectiveLevel: 5, levelLoaded: true }),
}));

// `Stack` renders a module that throws at render time: the "factice" crashing plugin (D-05).
vi.mock('expo-router', async () => {
  const stub = await import('./stubs/expo-router');
  const Boom = () => {
    throw new Error('plugin render crash');
  };
  return { ...stub, Stack: Object.assign(() => <Boom />, { Screen: () => null }) };
});

import ErrorBoundary from '../../components/ErrorBoundary';
import PluginsLayout from '../../../app/(app)/(plugins)/_layout';

let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  routerCalls.length = 0;
  captured.length = 0;
  // React logs caught render errors; keep test output clean.
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errSpy.mockRestore());

async function mount(node: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, root };
}

const click = async (el: Element | null) => {
  expect(el).not.toBeNull();
  await act(async () => (el as HTMLElement).click());
};

describe('plugin module guard (HABT-02)', () => {
  it('a plugin route that throws at render shows the error screen, not a blank view', async () => {
    const { container } = await mount(<PluginsLayout />);
    expect(container.textContent).toContain('Ce module a rencontré un problème');
    expect(container.textContent).toContain("Retour à l'accueil");
    expect(container.textContent).not.toContain('plugin render crash');
  });

  it("the back button returns to the home screen", async () => {
    const { container } = await mount(<PluginsLayout />);
    await click(container.querySelector('[data-testid="error-screen-secondary"]'));
    expect(routerCalls).toContainEqual({ method: 'replace', args: ['/(app)/'] });
  });

  it('reports the crash once, to the stubbed Sentry (no real traffic)', async () => {
    await mount(<PluginsLayout />);
    expect(captured).toHaveLength(1);
    expect((captured[0].error as Error).message).toBe('plugin render crash');
  });

  it('a healthy child is rendered untouched', async () => {
    const { container } = await mount(
      <ErrorBoundary pluginId="habits" onBack={() => undefined}>
        <span>module ok</span>
      </ErrorBoundary>,
    );
    expect(container.textContent).toBe('module ok');
  });

  it('retry re-renders children once the cause is gone', async () => {
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) throw new Error('flaky');
      return <span>recovered</span>;
    };
    const { container } = await mount(
      <ErrorBoundary pluginId="habits" onBack={() => undefined}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('Ce module a rencontré un problème');
    shouldThrow = false;
    await click(container.querySelector('[data-testid="error-screen-primary"]'));
    expect(container.textContent).toBe('recovered');
  });

  it('resets when the route key changes (navigating away from a crashed module)', async () => {
    const Boom = () => {
      throw new Error('x');
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ErrorBoundary pluginId="habits" resetKey="a">
          <Boom />
        </ErrorBoundary>,
      ),
    );
    expect(container.textContent).toContain('problème');
    await act(async () =>
      root.render(
        <ErrorBoundary pluginId="habits" resetKey="b">
          <span>other route</span>
        </ErrorBoundary>,
      ),
    );
    expect(container.textContent).toBe('other route');
  });
});
