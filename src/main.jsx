import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { UdlProvider } from './context/UdlContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { UserModalProvider } from './context/UserModalContext.jsx'
import { ToastProvider } from './components/ToastNotification.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <UdlProvider>
        <AuthProvider>
          <UserModalProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </UserModalProvider>
        </AuthProvider>
      </UdlProvider>
    </BrowserRouter>
  </StrictMode>,
)
