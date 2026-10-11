/**
 * Pillow Thief design tokens — derived from the brand poster:
 * warm blush, cream, soft brown, premium and comforting. Never clinical,
 * never dating-app neon.
 */

export const colors = {
  blush: '#F48FB1',
  blushDark: '#E96B96',
  rose: '#E96B96',
  cream: '#FFF1E8',
  beige: '#E6D2C2',
  charcoal: '#211B1B',
  brown: '#49352D',
  white: '#FFFFFF',
  success: '#39845B',
  error: '#C74747',
  warning: '#B7791F',
  overlay: 'rgba(33, 27, 27, 0.45)',
} as const

export interface Theme {
  dark: boolean
  bg: string
  surface: string
  surfaceMuted: string
  text: string
  textMuted: string
  textOnPrimary: string
  primary: string
  primaryDark: string
  border: string
  success: string
  error: string
  warning: string
  premium: string
  white: string
  beige: string
}

export const lightTheme: Theme = {
  dark: false,
  bg: colors.cream,
  surface: colors.white,
  surfaceMuted: '#FAE8DC',
  text: colors.charcoal,
  textMuted: '#6E5F5A',
  textOnPrimary: colors.white,
  primary: colors.blush,
  primaryDark: colors.rose,
  border: colors.beige,
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  premium: colors.brown,
  white: colors.white,
  beige: colors.beige,
}

export const darkTheme: Theme = {
  dark: true,
  bg: '#171212',
  surface: '#241C1C',
  surfaceMuted: '#2E2323',
  text: '#F7EDE6',
  textMuted: '#C0ADA5',
  textOnPrimary: colors.white,
  primary: colors.blush,
  primaryDark: colors.rose,
  border: '#3B2D2A',
  success: '#4CAF77',
  error: '#E06666',
  warning: '#D69E2E',
  premium: colors.brown,
  white: colors.white,
  beige: colors.beige,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const

export const typography = {
  fontFamily: {
    regular: 'NunitoSans_400Regular',
    semibold: 'NunitoSans_600SemiBold',
    bold: 'NunitoSans_700Bold',
    extraBold: 'NunitoSans_800ExtraBold',
    handwritten: 'Caveat_600SemiBold',
  },
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
} as const

export const shadows = {
  card: {
    shadowColor: colors.charcoal,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sheet: {
    shadowColor: colors.charcoal,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
} as const
