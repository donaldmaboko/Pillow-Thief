import { Redirect } from 'expo-router'
import { useSession } from '../src/stores/session'

export default function Index() {
  const userId = useSession((s) => s.userId)
  const isProvider = useSession((s) => s.isProvider)
  if (!userId) return <Redirect href="/(auth)/welcome" />
  if (isProvider) return <Redirect href="/(provider)/dashboard" />
  return <Redirect href="/(app)/(tabs)/home" />
}
