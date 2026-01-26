import useDarkMode from 'use-dark-mode'
import { ThemeProvider } from 'styled-components'
import { BrowserRouter as Router } from 'react-router-dom'
import { Provider as StoreProvider } from 'react-redux'
import { TamboProvider } from '@tambo-ai/react'
import { TooltipProvider } from '@radix-ui/react-tooltip'

import { store } from './app-state'
import { AppRoutes } from './Routes'
import { lightTheme, darkTheme } from './styles/theme'
import { GlobalStyle } from './styles/GlobalStyle'
import { MessageThreadCollapsible } from './components/tambo/message-thread-collapsible'
import './app/globals.css'
import { components, tools } from './lib/tambo'

export default function App() {
  const { value } = useDarkMode(false, { global: globalThis.window })
  const theme = value ? darkTheme : lightTheme

  return (
    <TamboProvider
      apiKey={import.meta.env.VITE_TAMBO_API_KEY}
      components={components}
      tools={tools}
    >
      <Router>
        <StoreProvider store={store}>
          <ThemeProvider theme={theme}>
            <GlobalStyle />
            <AppRoutes />
            <TooltipProvider>
              <MessageThreadCollapsible defaultOpen />
            </TooltipProvider>
          </ThemeProvider>
        </StoreProvider>
      </Router>
    </TamboProvider>
  )
}
