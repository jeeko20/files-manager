import { useEffect, useRef, useState, type ReactElement } from 'react'
import { G } from './icons'
import { FolderColor, HomeIcon, ThisPcIcon, folderVariantForPath } from './colored-icons'
import { t } from './i18n'

export interface TabInfo {
  id: string
  label: string
  path?: string
}

export function TabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
  onContext
}: {
  tabs: TabInfo[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
  onContext: (event: React.MouseEvent, id: string) => void
}): ReactElement {
  return (
    <div className="tabstrip">
      <div className="tabs" onDoubleClick={(event) => event.target === event.currentTarget && onNew()}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab${tab.id === activeId ? ' active' : ''}`}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault()
                onClose(tab.id)
              } else if (event.button === 0) {
                onSelect(tab.id)
              }
            }}
            onContextMenu={(event) => onContext(event, tab.id)}
            role="tab"
            aria-selected={tab.id === activeId}
            tabIndex={-1}
          >
            <span className="tab-icon">
              {tab.path === 'thispc:' ? (
                <ThisPcIcon />
              ) : tab.path === 'home:' ? (
                <HomeIcon />
              ) : (
                <FolderColor variant={folderVariantForPath(tab.path ?? '')} />
              )}
            </span>
            <span className="tab-label">{tab.label}</span>
            <button
              type="button"
              className="tab-close"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab.id)
              }}
              aria-label="Fermer"
            >
              <G.close />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="tab-new" onClick={onNew} title={t.new} aria-label={t.new}>
        <G.add />
      </button>
    </div>
  )
}

type CommandAction =
  | 'new'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'rename'
  | 'delete'
  | 'share'
  | 'sort'
  | 'view'
  | 'more'

export function CommandBar({
  hasSelection,
  canPaste,
  onAction
}: {
  hasSelection: boolean
  canPaste: boolean
  onAction: (action: CommandAction, event: React.MouseEvent) => void
}): ReactElement {
  const Item = ({
    action,
    icon,
    label,
    disabled,
    withChevron
  }: {
    action: CommandAction
    icon: React.ReactNode
    label: string
    disabled?: boolean
    withChevron?: boolean
  }): ReactElement => (
    <button
      type="button"
      className="cmd"
      disabled={disabled}
      onClick={(event) => onAction(action, event)}
      title={label}
    >
      <span className="cmd-icon">{icon}</span>
      <span className="cmd-label">{label}</span>
      {withChevron && (
        <span className="cmd-chevron">
          <G.chevronDown />
        </span>
      )}
    </button>
  )

  return (
    <div className="commandbar">
      <div className="cmd-group">
        <Item action="new" icon={<G.add />} label={t.new} withChevron />
        <span className="cmd-sep" />
        <Item action="cut" icon={<G.cut />} label={t.cut} disabled={!hasSelection} />
        <Item action="copy" icon={<G.copy />} label={t.copy} disabled={!hasSelection} />
        <Item action="paste" icon={<G.paste />} label={t.paste} disabled={!canPaste} />
        <Item action="rename" icon={<G.rename />} label={t.rename} disabled={!hasSelection} />
        <Item action="delete" icon={<G.delete />} label={t.delete} disabled={!hasSelection} />
        <Item action="share" icon={<G.share />} label={t.share} disabled />
        <span className="cmd-sep" />
        <Item action="sort" icon={<G.sort />} label={t.sort} withChevron />
        <Item action="view" icon={<G.view />} label={t.view} withChevron />
      </div>
      <div className="cmd-group right">
        <Item action="more" icon={<G.more />} label={t.more} />
      </div>
    </div>
  )
}

function splitPath(path: string): { label: string; path: string }[] {
  if (path === 'thispc:') return [{ label: t.thisPc, path: 'thispc:' }]
  if (path === 'home:') return [{ label: t.home, path: 'home:' }]
  const windows = /^[A-Za-z]:[\\/]/.test(path)
  const sep = windows ? '\\' : '/'
  const parts = path.split(/[\\/]/).filter(Boolean)
  const out: { label: string; path: string }[] = []
  if (windows) {
    const drive = parts.shift() as string
    out.push({ label: drive, path: `${drive}\\` })
    let acc = `${drive}\\`
    for (const part of parts) {
      acc = acc.endsWith(sep) ? acc + part : acc + sep + part
      out.push({ label: part, path: acc })
    }
  } else {
    out.push({ label: '/', path: '/' })
    let acc = ''
    for (const part of parts) {
      acc += `/${part}`
      out.push({ label: part, path: acc })
    }
  }
  return out
}

export function AddressBar({
  path,
  editing,
  query,
  canBack,
  canForward,
  onBack,
  onForward,
  onUp,
  onRefresh,
  onNavigate,
  onEditingChange,
  onQuery,
  searchRef
}: {
  path: string
  editing: boolean
  query: string
  canBack: boolean
  canForward: boolean
  onBack: () => void
  onForward: () => void
  onUp: () => void
  onRefresh: () => void
  onNavigate: (path: string) => void
  onEditingChange: (value: boolean) => void
  onQuery: (value: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
}): ReactElement {
  const [draft, setDraft] = useState(path)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(path), [path])
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const crumbs = splitPath(path)

  return (
    <div className="addressbar-row">
      <div className="nav-buttons">
        <button type="button" className="icon-btn" onClick={onBack} disabled={!canBack} title={t.previous}>
          <G.back />
        </button>
        <button type="button" className="icon-btn" onClick={onForward} disabled={!canForward} title={t.next}>
          <G.forward />
        </button>
        <button type="button" className="icon-btn" onClick={onUp} title={t.up}>
          <G.up />
        </button>
        <button type="button" className="icon-btn" onClick={onRefresh} title={t.refresh}>
          <G.refresh />
        </button>
      </div>
      <div className={`address${editing ? ' editing' : ''}`}>
        {editing ? (
          <input
            ref={inputRef}
            className="address-input"
            value={draft}
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              onEditingChange(false)
              setDraft(path)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onEditingChange(false)
                onNavigate(draft.trim())
              } else if (event.key === 'Escape') {
                setDraft(path)
                onEditingChange(false)
              }
            }}
          />
        ) : (
          <div
            className="crumbs"
            onDoubleClick={() => onEditingChange(true)}
            title={path}
          >
            {crumbs.map((crumb, index) => (
              <span className="crumb-wrap" key={crumb.path}>
                {index > 0 && <span className="crumb-sep">›</span>}
                <button
                  type="button"
                  className={`crumb${index === crumbs.length - 1 ? ' last' : ''}`}
                  onClick={() => onNavigate(crumb.path)}
                >
                  {index === crumbs.length - 1 && (
                    <span className="crumb-icon">
                      {crumb.path === 'thispc:' ? (
                        <ThisPcIcon />
                      ) : crumb.path === 'home:' ? (
                        <HomeIcon />
                      ) : (
                        <FolderColor variant={folderVariantForPath(crumb.path)} />
                      )}
                    </span>
                  )}
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
        )}
        <button type="button" className="address-chevron" tabIndex={-1} aria-hidden>
          <G.chevronDown />
        </button>
      </div>
      <div className="searchbox">
        <span className="search-icon">
          <G.search />
        </span>
        <input
          ref={searchRef}
          value={query}
          placeholder={t.searchPlaceholder}
          spellCheck={false}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onQuery('')
          }}
        />
      </div>
    </div>
  )
}

export function StatusBar({
  visible,
  selected,
  sizeLabel,
  searching,
  searchingProgress
}: {
  visible: number
  selected: number
  sizeLabel: string | null
  searching: boolean
  searchingProgress: boolean
}): ReactElement {
  return (
    <div className="statusbar">
      <div className="status-left">
        {selected > 0 ? t.selectionCount(selected) : visible < 0 ? '' : t.itemsCount(visible)}
        {sizeLabel && <span className="status-size"> · {sizeLabel}</span>}
      </div>
      <div className="status-right">
        {searching && <span className="status-progress">{searchingProgress ? t.loading : ''}</span>}
      </div>
    </div>
  )
}
