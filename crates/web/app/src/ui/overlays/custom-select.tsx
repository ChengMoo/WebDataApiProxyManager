import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

function nextEnabledIndex(options: SelectOption[], startIndex: number, direction: 1 | -1) {
  if (options.length === 0) return -1

  let index = startIndex
  for (let step = 0; step < options.length; step += 1) {
    index = (index + direction + options.length) % options.length
    if (!options[index]?.disabled) return index
  }

  return -1
}

function getInitialActiveIndex(options: SelectOption[], selectedIndex: number) {
  if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) return selectedIndex
  return options.findIndex((option) => !option.disabled)
}

export function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
  className?: string
  placeholder?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 })
  const listboxId = useId()

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  )
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null

  const updatePosition = useCallback(() => {
    if (!rootRef.current) return

    const rect = rootRef.current.getBoundingClientRect()
    const availableHeight = Math.max(window.innerHeight - rect.bottom - 16, 160)

    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: availableHeight,
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
  }, [open, options, selectedIndex, updatePosition])

  useEffect(() => {
    if (!open || activeIndex < 0) return

    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const handleSelect = useCallback(
    (nextValue: string) => {
      if (nextValue !== value) onChange(nextValue)
      setOpen(false)
    },
    [onChange, value]
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setActiveIndex(getInitialActiveIndex(options, selectedIndex))
        setOpen(true)
        return
      }
      setActiveIndex((current) => nextEnabledIndex(options, current < 0 ? selectedIndex : current, 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setActiveIndex(getInitialActiveIndex(options, selectedIndex))
        setOpen(true)
        return
      }
      setActiveIndex((current) => nextEnabledIndex(options, current < 0 ? selectedIndex : current, -1))
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        setActiveIndex(getInitialActiveIndex(options, selectedIndex))
        setOpen(true)
        return
      }
      if (activeIndex >= 0 && options[activeIndex] && !options[activeIndex].disabled) {
        handleSelect(options[activeIndex].value)
      }
      return
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
      }
    }
  }

  return (
    <div className={['custom-select', className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        type="button"
        className="custom-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() =>
          setOpen((current) => {
            const nextOpen = !current
            if (nextOpen) setActiveIndex(getInitialActiveIndex(options, selectedIndex))
            return nextOpen
          })
        }
        onKeyDown={handleKeyDown}
      >
        <span className={selectedOption ? 'custom-select-value' : 'custom-select-value custom-select-placeholder'}>
          {selectedOption?.label ?? placeholder ?? ''}
        </span>
        <svg
          className={open ? 'custom-select-caret is-open' : 'custom-select-caret'}
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            id={listboxId}
            className="custom-select-menu"
            role="listbox"
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node
                }}
                type="button"
                role="option"
                className={[
                  'custom-select-option',
                  option.value === value ? 'is-selected' : '',
                  index === activeIndex ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-selected={option.value === value}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value ? (
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <path d="M16.704 5.29a1 1 0 010 1.42l-7.01 7.01a1 1 0 01-1.414 0L3.296 8.736a1 1 0 011.414-1.414l4.277 4.277 6.303-6.303a1 1 0 011.414 0z" />
                  </svg>
                ) : null}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
