import type { HTMLAttributes, ReactNode } from 'react'
import { Info, ShieldAlert } from 'lucide-react'
import './InlineNotice.css'

export type InlineNoticeProps = HTMLAttributes<HTMLElement> & {
  label: string
  tone?: 'neutral' | 'warning'
  icon?: ReactNode
  children: ReactNode
}

/** Inline guidance grows with its content; the caller owns spacing and business actions. */
export function InlineNotice({ label, tone = 'neutral', icon, children, className, ...props }: InlineNoticeProps) {
  const DefaultIcon = tone === 'warning' ? ShieldAlert : Info
  return <aside {...props} data-ui="InlineNotice" aria-label={label}
    className={['dg-inline-notice', `dg-inline-notice--${tone}`, className].filter(Boolean).join(' ')}>
    <span className="dg-inline-notice__icon" aria-hidden="true">{icon ?? <DefaultIcon size={16} />}</span>
    <div className="dg-inline-notice__content">{children}</div>
  </aside>
}
