import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { loadApiBaseUrl, ConfigError } from './config/env'

/**
 * App entry point.
 * Calls loadApiBaseUrl() before mounting React. If the config is missing,
 * renders a static error screen. On success, renders the full app with routing.
 */

const root = ReactDOM.createRoot(document.getElementById('root')!)

try {
  loadApiBaseUrl()

  // Config valid — dynamically import App to avoid loading router code on config failure
  import('./App').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  })
} catch (error) {
  if (error instanceof ConfigError) {
    root.render(
      <React.StrictMode>
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
          }}
        >
          <h1 style={{ color: '#b91c1c', marginBottom: '1rem' }}>
            Configuration Error
          </h1>
          <p style={{ color: '#374151', maxWidth: '28rem' }}>
            {error.message}
          </p>
        </div>
      </React.StrictMode>,
    )
  } else {
    throw error
  }
}
