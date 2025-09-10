import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function NotFoundScreen() {
  const router = useRouter();

  // Automatically redirect to home screen
  useEffect(() => {
    console.log('NotFoundScreen: Redirecting to home');
    const timer = setTimeout(() => {
      router.replace('/(tabs)/');
    }, 100); // Small delay to ensure proper navigation

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Redirigiendo...' }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.text}>Redirigiendo a inicio...</ThemedText>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    textAlign: 'center',
  },
});
