import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import './Heading.css'

export type HeadingVariant = 'display' | 'hero' | 'result' | 'dialog' | 'page' | 'section' | 'subsection' | 'group'
export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
export type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  variant?: HeadingVariant
  as?: HeadingTag
  align?: 'left' | 'center'
}

const defaultTags: Record<HeadingVariant, HeadingTag> = {
  display: 'h1', hero: 'h1', result: 'h2', dialog: 'h2', page: 'h1', section: 'h2', subsection: 'h3', group: 'h2',
}

/** Visual size and document heading level are independent; long titles wrap by default. */
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { variant = 'section', as, align = 'left', className, children, ...props }, ref,
) {
  const Tag = as ?? defaultTags[variant]
  return <Tag {...props} ref={ref} data-ui="Heading" className={[
    'dg-heading', `dg-heading--${variant}`, `dg-heading--${align}`, className,
  ].filter(Boolean).join(' ')}>{children}</Tag>
})

export type SectionHeaderProps = Omit<HTMLAttributes<HTMLElement>, 'title' | 'children'> & {
  title: ReactNode
  badge?: ReactNode
  action?: ReactNode
  description?: ReactNode
  variant?: 'section' | 'subsection'
  as?: Exclude<HeadingTag, 'h1'>
  titleId?: string
}

/** A static section heading; actions remain independent, labelled interactive controls. */
export const SectionHeader = forwardRef<HTMLElement, SectionHeaderProps>(function SectionHeader(
  { title, badge, action, description, variant = 'section', as, titleId, className, ...props }, ref,
) {
  return <header {...props} ref={ref} data-ui="SectionHeader" className={['dg-section-header', className].filter(Boolean).join(' ')}>
    <div className="dg-section-header__main">
      <div className="dg-section-header__title-row">
        <Heading id={titleId} as={as} variant={variant}>{title}</Heading>
        {badge != null && <span className="dg-section-header__badge">{badge}</span>}
      </div>
      {description != null && <div className="dg-section-header__description">{description}</div>}
    </div>
    {action != null && <div className="dg-section-header__action">{action}</div>}
  </header>
})
