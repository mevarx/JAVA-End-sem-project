import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/inter'
import '@fontsource-variable/inter-tight'
import '@fontsource-variable/jetbrains-mono'
import App from './App'
import { ThemeProvider } from './theme/ThemeProvider'
import './styles/tokens.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ThemeProvider>
  </StrictMode>,
)
