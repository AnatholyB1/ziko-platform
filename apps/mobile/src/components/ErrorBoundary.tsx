import React from 'react';
import * as Sentry from '@sentry/react-native';
import { ErrorScreen } from './ErrorScreen';

interface Props {
  children: React.ReactNode;
  /** Plugin id (e.g. 'habits'). Sent to Sentry as the `plugin` tag. */
  pluginId?: string | null;
  /** Display name shown on the error screen. */
  moduleName?: string;
  /** When provided, the error screen's secondary button calls it (typically: go back home). */
  onBack?: () => void;
  /** When this value changes the boundary resets (e.g. the route changed after "back"). */
  resetKey?: string | number | null;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Render-error guard. Used at the root (generic) and around every plugin route
 * (`app/(app)/(plugins)/_layout.tsx`) so a crashing module shows an error screen
 * with a way back instead of a blank, blocking screen.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      Sentry.withScope((scope) => {
        if (this.props.pluginId) scope.setTag('plugin', this.props.pluginId);
        scope.setContext('extra', { componentStack: info.componentStack ?? undefined });
        Sentry.captureException(error);
      });
    } catch {
      // Reporting must never throw from inside an error boundary.
    }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleBack = () => {
    // Reset first so the (still mounted) layout renders its children again, then navigate.
    this.setState({ hasError: false, error: null });
    this.props.onBack?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <ErrorScreen
        kind={this.props.pluginId || this.props.onBack ? 'module' : 'error'}
        moduleName={this.props.moduleName}
        onAction={this.handleRetry}
        onSecondary={this.props.onBack ? this.handleBack : this.handleRetry}
      />
    );
  }
}
