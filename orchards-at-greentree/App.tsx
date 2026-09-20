import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import { colors, space, typography } from './src/theme';

/**
 * If schedule.json is malformed the loader throws at import time. Rather than
 * a white screen, show what went wrong — this is the failure mode that matters
 * when next year's data is dropped in.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>The schedule could not be loaded</Text>
          <Text style={styles.errorBody}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <HomeScreen />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(8),
  },
  errorTitle: { ...typography.title, color: colors.ink, marginBottom: space(3), textAlign: 'center' },
  errorBody: { ...typography.small, color: colors.inkSoft, textAlign: 'center', lineHeight: 20 },
});
