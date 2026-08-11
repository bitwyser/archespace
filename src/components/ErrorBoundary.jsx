/**
 * ErrorBoundary.jsx - Catch-all error boundary for ArcheSpace.
 *
 * Wraps the entire app so that a runtime crash in any child
 * component shows a friendly recovery screen instead of a blank
 * white page. The user can reload or navigate home.
 */

import { Component } from 'react'
import ErrorScreen from './ErrorScreen'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  /** React lifecycle - capture the thrown error */
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  /** Log to console so developers can debug */
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          title="Something went wrong"
          message="An unexpected error occurred. Try reloading the page or going back to the dashboard."
          errorMessage={this.state.error?.message}
        />
      )
    }

    return this.props.children
  }
}
