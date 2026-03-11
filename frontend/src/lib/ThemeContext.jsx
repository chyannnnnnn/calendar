import { createContext, useContext, useEffect, useState } from 'react'

// ─── All colour tokens for both modes ────────────────────────────────────────
export const THEMES = {
  light: {
    mode:       'light',
    bg:         '#FDF6EE',
    surface:    '#FFF8F0',
    surfaceHi:  '#FFF0E0',
    border:     '#E8D5BC',
    borderHi:   '#D4A87A',
    text:       '#3D2B1F',
    textMid:    '#8B6650',
    textDim:    '#B89880',
    mint:       '#4BAF84',
    rose:       '#D4607A',
    lavender:   '#8B72BE',
    gold:       '#D4920A',
    peach:      '#E87840',
    shadow:     '#C4A07833',
    scrollbar:  '#E8D5BC',
  },
  dark: {
    mode:       'dark',
    bg:         '#1C1410',
    surface:    '#251E18',
    surfaceHi:  '#2E2419',
    border:     '#3D2E22',
    borderHi:   '#5C4433',
    text:       '#F5ECD7',
    textMid:    '#A07858',
    textDim:    '#5A4535',
    mint:       '#5EC897',
    rose:       '#E07888',
    lavender:   '#A990D8',
    gold:       '#DDA830',
    peach:      '#E89060',
    shadow:     '#00000055',
    scrollbar:  '#3D2E2288',
  },
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('uscal-theme') || 'light' } catch { return 'light' }
  })

  const C = THEMES[mode] ?? THEMES.light

  function toggle() {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    try { localStorage.setItem('uscal-theme', next) } catch {}
  }

  // Keep <html> background in sync so overscroll area matches
  useEffect(() => {
    document.documentElement.style.background = C.bg
    document.body.style.background = C.bg
  }, [C.bg])

  return (
    <ThemeContext.Provider value={{ C, mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}