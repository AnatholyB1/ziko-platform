import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ??
  'https://cfcb8114b7e33e8635c083d17bf7fcca@o4511076061347840.ingest.de.sentry.io/4511349056077904';

export function initSentry() {
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    enabled: true,
    attachScreenshot: true,
    attachViewHierarchy: true,
  });
}

export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

export function clearUserContext() {
  Sentry.setUser(null);
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (context) Sentry.setContext('extra', context);
  Sentry.captureException(error);
}
