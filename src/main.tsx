import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './theme.css'

// 有新版本 Service Worker 接管时，自动刷新一次，避免看到旧界面
if ('serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
