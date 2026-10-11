import { createContext, useContext } from 'react'
import { lightTheme, darkTheme, spacing, radius, typography, shadows, colors, type Theme } from './tokens'

export { lightTheme, darkTheme, spacing, radius, typography, shadows, colors }
export type { Theme }

export const ThemeContext = createContext<{ theme: Theme; scheme: 'light' | 'dark' }>({
  theme: lightTheme,
  scheme: 'light',
})

export function useTheme(): Theme {
  return useContext(ThemeContext).theme
}
