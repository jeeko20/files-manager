import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { CheckmarkRegular, ChevronRightRegular } from '@fluentui/react-icons'

export interface MenuItem {
  id?: string
  label?: string
  icon?: ReactNode
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  separator?: boolean
  checked?: boolean
  submenu?: MenuItem[]
}

export interface MenuState {
  x: number
  y: number
  items: MenuItem[]
  minWidth?: number
}

function MenuList({
  items,
  onClose,
  minWidth
}: {
  items: MenuItem[]
  onClose: () => void
  minWidth?: number
}): ReactElement {
  const [openSub, setOpenSub] = useState<number | null>(null)
  return (
    <div className="menu" style={{ minWidth }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((item, index) =>
        item.separator ? (
          <div className="menu-sep" key={`sep-${index}`} />
        ) : item.submenu ? (
          <div
            className="menu-item has-sub"
            key={item.id ?? index}
            onMouseEnter={() => setOpenSub(index)}
            onMouseLeave={() => setOpenSub((current) => (current === index ? null : current))}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
            <span className="menu-arrow">
              <ChevronRightRegular />
            </span>
            {openSub === index && (
              <div className="menu submenu">
                <MenuList items={item.submenu} onClose={onClose} minWidth={180} />
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            key={item.id ?? index}
            className={`menu-item${item.danger ? ' danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onClick?.()
            }}
          >
            <span className="menu-icon">{item.checked ? <CheckmarkRegular /> : item.icon}</span>
            <span className="menu-label">{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  )
}

export function Menu({ state, onClose }: { state: MenuState | null; onClose: () => void }): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: state?.x ?? 0, y: state?.y ?? 0 })

  useLayoutEffect(() => {
    if (!state || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    let x = state.x
    let y = state.y
    if (x + rect.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - rect.width - 8)
    if (y + rect.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - rect.height - 8)
    setPos({ x, y })
  }, [state])

  useEffect(() => {
    if (!state) return
    const close = (): void => onClose()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [state, onClose])

  if (!state) return null
  return (
    <div
      ref={ref}
      className="menu-layer"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <MenuList items={state.items} onClose={onClose} minWidth={state.minWidth} />
    </div>
  )
}

export function Dialog({
  title,
  children,
  actions,
  onClose,
  width = 420
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
  onClose: () => void
  width?: number
}): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-layer" onMouseDown={onClose}>
      <div className="dialog" style={{ width }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  )
}

export function Checkbox({
  checked,
  label,
  onChange
}: {
  checked: boolean
  label: string
  onChange: (value: boolean) => void
}): ReactElement {
  return (
    <label className="checkbox-row">
      <span className={`checkbox${checked ? ' checked' : ''}`}>{checked && <CheckmarkRegular />}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
