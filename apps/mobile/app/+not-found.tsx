import { Link } from 'expo-router'
import { Text, View } from 'react-native'
import { useTheme, spacing, typography } from '../src/theme'

export default function NotFound() {
  const t = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, padding: spacing.xl, gap: spacing.md }}>
      <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>
        Page not found
      </Text>
      <Link href="/">
        <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.semibold }}>Go home</Text>
      </Link>
    </View>
  )
}
