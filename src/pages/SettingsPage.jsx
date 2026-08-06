/**
 * SettingsPage.jsx - Account, appearance, security, and backup settings.
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Upload, Eye, EyeOff, ChevronDown, ChevronRight, Check, AlertTriangle, User, Palette, ShieldCheck, Archive, Trash2, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContextCore'
import { useEncryption } from '../context/EncryptionCore'
import { useTheme } from '../context/ThemeCore'
import { useToast } from '../context/ToastCore'
import { useSpaces } from '../hooks/useSpaces'
import { exportSpaces, importSpaces } from '../lib/exportImport'
import PinInput from '../components/PinInput'
import PasskeyManager from '../components/PasskeyManager'
import { validateVaultPin, getWeakPinWarning } from '../lib/crypto/vaultPin'
import WeakPinWarning from '../components/WeakPinWarning'
import { VAULT_PIN_MIN_LENGTH } from '../lib/constants'
import { PASSWORD_RULES, validatePassword } from '../lib/passwordPolicy'
import { logAudit } from '../lib/auditLog'
import { APP_VERSION, BUILD_HASH, COMMIT_URL } from '../lib/buildInfo'
import ReauthCode from '../components/ReauthCode'
import { Modal } from '../components/ui/UI'
import { queryKeys } from '../lib/queryKeys'

function SettingsSection({ id, title, description, icon: Icon, openSection, setOpenSection, children }) {
  const open = openSection === id

  return (
    <section className="border-b border-bg-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpenSection(current => (current === id ? '' : id))}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-bg-elevated/40 transition-colors"
      >
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon size={17} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <p className="text-text-muted text-xs mt-0.5">{description}</p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  )
}

function Divider() {
  return <div className="my-5 border-t border-bg-border" />
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, signIn, signOut, requestPasswordReset, reauthenticate, updateEmail, deleteAccount, updatePasswordAndSignOut } = useAuth()
  const { cryptoKey, unlock, updatePin, setupRecoveryCode, updatePinWithRecoveryCode, unlocking, lock } = useEncryption()
  const {
    themeMode,
    themeModes,
    setThemeMode,
    accentColor,
    accentColors,
    setAccentColor,
  } = useTheme()
  const { toast } = useToast()
  const { data: spaces = [] } = useSpaces()
  const queryClient = useQueryClient()
  const importRef = useRef(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [showEmailPassword, setShowEmailPassword] = useState(false)
  const [deleteStep, setDeleteStep] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePin, setDeletePin] = useState('')
  const [showDeletePassword, setShowDeletePassword] = useState(false)

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [recoverySetupPin, setRecoverySetupPin] = useState('')
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('')
  const [recoveryPin, setRecoveryPin] = useState('')
  const [confirmRecoveryPin, setConfirmRecoveryPin] = useState('')
  const [oneTimeRecoveryCode, setOneTimeRecoveryCode] = useState('')

  const [passwordLoading, setPasswordLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [recoverySetupLoading, setRecoverySetupLoading] = useState(false)
  const [pinRecoveryLoading, setPinRecoveryLoading] = useState(false)
  const [openSection, setOpenSection] = useState('')
  const [emailStep, setEmailStep] = useState('form')     // 'form' | 'code'
  const deleteConfirmationPhrase = `DELETE ${user?.email || ''}`

  const resetDeleteFlow = () => {
    setDeleteStep('')
    setDeleteConfirmText('')
    setDeletePassword('')
    setDeletePin('')
    setShowDeletePassword(false)
    setDeleteLoading(false)
  }

  const sendEmailCode = async () => {
    const { error } = await reauthenticate()
    if (error) {
      toast.error(`Could not send code: ${error.message}`)
      return false
    }
    setEmailStep('code')
    toast.info('We sent a 6-digit code to your current email.')
    return true
  }

  const handleChangeEmail = async (e) => {
    e.preventDefault()
    const nextEmail = newEmail.trim().toLowerCase()
    if (!nextEmail) {
      toast.error('Enter a new email address.')
      return
    }
    if (nextEmail === user?.email?.toLowerCase()) {
      toast.error('New email must be different from current email.')
      return
    }
    if (!emailPassword) {
      toast.error('Enter your login password to continue.')
      return
    }

    setEmailLoading(true)
    const { error: verifyError } = await signIn(user.email, emailPassword)
    if (verifyError) {
      toast.error('Login password is incorrect.')
      setEmailLoading(false)
      return
    }
    // Send a reauthentication code to the CURRENT (old) email.
    await sendEmailCode()
    setEmailLoading(false)
  }

  // Confirm with the code from the old email; a link then goes to the new email.
  const handleConfirmEmailChange = async (code) => {
    const nextEmail = newEmail.trim().toLowerCase()
    setEmailLoading(true)
    const { error } = await updateEmail(nextEmail, code)
    if (error) {
      setEmailLoading(false)
      toast.error(error.message)
      return
    }
    setNewEmail('')
    setEmailPassword('')
    setEmailStep('form')
    await signOut({ scope: 'local' })
    setEmailLoading(false)
    toast.success('Confirmation link sent to your new email. Confirm it, then sign in again.')
    navigate('/login?email_change=requested', { replace: true })
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    if (deleteConfirmText !== deleteConfirmationPhrase) {
      toast.error(`Type "${deleteConfirmationPhrase}" to confirm.`)
      return
    }
    if (!deletePassword || !deletePin) {
      toast.error('Enter your login password and vault PIN.')
      return
    }

    setDeleteLoading(true)
    const { error: verifyError } = await signIn(user.email, deletePassword)
    if (verifyError) {
      toast.error('Login password is incorrect.')
      setDeleteLoading(false)
      return
    }

    try {
      await unlock(deletePin)
    } catch (err) {
      toast.error(err?.message || 'Vault PIN is incorrect.')
      setDeleteLoading(false)
      return
    }

    const { error } = await deleteAccount()
    setDeleteLoading(false)
    if (error) {
      toast.error(error.message || 'Failed to delete account.')
      return
    }

    resetDeleteFlow()
    navigate('/login?account_deleted=1', { replace: true })
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      toast.error(passwordError.replace('Password', 'New password'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }
    if (!currentPassword) {
      toast.error('Enter your current password.')
      return
    }
    setPasswordLoading(true)
    const { error: verifyError } = await signIn(user.email, currentPassword)
    if (verifyError) {
      const msg = verifyError.message || ''
      toast.error(
        /invalid login credentials/i.test(msg)
          ? 'Current password is incorrect.'
          : `Could not verify password: ${msg}`
      )
      setPasswordLoading(false)
      return
    }
    const { error } = await updatePasswordAndSignOut(
      newPassword,
      () => logAudit({ action: 'password_change' })
    )
    setPasswordLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Login password updated. Sign in again with your new password.')
    navigate('/login?reset=success', { replace: true })
  }

  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      toast.error('No email address is available for this account.')
      return
    }
    setResetLoading(true)
    const { error } = await requestPasswordReset(user.email)
    setResetLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Password reset link sent. Check your email.')
  }

  const handleChangePin = async (e) => {
    e.preventDefault()
    const pinErr = validateVaultPin(newPin)
    if (pinErr) {
      toast.error(pinErr)
      return
    }
    if (newPin !== confirmPin) {
      toast.error('New PINs do not match.')
      return
    }
    setPinLoading(true)
    try {
      await updatePin(currentPin, newPin)
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      toast.success('Vault PIN updated.')
    } catch (err) {
      toast.error(err?.message || 'Failed to change vault PIN.')
    }
    setPinLoading(false)
  }

  const handleSetupRecoveryCode = async (e) => {
    e.preventDefault()
    setRecoverySetupLoading(true)
    try {
      const { recoveryCode } = await setupRecoveryCode(recoverySetupPin)
      setRecoverySetupPin('')
      setOneTimeRecoveryCode(recoveryCode)
      toast.success('Recovery code created. Save it now.')
    } catch (err) {
      toast.error(err?.message || 'Failed to create recovery code.')
    }
    setRecoverySetupLoading(false)
  }

  const handleChangePinWithRecoveryCode = async (e) => {
    e.preventDefault()
    const pinErr = validateVaultPin(recoveryPin)
    if (pinErr) {
      toast.error(pinErr)
      return
    }
    if (recoveryPin !== confirmRecoveryPin) {
      toast.error('New PINs do not match.')
      return
    }
    setPinRecoveryLoading(true)
    try {
      const { recoveryCode } = await updatePinWithRecoveryCode(recoveryCodeInput, recoveryPin)
      setRecoveryCodeInput('')
      setRecoveryPin('')
      setConfirmRecoveryPin('')
      setOneTimeRecoveryCode(recoveryCode)
      toast.success('Vault PIN updated. Save your new recovery code.')
    } catch (err) {
      toast.error(err?.message || 'Failed to reset vault PIN.')
    }
    setPinRecoveryLoading(false)
  }

  const handleExport = async () => {
    try {
      await exportSpaces(spaces, cryptoKey)
      toast.success('Backup exported successfully')
    } catch {
      toast.error('Failed to export backup')
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importSpaces(file, user.id, cryptoKey)
      await queryClient.invalidateQueries({ queryKey: queryKeys.spaces() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.bin() })
      toast.success('Backup imported successfully')
    } catch (err) {
      toast.error('Failed to import backup - invalid format')
      console.error(err)
    }
    e.target.value = ''
  }

  const handleLockVault = () => {
    lock()
    navigate('/app')
  }

  const handleThemeModeChange = (nextThemeMode) => {
    setThemeMode(nextThemeMode.id)
    toast.success(`${nextThemeMode.name} theme applied.`)
  }

  const handleAccentColorChange = (nextAccentColor) => {
    setAccentColor(nextAccentColor.id)
    toast.success(`${nextAccentColor.name} accent applied.`)
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-20 glass">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bg-border bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all text-sm font-medium"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <h1 className="text-sm font-semibold text-text-primary">Settings</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-bg-surface border border-bg-border rounded-2xl overflow-hidden">
          <SettingsSection
            id="account"
            title="Account"
            description="Email address and account identity."
            icon={User}
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <div className="flex items-center gap-3 rounded-xl border border-bg-border bg-bg-elevated px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <User size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-muted">Signed in as</p>
                <p className="text-sm font-medium text-text-primary truncate">{user?.email}</p>
              </div>
            </div>

            <Divider />

            <div>
              <h3 className="text-sm font-semibold text-text-primary">Change email</h3>
              <p className="text-text-muted text-xs mt-0.5">
                Current email: <span className="text-text-secondary">{user?.email}</span>
              </p>
              <p className="text-text-muted text-xs mt-1.5">
                We'll email a 6-digit code to your current address to confirm it's you. After you enter it, a confirmation link is sent to your new address, and the change takes effect once you open that link.
              </p>
            </div>
            {emailStep === 'form' ? (
            <form onSubmit={handleChangeEmail} className="mt-3 space-y-3">
              <div>
                <label htmlFor="new-email" className="block text-xs font-medium text-text-secondary mb-1.5">
                  New email
                </label>
                <input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="email-change-password" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Login password
                </label>
                <div className="relative">
                  <input
                    id="email-change-password"
                    type={showEmailPassword ? 'text' : 'password'}
                    value={emailPassword}
                    onChange={e => setEmailPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                    aria-label="Toggle email password visibility"
                  >
                    {showEmailPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={emailLoading}
                className="w-full bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {emailLoading ? 'Sending code…' : 'Change email'}
              </button>
            </form>
            ) : (
              <ReauthCode
                email={user?.email}
                busy={emailLoading}
                onConfirm={handleConfirmEmailChange}
                onCancel={() => { setEmailStep('form'); setEmailPassword('') }}
                onResend={sendEmailCode}
              />
            )}

            <Divider />

            <div className="rounded-xl border border-danger/30 bg-danger/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-danger">Delete Account Permanently</h3>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Permanently delete your account, spaces, items, encrypted vault, and settings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteStep('warning')}
                className="mt-4 w-full rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-muted"
              >
                Delete Account
              </button>
            </div>
          </SettingsSection>

          <SettingsSection
            id="appearance"
            title="Appearance"
            description="Theme mode and accent color synced to your account."
            icon={Palette}
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Theme</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {themeModes.map(option => {
                  const selected = themeMode === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleThemeModeChange(option)}
                      className={`min-h-[76px] rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? 'border-accent bg-accent-muted'
                          : 'border-bg-border bg-bg-elevated hover:bg-bg-base'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-text-primary">{option.name}</span>
                        {selected && <Check size={16} className="text-accent shrink-0" />}
                      </span>
                      <span className="mt-1 block text-xs text-text-muted">{option.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Divider />

            <div>
              <h3 className="text-sm font-semibold text-text-primary">Accent Color</h3>
              <div className="mt-3 grid gap-3">
                {accentColors.map(option => {
                  const selected = accentColor === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleAccentColorChange(option)}
                      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'border-accent bg-accent-muted'
                          : 'border-bg-border bg-bg-elevated hover:bg-bg-base'
                      }`}
                    >
                      <span
                        className="h-8 w-8 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: option.swatch }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-text-primary">{option.name}</span>
                        <span className="block text-xs text-text-muted mt-0.5">{option.description}</span>
                      </span>
                      {selected && <Check size={16} className="text-accent shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="backup"
            title="Backup"
            description="Export or import all spaces as JSON."
            icon={Download}
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
              >
                <Download size={16} />
                Export backup
              </button>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
              >
                <Upload size={16} />
                Import backup
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </SettingsSection>

          <SettingsSection
            id="storage"
            title="Storage"
            description="Archived items and the recycle bin."
            icon={Archive}
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate('/archive')}
                className="w-full flex items-center gap-3 rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base px-4 py-3 text-left transition-colors"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bg-border bg-bg-surface text-text-secondary">
                  <Archive size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text-primary">Archive</span>
                  <span className="block text-xs text-text-muted mt-0.5">Items hidden without deleting</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-muted" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/recycle-bin')}
                className="w-full flex items-center gap-3 rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base px-4 py-3 text-left transition-colors"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bg-border bg-bg-surface text-text-secondary">
                  <Trash2 size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text-primary">Recycle bin</span>
                  <span className="block text-xs text-text-muted mt-0.5">Restore or permanently delete</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-muted" />
              </button>
            </div>
          </SettingsSection>

          <SettingsSection
            id="security"
            title="Security"
            description="Login password, vault PIN, recovery code, and passkeys."
            icon={ShieldCheck}
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Change login password</h3>
              <p className="text-text-muted text-xs mt-0.5">Used to sign in. Separate from your vault PIN.</p>
            </div>
            <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
              <div>
                <label htmlFor="current-password" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Current password
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                    aria-label="Toggle password visibility"
                  >
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="new-password" className="block text-xs font-medium text-text-secondary mb-1.5">
                  New password
                </label>
                <input
                  id="new-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={PASSWORD_RULES.minLength}
                  autoComplete="new-password"
                  className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {passwordLoading ? 'Updating…' : 'Change login password'}
              </button>
              <button
                type="button"
                onClick={handleSendPasswordReset}
                disabled={resetLoading}
                className="w-full px-4 py-3 rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {resetLoading ? 'Sending reset link...' : 'Forgot current password? Send reset link'}
              </button>
            </form>

            <Divider />

            <div>
              <h3 className="text-sm font-semibold text-text-primary">Change vault PIN</h3>
              <p className="text-text-muted text-xs mt-0.5">
                Unlocks encrypted data. PIN or passphrase, at least {VAULT_PIN_MIN_LENGTH} characters.
              </p>
            </div>
            <form onSubmit={handleChangePin} className="mt-3 space-y-3">
              <PinInput
                id="settings-current-pin"
                label="Current vault PIN"
                value={currentPin}
                onChange={setCurrentPin}
                disabled={pinLoading || unlocking}
              />
              <PinInput
                id="settings-new-pin"
                label="New vault PIN"
                value={newPin}
                onChange={setNewPin}
                disabled={pinLoading || unlocking}
              />
              <PinInput
                id="settings-confirm-pin"
                label="Confirm new vault PIN"
                value={confirmPin}
                onChange={setConfirmPin}
                disabled={pinLoading || unlocking}
              />
              <WeakPinWarning message={!validateVaultPin(newPin) ? getWeakPinWarning(newPin) : null} />
              <button
                type="submit"
                disabled={pinLoading || unlocking}
                className="w-full bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {pinLoading || unlocking ? 'Updating...' : 'Change vault PIN'}
              </button>
            </form>

            <Divider />

            <PasskeyManager />

            <Divider />

            <div>
              <h3 className="text-sm font-semibold text-text-primary">Forgot vault PIN - reset with recovery code</h3>
              <p className="text-text-muted text-xs mt-0.5">Use your recovery code to set a new vault PIN.</p>
            </div>
            <form onSubmit={handleChangePinWithRecoveryCode} className="mt-3 space-y-3">
              <div>
                <label htmlFor="pin-recovery-code" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Recovery code
                </label>
                <input
                  id="pin-recovery-code"
                  type="text"
                  value={recoveryCodeInput}
                  onChange={e => setRecoveryCodeInput(e.target.value)}
                  required
                  autoComplete="off"
                  inputMode="text"
                  className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <PinInput
                id="settings-recovery-pin"
                label="New vault PIN"
                value={recoveryPin}
                onChange={setRecoveryPin}
                disabled={pinRecoveryLoading || unlocking}
              />
              <PinInput
                id="settings-recovery-confirm-pin"
                label="Confirm new vault PIN"
                value={confirmRecoveryPin}
                onChange={setConfirmRecoveryPin}
                disabled={pinRecoveryLoading || unlocking}
              />
              <WeakPinWarning message={!validateVaultPin(recoveryPin) ? getWeakPinWarning(recoveryPin) : null} />
              <button
                type="submit"
                disabled={pinRecoveryLoading || unlocking}
                className="w-full bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {pinRecoveryLoading || unlocking ? 'Updating...' : 'Reset PIN with recovery code'}
              </button>
            </form>

            <Divider />

            <div>
              <h3 className="text-sm font-semibold text-text-primary">Setup recovery code</h3>
              <p className="text-text-muted text-xs mt-0.5">Use your current vault PIN to create or replace your one-time recovery code.</p>
            </div>
            <form onSubmit={handleSetupRecoveryCode} className="mt-3 space-y-3">
              <PinInput
                id="settings-recovery-setup-pin"
                label="Current vault PIN"
                value={recoverySetupPin}
                onChange={setRecoverySetupPin}
                disabled={recoverySetupLoading || unlocking}
              />
              <button
                type="submit"
                disabled={recoverySetupLoading || unlocking || recoverySetupPin.length < VAULT_PIN_MIN_LENGTH}
                className="w-full bg-accent hover:bg-accent-hover text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {recoverySetupLoading || unlocking ? 'Creating...' : 'Create recovery code'}
              </button>
            </form>

            {oneTimeRecoveryCode && (
              <div className="mt-4 bg-success/10 border border-success/30 rounded-xl p-3 space-y-2">
                <p className="text-success text-xs font-semibold">New one-time recovery code</p>
                <p className="font-mono text-lg tracking-[0.2em] text-text-primary break-all">{oneTimeRecoveryCode}</p>
                <p className="text-text-muted text-xs">Save this code now. It replaces the previous recovery code.</p>
              </div>
            )}

            <Divider />

            <div>
              <h3 className="text-sm font-semibold text-text-primary">Lock vault</h3>
              <p className="text-text-muted text-xs mt-0.5">Require your PIN or passkey again to view your encrypted data.</p>
            </div>
            <button
              type="button"
              onClick={handleLockVault}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-bg-border bg-bg-elevated hover:bg-bg-base text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors py-3"
            >
              <Lock size={16} />
              Lock vault now
            </button>
          </SettingsSection>

        </div>

        <section className="mt-6">
          <button
            type="button"
            onClick={() => {
              signOut()
              toast.info('Signed out')
            }}
            className="w-full px-4 py-3 rounded-xl border border-bg-border bg-bg-surface hover:bg-danger/10 hover:border-danger/30 text-sm font-semibold text-text-secondary hover:text-danger transition-colors"
          >
            Sign out
          </button>
        </section>

        <p className="mt-6 text-center text-xs text-text-muted">
          Arche Space <span className="text-text-secondary">v{APP_VERSION}</span> · build{' '}
          <a
            href={COMMIT_URL}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline hover:text-text-secondary transition-colors"
            title="View this build's source commit"
          >
            {BUILD_HASH}
          </a>
        </p>
      </main>

      {deleteStep === 'warning' && (
        <Modal
          title="Delete account permanently"
          onClose={resetDeleteFlow}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetDeleteFlow}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setDeleteStep('confirm')}
                className="px-4 py-2.5 text-sm font-semibold bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors"
              >
                I understand
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
              <AlertTriangle size={20} />
            </div>
            <div className="space-y-2">
              <p>All spaces and items will be permanently deleted.</p>
              <p>Your encrypted vault cannot be recovered afterward, even with your recovery code.</p>
              <p className="font-semibold text-danger">This action is permanent. It cannot be undone.</p>
            </div>
          </div>
        </Modal>
      )}

      {deleteStep === 'confirm' && (
        <Modal
          title="Confirm account deletion"
          onClose={resetDeleteFlow}
          onSubmit={handleDeleteAccount}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetDeleteFlow}
                disabled={deleteLoading}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary rounded-xl border border-bg-border hover:bg-bg-elevated transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deleteLoading || unlocking}
                className="px-4 py-2.5 text-sm font-semibold bg-danger hover:bg-danger-hover text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {deleteLoading || unlocking ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          }
        >
          <p className="text-xs text-text-muted mb-3">
            Type <span className="font-mono text-danger">{deleteConfirmationPhrase}</span> and re-enter your credentials.
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="delete-confirm-text" className="block text-xs font-medium text-text-secondary mb-1.5">
                Confirmation text
              </label>
              <input
                id="delete-confirm-text"
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                required
                autoComplete="off"
                className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="delete-password" className="block text-xs font-medium text-text-secondary mb-1.5">
                Login password
              </label>
              <div className="relative">
                <input
                  id="delete-password"
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="password-field w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                  aria-label="Toggle delete password visibility"
                >
                  {showDeletePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <PinInput
              id="delete-vault-pin"
              label="Vault PIN"
              value={deletePin}
              onChange={setDeletePin}
              disabled={deleteLoading || unlocking}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
