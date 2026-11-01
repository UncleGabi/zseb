import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { setUpdateReady } from './update'
import './styles.css'

// Never reload on our own (it could drop a half-typed expense): offer the update and let the user choose.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => setUpdateReady(() => updateSW(true)),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
