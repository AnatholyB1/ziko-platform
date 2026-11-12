// No real Sentry traffic in tests: every capture is recorded here.
export const captured: { error: unknown; context?: unknown }[] = [];
export const init = () => undefined;
export const setUser = () => undefined;
export const setContext = () => undefined;
export const setTag = () => undefined;
export const captureException = (error: unknown, context?: unknown) => {
  captured.push({ error, context });
};
export const withScope = (cb: (scope: any) => void) =>
  cb({ setTag: () => undefined, setContext: () => undefined, setExtra: () => undefined });
export const wrap = (c: unknown) => c;
