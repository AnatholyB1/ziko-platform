import { Stack } from 'expo-router';

export default function PluginsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="nutrition/dashboard" />
      <Stack.Screen name="nutrition/log" />
      <Stack.Screen name="persona/customize" />
      <Stack.Screen name="habits/dashboard" />
      <Stack.Screen name="habits/log" />
    </Stack>
  );
}
