import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { assetPath } from '../assetPath'
import { Heading, type HeadingTag } from './Heading'
import './layoutPrimitives.css'

export type StatusBarProps = HTMLAttributes<HTMLDivElement> & { tone?: 'default' | 'inverse'; time?: string }
/** Decorative device chrome for the mobile prototype; never reports real device state. */
export function StatusBar({ tone = 'default', time = '9:41', className = '', ...props }: StatusBarProps) {
  return <div {...props} data-ui="StatusBar" aria-hidden="true" className={`dg-status-bar dg-status-bar--${tone} ${className}`}>
    <time>{time}</time><span className="dg-status-bar__icons">{['signal', 'wifi', 'battery'].map(name => <img key={name} src={assetPath(`assets/home-v2/status-${name}.svg`)} alt="" />)}</span>
  </div>
}

export type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactNode; left?: ReactNode; right?: ReactNode; titleAs?: HeadingTag;
  bordered?: boolean; tone?: 'surface' | 'transparent' | 'dark'; sideSize?: 'default' | 'wide';
}
/** Symmetric side slots keep the title centred even when one side is empty. */
export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(function PageHeader({
  title, left, right, titleAs = 'h1', bordered = true, tone = 'surface', sideSize = 'default', children, className = '', ...props
}, ref) {
  return <header {...props} ref={ref} data-ui="PageHeader" className={`dg-page-header dg-page-header--${tone} dg-page-header--${sideSize}${bordered ? ' dg-page-header--bordered' : ''} ${className}`}>
    <div className="dg-page-header__side dg-page-header__side--left">{left}</div>
    <div className="dg-page-header__main">{title != null && title !== '' && <Heading as={titleAs} variant="page" align="center">{title}</Heading>}{children && <div className="dg-page-header__subtitle">{children}</div>}</div>
    <div className="dg-page-header__side dg-page-header__side--right">{right}</div>
  </header>
})

export type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div'; padding?: 'none' | 'sm' | 'md';
  tone?: 'surface' | 'muted' | 'brand' | 'dark'; outlined?: boolean;
}
export const SurfaceCard = forwardRef<HTMLElement, SurfaceCardProps>(function SurfaceCard({
  as: Tag = 'section', padding = 'md', tone = 'surface', outlined = true, className = '', ...props
}, ref) {
  return <Tag {...props} ref={ref as React.Ref<HTMLDivElement>} data-ui="SurfaceCard" className={`dg-surface-card dg-surface-card--${tone} dg-surface-card--${padding}${outlined ? ' dg-surface-card--outlined' : ''} ${className}`} />
})

export type ActionBarProps = HTMLAttributes<HTMLElement> & {
  layout?: 'single' | 'equal' | 'primary-end'; sticky?: boolean; description?: ReactNode;
}
export function ActionBar({ layout = 'equal', sticky = false, description, className = '', children, ...props }: ActionBarProps) {
  return <footer {...props} data-ui="ActionBar" className={`dg-action-bar${sticky ? ' dg-action-bar--sticky' : ''} ${className}`}>
    {description && <div className="dg-action-bar__description">{description}</div>}
    <div className={`dg-action-bar__actions dg-action-bar__actions--${layout}`}>{children}</div>
  </footer>
}

export type SpinnerProps = { label?: string; size?: 'sm' | 'md' | 'lg'; decorative?: boolean; className?: string }
export function Spinner({ label = '正在加载', size = 'md', decorative = false, className = '' }: SpinnerProps) {
  return <span data-ui="Spinner" role={decorative ? undefined : 'status'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined} className={`dg-spinner dg-spinner--${size} ${className}`}><span /></span>
}
