import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerAppShell, shouldRegister } from './lib/sw-register'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 生产环境注册 app shell 让页面离线可用；开发期不注册，避免旧缓存挡住改动
if (
  shouldRegister({
    prod: import.meta.env.PROD,
    hasServiceWorker: 'serviceWorker' in navigator,
  })
) {
  void registerAppShell({
    register: (url, options) => navigator.serviceWorker.register(url, options),
    baseUrl: document.baseURI,
  })
}
