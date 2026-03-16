import { useState } from 'react'
import { adminApi } from '../api'
import { useSession } from '../app'
import { useLocale } from '../i18n'

export function AuthPage() {
  const { authPhase, setToken } = useSession()

  if (authPhase === 'setup') {
    return <SetupForm onSuccess={setToken} />
  }

  return <LoginForm onSuccess={setToken} />
}

function SetupForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const { t } = useLocale()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(t('auth.password_placeholder'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.confirm_password'))
      return
    }
    setLoading(true)
    try {
      const result = await adminApi.authSetup(password)
      onSuccess(result.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.setup_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-kicker">WDAPM</span>
          <h2>{t('auth.setup_title')}</h2>
          <p>{t('auth.setup_desc')}</p>
        </div>
        <form className="stack-form" onSubmit={handleSubmit}>
          {error ? <div className="error-banner">{error}</div> : null}
          <div className="field">
            <span>{t('auth.password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password_placeholder')}
              autoFocus
            />
          </div>
          <div className="field">
            <span>{t('auth.confirm_password')}</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? t('auth.setting_up') : t('auth.setup_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}

function LoginForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const { t } = useLocale()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await adminApi.authLogin(password)
      onSuccess(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-kicker">WDAPM</span>
          <h2>{t('auth.login_title')}</h2>
          <p>{t('auth.login_desc')}</p>
        </div>
        <form className="stack-form" onSubmit={handleSubmit}>
          {error ? <div className="error-banner">{error}</div> : null}
          <div className="field">
            <span>{t('auth.password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.admin_password')}
              autoFocus
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? t('auth.signing_in') : t('auth.login_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}
