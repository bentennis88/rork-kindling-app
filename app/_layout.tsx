import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OnboardingProvider, useOnboarding } from "@/contexts/OnboardingContext";
import { View, ActivityIndicator, StyleSheet, StatusBar, Appearance } from "react-native";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spark/[id]" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { hasCompletedOnboarding, loading: onboardingLoading } = useOnboarding();
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (onboardingLoading || authLoading || hasCompletedOnboarding === null) return;

    const inOnboarding = segments[0] && segments[0].includes('onboarding');

    if (!hasCompletedOnboarding && !inOnboarding) {
      router.push('/(tabs)' as any);
      setTimeout(() => router.push('/onboarding' as any), 100);
    } else if (hasCompletedOnboarding && inOnboarding) {
      router.replace('/(tabs)' as any);
    }
  }, [hasCompletedOnboarding, onboardingLoading, authLoading, segments, router]);

  if (onboardingLoading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    Appearance.setColorScheme('dark');
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnboardingProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <OnboardingWrapper>
              <RootLayoutNav />
            </OnboardingWrapper>
          </GestureHandlerRootView>
        </OnboardingProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});
