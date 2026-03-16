import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ActionDropdownItem = {
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export function ActionDropdown({
  primaryLabel,
  onPrimaryClick,
  items,
}: {
  primaryLabel: string
  onPrimaryClick: () => void
  items: ActionDropdownItem[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })

  const updatePosition = useCallback(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom,
        right: window.innerWidth - rect.right,
      })
    }
  }, [open])

  useEffect(() => {
    updatePosition()
    if (!open) return

    const handler = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }

    const scrollHandler = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', scrollHandler, true)
    window.addEventListener('resize', scrollHandler)

    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', scrollHandler, true)
      window.removeEventListener('resize', scrollHandler)
    }
  }, [open, updatePosition])

  return (
    <div className="action-dropdown compound-control" ref={ref}>
      <button type="button" className="ghost-button" onClick={onPrimaryClick}>
        {primaryLabel}
      </button>
      <button
        type="button"
        className="action-dropdown-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
      >
        <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            className="action-dropdown-menu"
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
            ref={menuRef}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className={item.danger ? 'action-dropdown-danger' : undefined}
                disabled={item.disabled}
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
