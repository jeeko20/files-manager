import { useEffect, useState, type ReactElement } from 'react'
import type { DriveUsage, Entry, FileInfo } from '@shared/types'
import { Dialog } from './ui'
import { SysIcon } from './FileView'
import { typeLabel } from './icons'
import { DriveIcon } from './colored-icons'
import { t } from './i18n'
import { basename, driveDisplayName, formatFullDate, formatSize } from './utils'

export function PropertiesDialog({ path, onClose }: { path: string; onClose: () => void }): ReactElement {
  const [info, setInfo] = useState<FileInfo | null>(null)

  useEffect(() => {
    window.api.info(path).then(setInfo).catch(() => setInfo(null))
  }, [path])

  const name = info?.name ?? basename(path)
  const entry: Entry = {
    name,
    path,
    isDir: info?.isDir ?? false,
    isSymlink: !!info?.target,
    size: info?.size ?? 0,
    mtime: info?.mtime ?? 0,
    btime: info?.btime ?? 0,
    ext: info?.ext ?? (name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : ''),
    hidden: info?.hidden ?? false
  }
  const contents = info?.contents ?? null
  const truncated = contents?.truncated ?? false
  const folderSize = contents ? `${truncated ? '≥ ' : ''}${formatSize(contents.size)}` : '—'
  const allocated = info
    ? info.isDir && contents
      ? Math.ceil(contents.size / 4096) * 4096
      : info.sizeOnDisk
    : null
  const attributes = info
    ? [info.writable ? t.writable : t.readOnly, info.hidden ? t.hiddenAttr : null, info.target ? t.linkAttr : null]
        .filter(Boolean)
        .join(', ')
    : '…'

  return (
    <Dialog
      title={t.properties}
      width={520}
      onClose={onClose}
      actions={
        <button type="button" className="btn primary" onClick={onClose}>
          {t.ok}
        </button>
      }
    >
      <div className="props-head">
        <span className="props-icon">
          <SysIcon entry={entry} size="large" />
        </span>
        <span className="props-name">{name}</span>
      </div>
      <dl className="props-list">
        <dt>{t.fileType}</dt>
        <dd>{info ? typeLabel(entry, t.folder, t.file) : '…'}</dd>
        <dt>{t.location}</dt>
        <dd className="selectable">{info?.dir ?? path}</dd>
        <dt>{t.size}</dt>
        <dd>{info ? (info.isDir ? folderSize : formatSize(info.size)) : '…'}</dd>
        <dt>{t.sizeOnDisk}</dt>
        <dd>
          {allocated != null ? `${truncated && info?.isDir ? '≥ ' : ''}${formatSize(allocated)}` : '…'}
        </dd>
        {info?.isDir && (
          <>
            <dt>{t.contains}</dt>
            <dd>
              {contents
                ? `${truncated ? '≥ ' : ''}${t.contentsCount(contents.files, contents.folders)}${truncated ? '…' : ''}`
                : '…'}
            </dd>
          </>
        )}
        <dt>{t.created}</dt>
        <dd>{info ? formatFullDate(info.btime) : '…'}</dd>
        <dt>{t.modified}</dt>
        <dd>{info ? formatFullDate(info.mtime) : '…'}</dd>
        <dt>{t.accessed}</dt>
        <dd>{info ? formatFullDate(info.atime) : '…'}</dd>
        <dt>{t.attributes}</dt>
        <dd>{attributes}</dd>
        {info?.target && (
          <>
            <dt>Cible</dt>
            <dd className="selectable">{info.target}</dd>
          </>
        )}
      </dl>
    </Dialog>
  )
}

function SpaceChart({ ratio }: { ratio: number }): ReactElement {
  const r = 38
  const circumference = 2 * Math.PI * r
  const filled = Math.min(1, Math.max(0, ratio))
  return (
    <svg className="space-chart" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="16" />
      {filled > 0 && (
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="16"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform="rotate(-90 50 50)"
        />
      )}
    </svg>
  )
}

export function DrivePropertiesDialog({ path, onClose }: { path: string; onClose: () => void }): ReactElement {
  const [usage, setUsage] = useState<DriveUsage | null>(null)

  useEffect(() => {
    let alive = true
    window.api
      .driveUsage(path)
      .then((value: DriveUsage) => {
        if (alive) setUsage(value)
      })
      .catch(() => {
        if (alive) setUsage(null)
      })
    return () => {
      alive = false
    }
  }, [path])

  const total = usage?.total ?? null
  const free = usage?.free ?? null
  const used = usage?.used ?? null
  const ratio = total && used != null ? Math.min(1, Math.max(0, used / total)) : 0
  const percent = Math.round(ratio * 100)
  const title = usage ? driveDisplayName(usage) : path

  return (
    <Dialog
      title={t.properties}
      width={520}
      onClose={onClose}
      actions={
        <button type="button" className="btn primary" onClick={onClose}>
          {t.ok}
        </button>
      }
    >
      <div className="props-head">
        <span className="props-icon">
          <DriveIcon />
        </span>
        <span className="props-name">{title}</span>
      </div>
      <dl className="props-list drive-props-meta">
        <dt>{t.type}</dt>
        <dd>{usage?.kind === 'optical' ? t.opticalDrive : t.drive}</dd>
        <dt>{t.filesystem}</dt>
        <dd>{usage?.filesystem ?? '…'}</dd>
      </dl>
      <div className="drive-props">
        <SpaceChart ratio={ratio} />
        <dl className="drive-legend">
          <dt>
            <span className="legend-swatch used" />
            {t.usedSpace}
          </dt>
          <dd>{used != null ? `${formatSize(used)} (${percent} %)` : '…'}</dd>
          <dt>
            <span className="legend-swatch free" />
            {t.freeSpace}
          </dt>
          <dd>{free != null ? formatSize(free) : '…'}</dd>
          <dt>
            <span className="legend-swatch capacity" />
            {t.capacity}
          </dt>
          <dd>{total != null ? formatSize(total) : '…'}</dd>
        </dl>
      </div>
    </Dialog>
  )
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}): ReactElement {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" className={`btn${danger ? ' danger' : ' primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="dialog-text">{body}</p>
    </Dialog>
  )
}
