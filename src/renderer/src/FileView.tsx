import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { isImageExt, type Entry, type SortDir, type SortKey, type ViewMode } from '@shared/types'
import { G, entryGlyph, typeLabel } from './icons'
import { DesktopIcon, FolderColor, OneDriveIcon, folderVariantForPath } from './colored-icons'
import { t } from './i18n'
import { basename, formatDate, formatSize } from './utils'

const ROW_HEIGHT = 30

const perFileExt = ['.exe', '.lnk', '.app', '.ico', '.url', '.desktop']

function iconKey(entry: Entry, size: 'small' | 'large'): string {
  const perFile = perFileExt.includes(entry.ext)
  return `${entry.isDir ? 'dir' : perFile ? entry.path : entry.ext}|${size}`
}

const iconCache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()

function useSysIcon(entry: Entry, size: 'small' | 'large'): string | null {
  const key = iconKey(entry, size)
  const [src, setSrc] = useState<string | null>(() => (entry.isDir ? null : (iconCache.get(key) ?? null)))

  useEffect(() => {
    if (entry.isDir) {
      setSrc(null)
      return
    }
    const cached = iconCache.get(key)
    if (cached !== undefined) {
      setSrc(cached)
      return
    }
    let alive = true
    let promise = pending.get(key)
    if (!promise) {
      promise = window.api.icon(entry.path, size).then((value: string | null) => {
        iconCache.set(key, value)
        pending.delete(key)
        return value
      })
      pending.set(key, promise)
    }
    promise.then((value) => {
      if (alive) setSrc(value)
    })
    return () => {
      alive = false
    }
  }, [key, entry.path, entry.isDir])

  return src
}

export function SysIcon({
  entry,
  size = 'small',
  width
}: {
  entry: Entry
  size?: 'small' | 'large'
  width?: number
}): ReactElement {
  const src = useSysIcon(entry, size)
  const style = width ? { width, height: width } : undefined
  if (entry.isDir) {
    const name = basename(entry.path).toLowerCase()
    const icon =
      name === 'desktop' || name === 'bureau' ? (
        <DesktopIcon />
      ) : name === 'onedrive' ? (
        <OneDriveIcon />
      ) : (
        <FolderColor variant={folderVariantForPath(entry.path)} />
      )
    return (
      <span className={`glyph-icon ${size}`} style={style}>
        {icon}
      </span>
    )
  }
  if (src) return <img className={`sys-icon ${size}`} style={style} src={src} alt="" draggable={false} />
  const Fallback = entryGlyph(entry)
  return (
    <span className={`glyph-icon ${size}`} style={style}>
      <Fallback />
    </span>
  )
}

function Thumb({ entry, width }: { entry: Entry; width: number }): ReactElement {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (entry.isDir || !isImageExt(entry.ext)) {
      setSrc(null)
      return
    }
    let alive = true
    window.api.thumbnail(entry.path, width).then((value: string | null) => {
      if (alive) setSrc(value)
    })
    return () => {
      alive = false
    }
  }, [entry.path, entry.ext, entry.isDir, width])

  if (src) return <img className="thumb" src={src} alt="" draggable={false} />
  return <SysIcon entry={entry} size="large" />
}


function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  className
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onClick: (key: SortKey) => void
  className?: string
}): ReactElement {
  const active = sortKey === activeKey
  return (
    <button type="button" className={`col-head ${className ?? ''}`} onClick={() => onClick(sortKey)}>
      <span>{label}</span>
      {active && <span className={`sort-caret ${dir}`} />}
    </button>
  )
}

