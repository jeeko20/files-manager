import type { ReactElement } from 'react'
import { DiscIcon } from './colored-icons'
import { t } from './i18n'

interface DriveEmptyViewProps {
  path: string
  onRefresh: () => void
}

export function DriveEmptyView({ path, onRefresh }: DriveEmptyViewProps): ReactElement {
  const drive = path.replace(/[\\/]+$/, '')

  return (
    <div className="drive-empty">
      <span className="drive-empty-icon">
        <DiscIcon />
      </span>
      <h2>{t.noDiscTitle}</h2>
      <p>{t.noDiscBody(drive)}</p>
      <p className="drive-empty-hint">{t.noDiscHint}</p>
      <button type="button" className="btn drive-empty-retry" onClick={onRefresh}>
        {t.retry}
      </button>
    </div>
  )
}
