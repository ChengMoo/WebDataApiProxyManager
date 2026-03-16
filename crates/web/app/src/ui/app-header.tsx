import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useSession } from '../app'
import { useLocale } from '../i18n'

export function AppHeader({
  navOpen,
  onToggleNav,
}: {
  navOpen: boolean
  onToggleNav: () => void
}) {
  const { logout } = useSession()
  const { locale, setLocale, t } = useLocale()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  return (
    <header className="app-header">
      <button
        type="button"
        className="nav-toggle"
        onClick={onToggleNav}
        aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
      >
        <span />
        <span />
      </button>
      <div className="header-copy">
        <span className="eyebrow">{t('header.control_plane')}</span>
      </div>
      <button
        type="button"
        className="locale-toggle"
        onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
        aria-label="Switch language"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
        {locale === 'zh' ? 'ZH' : 'EN'}
      </button>
      <div className="avatar-wrapper" ref={dropdownRef}>
        <button
          type="button"
          className="avatar-button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="User menu"
        >
          A
        </button>
        {dropdownOpen && (
          <div className="avatar-dropdown">
            <Link to="/settings" onClick={() => setDropdownOpen(false)}>
              {t('header.settings')}
            </Link>
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false)
                logout()
              }}
            >
              {t('header.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
