import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { captureError } from '../lib/sentry';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, { componentStack: info.componentStack ?? undefined });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={{
        flex: 1, backgroundColor: '#F7F6F3',
        alignItems: 'center', justifyContent: 'center', padding: 32,
      }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#1C1A17', marginBottom: 8, textAlign: 'center' }}>
          Quelque chose s'est mal passé
        </Text>
        <Text style={{ fontSize: 14, color: '#6B6963', textAlign: 'center', marginBottom: 32 }}>
          L'erreur a été signalée automatiquement. Merci de réessayer.
        </Text>
        <TouchableOpacity
          onPress={this.handleRetry}
          style={{
            backgroundColor: '#FF5C1A', paddingHorizontal: 32,
            paddingVertical: 14, borderRadius: 14,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
