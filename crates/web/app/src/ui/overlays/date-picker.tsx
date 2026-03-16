import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'

function formatDateValue(date: Date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isSameDay(left: Date | null, right: Date | null) {
  if (!left || !right) return false
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function buildCalendarDays(month: Date) {
  const firstDay = startOfMonth(month)
  const offset = (firstDay.getDay() + 6) % 7
  const firstVisibleDay = new Date(firstDay)
  firstVisibleDay.setDate(firstVisibleDay.getDate() - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDay)
    date.setDate(firstVisibleDay.getDate() + index)
    return {
      date,
      inCurrentMonth: date.getMonth() === month.getMonth(),
    }
  })
}

function getVisibleMonth(value: string) {
  return startOfMonth(parseDateValue(value) ?? new Date())
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  ariaLabel?: string
}) {
  const { locale, t } = useLocale()
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US'
  const selectedDate = useMemo(() => parseDateValue(value), [value])
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => getVisibleMonth(value))
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(localeTag, { year: 'numeric', month: 'long' }).format(visibleMonth),
    [localeTag, visibleMonth]
  )
  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(selectedDate ?? new Date()),
    [localeTag, selectedDate]
  )
  const emptyLabel = locale === 'zh' ? '年 / 月 / 日' : 'YYYY / MM / DD'
  const weekdays = useMemo(() => {
    const monday = new Date(2024, 0, 1)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + index)
      return new Intl.DateTimeFormat(localeTag, { weekday: 'short' }).format(day)
    })
  }, [localeTag])
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])

  const updatePosition = useCallback(() => {
    if (!rootRef.current) return

    const rect = rootRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 280)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))

    setMenuPos({
      top: rect.bottom + 4,
      left,
      width,
    })
  }, [])

  useEffect(() => {
    if (!open) return

    updatePosition()

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    const handleViewportChange = () => {
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [open, selectedDate, updatePosition])

  const handleSelect = (date: Date) => {
    onChange(formatDateValue(date))
    setOpen(false)
  }

  const today = new Date()

  return (
    <div className={['date-picker', 'custom-select', className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        type="button"
        className="date-picker-trigger custom-select-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() =>
          setOpen((current) => {
            const nextOpen = !current
            if (nextOpen) setVisibleMonth(getVisibleMonth(value))
            return nextOpen
          })
        }
      >
        <span className={selectedDate ? 'custom-select-value' : 'custom-select-value custom-select-placeholder'}>
          {selectedDate ? dayLabel : placeholder ?? emptyLabel}
        </span>
        <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M6 2a1 1 0 112 0v1h4V2a1 1 0 112 0v1h1.5A2.5 2.5 0 0118 5.5v10A2.5 2.5 0 0115.5 18h-11A2.5 2.5 0 012 15.5v-10A2.5 2.5 0 014.5 3H6V2zm10 5H4v8.5c0 .276.224.5.5.5h11a.5.5 0 00.5-.5V7z" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            className="date-picker-menu"
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            <div className="date-picker-header">
              <button
                type="button"
                className="date-picker-nav"
                aria-label={locale === 'zh' ? '上个月' : 'Previous month'}
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                className="date-picker-nav"
                aria-label={locale === 'zh' ? '下个月' : 'Next month'}
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
            <div className="date-picker-weekdays">
              {weekdays.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="date-picker-grid">
              {days.map((day) => (
                <button
                  key={formatDateValue(day.date)}
                  type="button"
                  className={[
                    'date-picker-day',
                    day.inCurrentMonth ? '' : 'is-outside',
                    isSameDay(day.date, selectedDate) ? 'is-selected' : '',
                    isSameDay(day.date, today) ? 'is-today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleSelect(day.date)}
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>
            <div className="date-picker-footer">
              <button
                type="button"
                className="date-picker-clear"
                disabled={!value}
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                {t('common.clear')}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
