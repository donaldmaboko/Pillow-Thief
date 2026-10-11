import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts, NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold, NunitoSans_800ExtraBold } from '@expo-google-fonts/nunito-sans'
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat'
import * as SplashScreen from 'expo-splash-screen'
import { ThemeContext, darkTheme, lightTheme } from '../src/theme'
import { requireSupabase, supabase } from '../src/lib/supabase'
import { useSession } from '../src/stores/session'
import { config, isSupabaseConfigured } from '../src/lib/config'
import { Text, View } from 'react-native'
import { spacing, typography } from '../src/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
})

export default function RootLayout() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = scheme === 'dark' ? darkTheme : lightTheme
  const [fontsLoaded] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
    Caveat_600SemiBold,
  })
  const hydrated = useSession((s) => s.hydrated)

  // Auth bootstrap: hydrate session + subscribe to changes.
  useEffect(() => {
    if (!fontsLoaded) return
    if (!isSupabaseConfigured()) {
      useSession.getState().setHydrated()
      return
    }
    const sb = requireSupabase()
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        await loadProfile(data.session.user.id)
      }
      useSession.getState().setHydrated()
    })
    const { data: sub } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        useSession.getState().setSession(null, null)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [fontsLoaded])

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded, hydrated])

  if (!fontsLoaded || !hydrated) return null

  return (
    <ThemeContext.Provider value={{ theme, scheme }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {config.sandboxMode ? (
          <View style={{ backgroundColor: '#B7791F', paddingVertical: 2, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: typography.size.xs }}>SANDBOX — payments are simulated</Text>
          </View>
        ) : null}
        {!isSupabaseConfigured() ? (
          <MissingEnv />
        ) : (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="provider/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="booking/new/[providerId]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="booking/[id]" />
            <Stack.Screen name="checkout/[bookingId]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="chat/[conversationId]" />
          </Stack>
        )}
      </QueryClientProvider>
    </ThemeContext.Provider>
  )
}

async function loadProfile(userId: string) {
  try {
    const sb = requireSupabase()
    const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
    // deno-lint-ignore no-explicit-any
    useSession.getState().setSession(userId, data as any)
  } catch {
    useSession.getState().setSession(userId, null)
  }
}

function MissingEnv() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <Text style={{ fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, textAlign: 'center' }}>
        Pillow Thief needs its backend configured
      </Text>
      <Text style={{ color: '#6E5F5A', textAlign: 'center', fontSize: typography.size.md, lineHeight: 22 }}>
        Copy apps/mobile/.env.example to apps/mobile/.env, set your Supabase URL and anon key, then restart the dev
        server. See docs/SETUP.md.
      </Text>
    </View>
  )
}
