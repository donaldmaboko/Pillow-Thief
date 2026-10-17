import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { radius, shadows, spacing, typography, useTheme } from '../theme'

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'premium'
  loading?: boolean
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const bg =
    variant === 'primary'
      ? t.primary
      : variant === 'danger'
        ? t.error
        : variant === 'premium'
          ? t.premium
          : 'transparent'
  const fg = variant === 'secondary' || variant === 'ghost' ? t.primaryDark : t.textOnPrimary
  const borderColor = variant === 'secondary' ? t.primary : 'transparent'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: disabled ? t.border : bg,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md + 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>{title}</Text>
        </>
      )}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Screen container
// ---------------------------------------------------------------------------
export function Screen({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useTheme()
  return (
    <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      <View style={{ flex: 1, paddingHorizontal: padded ? spacing.lg : 0 }}>{children}</View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme()
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.card,
  }
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
        {children}
      </Pressable>
    )
  }
  return <View style={[base, style]}>{children}</View>
}

// ---------------------------------------------------------------------------
// Status pill (booking / verification / payment statuses)
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  confirmed: '#39845B',
  completed: '#39845B',
  verified: '#39845B',
  in_progress: '#B7791F',
  pending_approval: '#B7791F',
  pending_payment: '#B7791F',
  pending: '#B7791F',
  draft: '#6E5F5A',
  declined: '#C74747',
  cancelled: '#C74747',
  expired: '#6E5F5A',
  disputed: '#C74747',
  suspended: '#C74747',
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const t = useTheme()
  const color = STATUS_COLORS[status] ?? t.textMuted
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: `${color}1A`,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs }}>
        {label ?? status.replace(/_/g, ' ')}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Verified badge
// ---------------------------------------------------------------------------
export function VerifiedBadge({ small = false }: { small?: boolean }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${t.success}1A`, borderRadius: radius.pill, paddingHorizontal: small ? 6 : spacing.sm, paddingVertical: 2 }}>
      <Ionicons name="shield-checkmark" size={small ? 11 : 13} color={t.success} />
      <Text style={{ color: t.success, fontSize: small ? typography.size.xs - 1 : typography.size.xs, fontFamily: typography.fontFamily.semibold }}>
        Verified
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Rating stars
// ---------------------------------------------------------------------------
export function RatingStars({ rating, count, size = 14 }: { rating: number | null; count?: number; size?: number }) {
  const t = useTheme()
  if (rating == null) {
    return <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>No reviews yet</Text>
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#E9A23B" />
      ))}
      <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, marginLeft: 2 }}>{rating.toFixed(1)}</Text>
      {count != null && <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>({count})</Text>}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Form field
// ---------------------------------------------------------------------------
export function Field({
  label,
  error,
  hint,
  secure,
  style,
  ...input
}: Omit<TextInputProps, 'style'> & { label: string; error?: string; hint?: string; secure?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  return (
    <View style={{ marginBottom: spacing.lg, ...style }}>
      <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, marginBottom: spacing.xs }}>
        {label}
      </Text>
      <TextInput
        secureTextEntry={secure}
        placeholderTextColor={t.textMuted}
        style={{
          backgroundColor: t.surface,
          borderColor: error ? t.error : t.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          color: t.text,
          fontSize: typography.size.md,
        }}
        {...input}
      />
      {hint && !error ? <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: 4 }}>{hint}</Text> : null}
      {error ? <Text style={{ color: t.error, fontSize: typography.size.xs, marginTop: 4 }}>{error}</Text> : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Chip (filters)
// ---------------------------------------------------------------------------
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: selected ? t.primary : t.surface,
        borderWidth: 1,
        borderColor: selected ? t.primary : t.border,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ color: selected ? t.textOnPrimary : t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm }}>
        {label}
      </Text>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.md }}>
      <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xl }}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
export function Avatar({ uri, name, size = 48 }: { uri?: string | null; name: string; size?: number }) {
  const t = useTheme()
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.beige,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <AvatarImage uri={uri} size={size} />
      ) : (
        <Text style={{ color: t.premium, fontFamily: typography.fontFamily.bold, fontSize: size * 0.38 }}>{initials}</Text>
      )}
    </View>
  )
}

function AvatarImage({ uri, size }: { uri: string; size: number }) {
  // Lazy require to avoid pulling expo-image into tests/SSR contexts.
  const { Image } = require('expo-image')
  return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
export function Skeleton({ width, height = 16, radius: r = 8, style }: { width: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  return <View style={{ width, height, borderRadius: r, backgroundColor: t.surfaceMuted, ...style }} />
}

export function CardSkeleton() {
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Skeleton width={64} height={64} radius={32} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton width="60%" />
          <Skeleton width="90%" />
          <Skeleton width="40%" />
        </View>
      </View>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------
export function EmptyState({ icon = 'moon-outline', title, body, action, onAction }: { icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: string; onAction?: () => void }) {
  const t = useTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={t.primaryDark} />
      </View>
      <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, textAlign: 'center' }}>{title}</Text>
      {body ? <Text style={{ color: t.textMuted, fontSize: typography.size.sm, textAlign: 'center', maxWidth: 300 }}>{body}</Text> : null}
      {action ? <Button title={action} onPress={onAction ?? (() => {})} style={{ marginTop: spacing.md }} /> : null}
    </View>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md }}>
      <Ionicons name="cloud-offline-outline" size={32} color={t.error} />
      <Text style={{ color: t.text, textAlign: 'center', fontSize: typography.size.md }}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Safety alert banner
// ---------------------------------------------------------------------------
export function SafetyAlert({ title, body, tone = 'info' }: { title: string; body?: string; tone?: 'info' | 'warning' | 'danger' }) {
  const t = useTheme()
  const color = tone === 'danger' ? t.error : tone === 'warning' ? t.warning : t.primaryDark
  return (
    <View
      style={{
        backgroundColor: `${color}14`,
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: 4,
      }}
    >
      <Text style={{ color, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>{title}</Text>
      {body ? <Text style={{ color: t.text, fontSize: typography.size.sm, lineHeight: 20 }}>{body}</Text> : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Price breakdown rows
// ---------------------------------------------------------------------------
export function PriceRow({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
      <Text style={{ color: muted ? t.textMuted : t.text, fontFamily: bold ? typography.fontFamily.bold : typography.fontFamily.regular, fontSize: typography.size.md }}>
        {label}
      </Text>
      <Text style={{ color: muted ? t.textMuted : t.text, fontFamily: bold ? typography.fontFamily.bold : typography.fontFamily.semibold, fontSize: typography.size.md }}>
        {value}
      </Text>
    </View>
  )
}
