import { Stack } from 'expo-router';

export default function PluginsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="nutrition/dashboard" />
      <Stack.Screen name="nutrition/log" />
      <Stack.Screen name="persona/customize" />
      <Stack.Screen name="habits/dashboard" />
      <Stack.Screen name="habits/log" />
      <Stack.Screen name="stats/dashboard" />
      <Stack.Screen name="stats/exercise" />
      <Stack.Screen name="stats/session" />
      <Stack.Screen name="gamification/dashboard" />
      <Stack.Screen name="gamification/shop" />
      <Stack.Screen name="community/dashboard" />
      <Stack.Screen name="community/friends" />
      <Stack.Screen name="community/chat" />
      <Stack.Screen name="community/conversation" />
      <Stack.Screen name="community/challenges" />
      <Stack.Screen name="community/challenge-detail" />
      <Stack.Screen name="community/create-challenge" />
      <Stack.Screen name="community/compare" />
      <Stack.Screen name="community/invite" />
    </Stack>
  );
}
