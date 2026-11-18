import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.addEventListener('vite:preloadError', (event) => {
  const lastRefresh = Number(sessionStorage.getItem('nexa_asset_refresh') || 0)
  if (Date.now() - lastRefresh < 30000) return
  event.preventDefault()
  sessionStorage.setItem('nexa_asset_refresh', String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
