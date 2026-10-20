import { useState, type ReactElement } from 'react'
import type { Drive, SpecialFolders } from '@shared/types'
import {
  DesktopIcon,
  DiscIcon,
  DriveIcon,
  FolderColor,
  OneDriveIcon,
  UsbIcon,
  folderVariantForPath
} from './colored-icons'
import { t } from './i18n'
import { basename, driveDisplayName, formatSize } from './utils'

function folderIcon(path: string): ReactElement {
  const name = basename(path).toLowerCase()
  if (name === 'desktop' || name === 'bureau') return <DesktopIcon />
  if (name === 'onedrive') return <OneDriveIcon />
  return <FolderColor variant={folderVariantForPath(path)} />
}

function usage(drive: Drive): number | null {
  if (drive.total == null || drive.free == null || drive.total <= 0) return null
  return Math.min(100, Math.max(0, ((drive.total - drive.free) / drive.total) * 100))
}

export function ThisPcView({
  drives,
  folders,
  onOpen,
  onDriveContext
}: {
  drives: Drive[]
  folders: SpecialFolders | null
  onOpen: (path: string) => void
  onDriveContext: (event: React.MouseEvent, drive: Drive) => void
}): ReactElement {
  const [selected, setSelected] = useState<string | null>(null)

  const userFolders = folders
    ? [
        { label: t.desktopNav, path: folders.desktop },
        { label: t.documentsNav, path: folders.documents },
        { label: t.downloadsNav, path: folders.downloads },
        { label: t.picturesNav, path: folders.pictures },
        { label: t.musicNav, path: folders.music },
        { label: t.videosNav, path: folders.videos }
      ]
    : []

  const open = (path: string): void => {
    setSelected(path)
    onOpen(path)
  }

  return (
    <div className="thispc">
      {userFolders.length > 0 && (
        <section className="thispc-section">
          <h2 className="thispc-title">{t.foldersSection}</h2>
          <div className="thispc-grid">
            {userFolders.map((folder) => (
              <button
                key={folder.path}
                type="button"
                className={`thispc-folder${selected === folder.path ? ' selected' : ''}`}
                onClick={() => setSelected(folder.path)}
                onDoubleClick={() => open(folder.path)}
                onKeyDown={(event) => event.key === 'Enter' && open(folder.path)}
                title={folder.path}
              >
                <span className="thispc-icon">{folderIcon(folder.path)}</span>
                <span className="thispc-name">{folder.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="thispc-section">
        <h2 className="thispc-title">{t.devicesSection}</h2>
        <div className="thispc-grid drives">
          {drives.map((drive) => {
            const percent = usage(drive)
            return (
              <button
                key={drive.path}
                type="button"
                className={`drive-card${selected === drive.path ? ' selected' : ''}`}
                onClick={() => setSelected(drive.path)}
                onDoubleClick={() => open(drive.path)}
                onKeyDown={(event) => event.key === 'Enter' && open(drive.path)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setSelected(drive.path)
                  onDriveContext(event, drive)
                }}
                title={drive.path}
              >
                <span className="drive-card-icon">
                  {drive.kind === 'drive' || drive.kind === 'root' ? (
                    <DriveIcon />
                  ) : drive.kind === 'optical' ? (
                    <DiscIcon />
                  ) : (
                    <UsbIcon />
                  )}
                </span>
                <span className="drive-card-body">
                  <span className="drive-card-name">{driveDisplayName(drive)}</span>
                  {percent != null && drive.total != null && drive.free != null ? (
                    <>
                      <span className="drive-card-bar">
                        <span style={{ width: `${percent}%` }} />
                      </span>
                      <span className="drive-card-sub">
                        {formatSize(drive.free)} {drive.free > 1 ? t.freePlural : t.free} {t.of}{' '}
                        {formatSize(drive.total)}
                      </span>
                    </>
                  ) : drive.kind === 'optical' ? null : (
                    <span className="drive-card-sub">{t.drive}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
