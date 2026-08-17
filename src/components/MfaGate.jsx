/**
 * MfaGate.jsx - Requires the session to pass 2FA (reach AAL2) before the app
 * (and the vault) load. Sits outside VaultUnlockGate so the order is
 * password -> 2FA -> vault PIN. Users without 2FA fall straight through.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContextCore'
import { needsMfaChallenge } from '../lib/mfa'
import MfaChallenge from './MfaChallenge'
import { Spinner } from './ui/UI'

export default function MfaGate({ children }) {
  const { user } = useAuth()
  const [status, setStatus] = useState('checking') // checking | required | ok

  useEffect(() => {
    let active = true
    needsMfaChallenge()
      .then(required => { if (active) setStatus(required ? 'required' : 'ok') })
      // AAL is read from the local session token; if that ever fails, don't hard
      // block - the AAL2 RLS policies are the real enforcement.
      .catch(() => { if (active) setStatus('ok') })
    return () => { active = false }
  }, [user])

  // Not signed in: nothing to gate (ProtectedRoute handles the redirect).
  if (!user) return children

  if (status === 'checking') {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-bg-base">
        <Spinner size={24} />
      </div>
    )
  }
  if (status === 'required') {
    return <MfaChallenge onVerified={() => setStatus('ok')} />
  }
  return children
}
