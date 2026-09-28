/**
 * main.jsx - Application entry point.
 *
 * Renders the App tree into the #root DOM element.
 */

// Must run first: captures and strips a failed email-link error from the URL
// before the router or the Supabase client read it.
import './lib/authRedirectError'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
