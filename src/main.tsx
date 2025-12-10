import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge（在浏览器环境下没有 ipcRenderer 时保持安全）
if (window.ipcRenderer?.on) {
  window.ipcRenderer.on('main-process-message', (_event: unknown, message: unknown) => {
    console.log(message);
  });
}
