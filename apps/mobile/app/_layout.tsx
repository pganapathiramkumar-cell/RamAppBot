import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="steer" />
      <Stack.Screen name="skill" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="index" options={{ href: null }} />
    </Stack>
  );
}
