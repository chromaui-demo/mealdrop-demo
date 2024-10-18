import useDarkMode from 'use-dark-mode'
import { ThemeProvider } from 'styled-components'
import { BrowserRouter as Router } from 'react-router-dom'
import { Provider as StoreProvider } from 'react-redux'
import { MotionGlobalConfig } from 'framer-motion'

import { store } from './app-state'
import { AppRoutes } from './Routes'
import { lightTheme, darkTheme } from './styles/theme'
import { GlobalStyle } from './styles/GlobalStyle'

// @ts-ignore
if (window.disableAnimations) {
  MotionGlobalConfig.skipAnimations = true
}

export default function App() {
  const { value } = useDarkMode(false, { global: globalThis.window })
  const theme = value ? darkTheme : lightTheme

  return (
    <Router>
      <StoreProvider store={store}>
        <ThemeProvider theme={theme}>
          <GlobalStyle />
          <AppRoutes />
        </ThemeProvider>
      </StoreProvider>
    </Router>
  )
}