export function FileView({
  entries,
  view,
  sortKey,
  sortDir,
  selection,
  focusPath,
  renaming,
  searchMode,
  iconSize,
  loading,
  error,
  currentDir,
  onSelect,
  onOpen,
  onContext,
  onSort,
  onRenameCommit,
  onRenameCancel,
  onRenameChange,
  onDropPaths
}: {
  entries: Entry[]
  view: ViewMode
  sortKey: SortKey
  sortDir: SortDir
  selection: Set<string>
  focusPath: string | null
  renaming: { path: string; value: string } | null
  searchMode: boolean
  iconSize: number
  loading: boolean
  error: string | null
  currentDir: string
  onSelect: (entry: Entry, event: React.MouseEvent) => void
  onOpen: (entry: Entry) => void
  onContext: (event: React.MouseEvent, entry: Entry | null) => void
  onSort: (key: SortKey) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onRenameChange: (value: string) => void
  onDropPaths: (paths: string[], destDir: string, mode: 'copy' | 'move') => void
}): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(element.clientHeight))
    observer.observe(element)
    setHeight(element.clientHeight)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!focusPath || view !== 'details') return
    const index = entries.findIndex((entry) => entry.path === focusPath)
    const element = scrollRef.current
    if (!element || index < 0) return
    const top = index * ROW_HEIGHT
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
      element.scrollTop = top + ROW_HEIGHT - element.clientHeight
    }
  }, [focusPath, entries, view])

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      const dot = renaming.value.lastIndexOf('.')
      renameRef.current.setSelectionRange(0, dot > 0 ? dot : renaming.value.length)
    }
  }, [renaming?.path])

  const dragProps = (entry: Entry): Record<string, unknown> => ({
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      const paths = selection.has(entry.path) ? Array.from(selection) : [entry.path]
      event.dataTransfer.setData('application/x-fex-paths', JSON.stringify(paths))
      event.dataTransfer.setData('text/plain', paths.join('\n'))
      event.dataTransfer.effectAllowed = 'copyMove'
    },
    onDragEnd: () => setDropTarget(null)
  })

  const dropZoneProps = (target: string): Record<string, unknown> => ({
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes('application/x-fex-paths') && !event.dataTransfer.types.includes('Files'))
        return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'
      setDropTarget(target)
    },
    onDragLeave: () => setDropTarget((current) => (current === target ? null : current)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setDropTarget(null)
      const raw = event.dataTransfer.getData('application/x-fex-paths')
      if (raw) {
        try {
          const paths = JSON.parse(raw) as string[]
          onDropPaths(paths.filter((p) => p !== target), target, 'move')
        } catch {
          /* malformed drag payload */
        }
        return
      }
      const files = Array.from(event.dataTransfer.files)
      const paths = files
        .map((file) => {
          try {
            return window.api.getPathForFile(file)
          } catch {
            return ''
          }
        })
        .filter(Boolean)
      if (paths.length) onDropPaths(paths, target, 'copy')
    }
  })

  const renameInput = (
    <input
      ref={renameRef}
      className="rename-input"
      value={renaming?.value ?? ''}
      onChange={(event) => onRenameChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onBlur={onRenameCommit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onRenameCommit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onRenameCancel()
        }
        event.stopPropagation()
      }}
    />
  )

  const isEmpty = !loading && !error && entries.length === 0

  if (view === 'details') {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 8)
    const end = Math.min(entries.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + 8)
    const slice = entries.slice(start, end)

    return (
      <div
        className={`fileview details${dropTarget === currentDir ? ' drop' : ''}`}
        {...dropZoneProps(currentDir)}
        onContextMenu={(event) => {
          if (event.target === event.currentTarget) onContext(event, null)
        }}
      >
        <div className="details-head">
          <SortHeader label={t.name} sortKey="name" activeKey={sortKey} dir={sortDir} onClick={onSort} className="col-name" />
          <SortHeader
            label={searchMode ? t.folderLocation : t.dateModified}
            sortKey={searchMode ? 'name' : 'mtime'}
            activeKey={sortKey}
            dir={sortDir}
            onClick={onSort}
            className="col-date"
          />
          <SortHeader label={t.type} sortKey="type" activeKey={sortKey} dir={sortDir} onClick={onSort} className="col-type" />
          <SortHeader label={t.size} sortKey="size" activeKey={sortKey} dir={sortDir} onClick={onSort} className="col-size" />
        </div>
        <div
          className="details-scroll"
          ref={scrollRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          onContextMenu={(event) => {
            if (event.target === event.currentTarget) onContext(event, null)
          }}
        >
          {error && <div className="empty-state">{error === 'ENOENT' ? t.notFound : t.accessDenied}</div>}
          {loading && <div className="empty-state">{t.loading}</div>}
          {isEmpty && <div className="empty-state">{t.emptyFolder}</div>}
          <div style={{ height: entries.length * ROW_HEIGHT, position: 'relative' }}>
            {slice.map((entry, index) => {
              const rowIndex = start + index
              const selected = selection.has(entry.path)
              const focused = focusPath === entry.path
              return (
                <div
                  key={entry.path}
                  className={`row${selected ? ' selected' : ''}${focused ? ' focused' : ''}${
                    dropTarget === entry.path ? ' droptarget' : ''
                  }`}
                  style={{ top: rowIndex * ROW_HEIGHT }}
                  onClick={(event) => onSelect(entry, event)}
                  onDoubleClick={() => onOpen(entry)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelect(entry, event)
                    onContext(event, entry)
                  }}
                  {...dragProps(entry)}
                  {...(entry.isDir ? dropZoneProps(entry.path) : {})}
                >
                  <span className="col-name">
                    <SysIcon entry={entry} />
                    {renaming?.path === entry.path ? (
                      renameInput
                    ) : (
                      <span className="name-text">{entry.name}</span>
                    )}
                  </span>
                  <span className="col-date">
                    {searchMode ? entry.path.slice(0, entry.path.length - entry.name.length - 1) : formatDate(entry.mtime)}
                  </span>
                  <span className="col-type">{typeLabel(entry, t.folder, t.file)}</span>
                  <span className="col-size">{entry.isDir ? '' : formatSize(entry.size)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const gridStyle =
    view === 'icons'
      ? { gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(80, iconSize + 32)}px, 1fr))` }
      : view === 'tiles'
        ? { gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }
        : { gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }

  return (
    <div
      className={`fileview gridview ${view}${dropTarget === currentDir ? ' drop' : ''}`}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      {...dropZoneProps(currentDir)}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) onContext(event, null)
      }}
    >
      {error && <div className="empty-state">{error === 'ENOENT' ? t.notFound : t.accessDenied}</div>}
      {loading && <div className="empty-state">{t.loading}</div>}
      {isEmpty && <div className="empty-state">{t.emptyFolder}</div>}
      <div className={`grid ${view}`} style={gridStyle}>
        {entries.map((entry) => {
          const selected = selection.has(entry.path)
          const focused = focusPath === entry.path
          return (
            <div
              key={entry.path}
              className={`cell ${view}${selected ? ' selected' : ''}${focused ? ' focused' : ''}${
                dropTarget === entry.path ? ' droptarget' : ''
              }`}
              onClick={(event) => onSelect(entry, event)}
              onDoubleClick={() => onOpen(entry)}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onSelect(entry, event)
                onContext(event, entry)
              }}
              {...dragProps(entry)}
              {...(entry.isDir ? dropZoneProps(entry.path) : {})}
              title={entry.name}
            >
              <span className={`cell-visual ${view}`}>
                {view === 'icons' || view === 'tiles' ? (
                  <Thumb entry={entry} width={view === 'icons' ? iconSize : 64} />
                ) : (
                  <SysIcon entry={entry} size="large" />
                )}
              </span>
              <span className="cell-meta">
                {renaming?.path === entry.path ? (
                  renameInput
                ) : (
                  <span className="cell-name">{entry.name}</span>
                )}
                {view !== 'icons' && (
                  <span className="cell-sub">
                    {entry.isDir ? t.folder : `${typeLabel(entry, t.folder, t.file)} · ${formatSize(entry.size)}`}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {dropTarget === currentDir && <div className="drop-overlay">{t.dropHint}</div>}
    </div>
  )
}

export function PreviewPane({
  entry,
  onClose
}: {
  entry: Entry | null
  onClose: () => void
}): ReactElement {
  const [text, setText] = useState<string | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [info, setInfo] = useState<ReactNode>(null)

  useEffect(() => {
    setText(null)
    setImage(null)
    if (!entry || entry.isDir) {
      setInfo(null)
      return
    }
    if (isImageExt(entry.ext) && entry.size < 24 * 1024 * 1024) {
      window.api.readImage(entry.path).then((value: string | null) => setImage(value))
    }
    if (['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.log', '.csv', '.yml', '.yaml', '.ini'].includes(entry.ext)) {
      window.api.readText(entry.path).then((value: string | null) => setText(value ? value.slice(0, 4000) : null))
    }
    setInfo(null)
  }, [entry?.path])

  if (!entry) {
    return (
      <aside className="previewpane">
        <div className="preview-head">
          <span>{t.preview}</span>
          <button type="button" className="icon-btn" onClick={onClose} title="Fermer">
            <G.close />
          </button>
        </div>
        <div className="preview-empty">—</div>
      </aside>
    )
  }

  return (
    <aside className="previewpane">
      <div className="preview-head">
        <span>{t.preview}</span>
        <button type="button" className="icon-btn" onClick={onClose} title="Fermer">
          <G.close />
        </button>
      </div>
      <div className="preview-body">
        <div className="preview-stage">
          {image ? (
            <img src={image} alt="" />
          ) : (
            <span className="preview-icon">
              <SysIcon entry={entry} size="large" />
            </span>
          )}
        </div>
        <div className="preview-name" title={entry.name}>
          {entry.name}
        </div>
        <dl className="preview-props">
          <dt>{t.type}</dt>
          <dd>{typeLabel(entry, t.folder, t.file)}</dd>
          <dt>{t.size}</dt>
          <dd>{entry.isDir ? '—' : formatSize(entry.size)}</dd>
          <dt>{t.dateModified}</dt>
          <dd>{formatDate(entry.mtime)}</dd>
          <dt>{t.path}</dt>
          <dd className="path-ellipsis" title={entry.path}>
            {entry.path}
          </dd>
        </dl>
        {info}
        {text && <pre className="preview-text">{text}</pre>}
      </div>
    </aside>
  )
}
