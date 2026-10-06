/**
 * useColumnCount.js - Columns for a masonry of cards: 1 on phones, 2 on
 * tablets, 3 on desktop.
 */
import { useEffect, useState } from 'react'

export function useColumnCount() {
  const query = () => {
    if (typeof window === 'undefined') return 2
    if (window.matchMedia('(max-width: 639px)').matches) return 1
    return window.matchMedia('(min-width: 1024px)').matches ? 3 : 2
  }
  const [cols, setCols] = useState(query)
  useEffect(() => {
    const small = window.matchMedia('(max-width: 639px)')
    const large = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setCols(query())
    small.addEventListener('change', onChange)
    large.addEventListener('change', onChange)
    return () => {
      small.removeEventListener('change', onChange)
      large.removeEventListener('change', onChange)
    }
  }, [])
  return cols
}
