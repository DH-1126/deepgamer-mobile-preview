import { forwardRef, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { ChevronRight, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { assetPath } from '../assetPath'
import { submitSearchOnEnter } from './searchEvents'
import { useKeyboardModality } from './useKeyboardModality'
import { Heading } from './Heading'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type Shape = 'rounded' | 'pill'
const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; shape?: Shape; fullWidth?: boolean; loading?: boolean; icon?: ReactNode }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'lg', shape = 'rounded', fullWidth = false, loading = false, icon, children, disabled, className, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} data-ui="Button" className={join('dg-button dg-ui-focus', `dg-button--${variant}`, `dg-button--${size}`, `dg-button--${shape}`, fullWidth && 'dg-button--full', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading ? <span className="dg-button__spinner" aria-hidden="true" /> : icon}{children}
  </button>
})

export type ActionLinkProps = LinkProps & { variant?: ButtonVariant; size?: ButtonSize; shape?: Shape; fullWidth?: boolean; disabled?: boolean; icon?: ReactNode }
/** Navigation with the same visual variants as Button; retains link semantics. */
export const ActionLink = forwardRef<HTMLAnchorElement, ActionLinkProps>(function ActionLink({ variant = 'primary', size = 'lg', shape = 'rounded', fullWidth = false, disabled = false, icon, className, children, onClick, to, ...props }, ref) {
  const classes = join('dg-button dg-ui-focus', `dg-button--${variant}`, `dg-button--${size}`, `dg-button--${shape}`, fullWidth && 'dg-button--full', disabled && 'dg-button--disabled', className)
  if (disabled) return <a {...props} ref={ref} data-ui="ActionLink" role="link" aria-disabled="true" tabIndex={-1} className={classes}>{icon}{children}</a>
  return <Link {...props} ref={ref} to={to} onClick={onClick} data-ui="ActionLink" className={classes}>{icon}{children}</Link>
})

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md'; variant?: 'plain' | 'soft' }
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, size = 'md', variant = 'plain', className, type = 'button', children, ...props }, ref) {
  return <button ref={ref} type={type} data-ui="IconButton" aria-label={label} className={join('dg-icon-button dg-ui-focus', `dg-icon-button--${size}`, `dg-icon-button--${variant}`, className)} {...props}>{children}</button>
})

export type ChoiceChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; showCheck?: boolean; description?: ReactNode }
export const ChoiceChip = forwardRef<HTMLButtonElement, ChoiceChipProps>(function ChoiceChip({ selected = false, showCheck = false, description, className, children, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} data-ui="ChoiceChip" aria-pressed={selected} className={join('dg-choice-chip dg-ui-focus', description != null && 'dg-choice-chip--descriptive', className)} {...props}>{showCheck && selected && <img className="dg-choice-chip__check" src={assetPath('assets/filter-draft3/selection-check.svg')} alt="" />}{description != null ? <span className="dg-choice-chip__content"><span>{children}</span><small className="dg-choice-chip__description">{description}</small></span> : children}</button>
})

export type FilterTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & { expanded?: boolean; active?: boolean; emphasized?: boolean }
export const FilterTrigger = forwardRef<HTMLButtonElement, FilterTriggerProps>(function FilterTrigger({ expanded = false, active = false, emphasized = false, className, children, type = 'button', ...props }, ref) {
  const highlighted = expanded || active || emphasized
  return <button ref={ref} type={type} data-ui="FilterTrigger" aria-expanded={expanded} className={join('dg-filter-trigger dg-ui-focus', highlighted && 'dg-filter-trigger--highlighted', expanded && 'dg-filter-trigger--expanded', className)} {...props}><span className="dg-filter-trigger__text">{children}</span><img className="dg-filter-trigger__chevron" src={assetPath(`assets/footprint-v3/${highlighted ? 'chevron-dark' : 'chevron'}.svg`)} alt="" /></button>
})

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { label?: string; error?: string; hint?: string; leading?: ReactNode; trailing?: ReactNode; compact?: boolean }
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, error, hint, leading, trailing, compact = false, id, className, 'aria-describedby': describedBy, ...props }, ref) {
  const keyboardMode = useKeyboardModality()
  const generatedId = useId(); const fieldId = id ?? generatedId; const messageId = error || hint ? `${fieldId}-message` : undefined
  const describedByIds = [describedBy, messageId].filter(Boolean).join(' ') || undefined
  return <label data-ui="TextField" className={join('dg-field', className)}>
    {label && <span className="dg-field__label">{label}</span>}
    <span className={join('dg-field__control', compact ? 'dg-field__control--compact' : 'dg-field__control--normal', keyboardMode && 'dg-field__control--keyboard-focus')}>
      {leading && <span className="dg-field__leading">{leading}</span>}<input ref={ref} id={fieldId} className="dg-field__input" aria-invalid={Boolean(error) || undefined} aria-describedby={describedByIds} {...props} />{trailing && <span className="dg-field__trailing">{trailing}</span>}
    </span>
    {(error || hint) && <span id={messageId} className={join('dg-field__hint', error && 'dg-field__error')} role={error ? 'alert' : undefined}>{error ?? hint}</span>}
  </label>
})

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { onClear?: () => void; onSearch?: () => void; clearLabel?: string }
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField({ onClear, onSearch, clearLabel = '清除搜索内容', className, value, defaultValue, disabled, readOnly, onKeyDown, onCompositionStart, onCompositionEnd, 'aria-label': ariaLabel, ...props }, ref) {
  const keyboardMode = useKeyboardModality()
  const composing = useRef(false)
  const hasValue = String(value ?? defaultValue ?? '').length > 0
  const valueProps = value !== undefined ? { value } : { defaultValue }
  return <span data-ui="SearchField" className={join('dg-search-control', className)}>
    <span className={join('dg-search-field', keyboardMode && 'dg-search-field--keyboard-focus')}>
      <Search className="dg-search-field__search" size={18} aria-hidden="true" />
      <input ref={ref} className="dg-search-field__input" type="search" enterKeyHint="search" aria-label={ariaLabel ?? '搜索'} {...valueProps} {...props} disabled={disabled} readOnly={readOnly}
        onCompositionStart={event => { composing.current = true; onCompositionStart?.(event) }}
        onCompositionEnd={event => { composing.current = false; onCompositionEnd?.(event) }}
        onKeyDown={event => { onKeyDown?.(event); submitSearchOnEnter(event, composing.current, disabled ? undefined : onSearch) }} />
      {onClear && hasValue && <button type="button" className="dg-search-field__clear dg-ui-focus" aria-label={clearLabel} disabled={disabled || readOnly} onClick={onClear}><X size={17} aria-hidden="true" /></button>}
    </span>
    {onSearch && <Button className="dg-search-control__submit" size="sm" disabled={disabled} onClick={onSearch}>搜索</Button>}
  </span>
})

export type RangeFieldProps = { label: string; min: string; max: string; onChange: (min: string, max: string) => void; disabled?: boolean }
export function RangeField({ label, min, max, onChange, disabled = false }: RangeFieldProps) {
  const keyboardMode = useKeyboardModality()
  const error = Boolean(min && max && Number(min) > Number(max)); const errorId = useId()
  const clean = (value: string) => value.replace(/\D/g, '')
  return <div data-ui="RangeField" className={join('dg-range', keyboardMode && 'dg-range--keyboard-focus')}><span className="dg-range__label">{label}</span><div className="dg-range__controls"><input className="dg-range__input" disabled={disabled} inputMode="numeric" aria-label={`${label}最低`} aria-invalid={error || undefined} aria-describedby={error ? errorId : undefined} placeholder="最低" value={min} onChange={(event) => onChange(clean(event.target.value), max)} /><span className="dg-range__dash" aria-hidden="true" /><input className="dg-range__input" disabled={disabled} inputMode="numeric" aria-label={`${label}最高`} aria-invalid={error || undefined} aria-describedby={error ? errorId : undefined} placeholder="最高" value={max} onChange={(event) => onChange(min, clean(event.target.value))} /></div>{error && <p id={errorId} className="dg-range__error" role="alert">最低值不能高于最高值</p>}</div>
}

export type TabsProps = { items: { value: string; label: ReactNode; count?: number | string; panelId?: string; disabled?: boolean }[]; value: string; onValueChange: (value: string) => void; label: string; variant?: 'pill' | 'underline' | 'underline-secondary'; size?: 'lg' | 'md' | 'sm'; wrap?: boolean; panelId?: string; className?: string }
function isVisibleFocusable(element: HTMLElement) { return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0 }
export function Tabs({ items, value, onValueChange, label, variant = 'pill', size = 'md', wrap = false, panelId, className }: TabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const rovingIndex = Math.max(0, items.findIndex((item) => item.value === value && !item.disabled), items.findIndex((item) => !item.disabled))
  const selectAndFocus = (index: number) => { const item = items[index]; if (!item || item.disabled) return; onValueChange(item.value); refs.current[index]?.focus() }
  const moveFocus = (current: number, direction: number) => { if (!items.length) return; let next = current; do { next = (next + direction + items.length) % items.length } while (items[next]?.disabled && next !== current); selectAndFocus(next) }
  return <div data-ui="Tabs" role="tablist" aria-label={label} className={join('dg-tabs', variant.startsWith('underline') && 'dg-tabs--underline', variant !== 'underline' && `dg-tabs--${variant}`, `dg-tabs--${size}`, wrap && 'dg-tabs--wrap', className)}>{items.map((item, index) => <button key={item.value} ref={(element) => { refs.current[index] = element }} type="button" role="tab" aria-controls={item.panelId ?? panelId} aria-selected={value === item.value} tabIndex={index === rovingIndex ? 0 : -1} disabled={item.disabled} className="dg-tabs__item dg-ui-focus" onClick={() => onValueChange(item.value)} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveFocus(index, 1) } if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); moveFocus(index, -1) } if (event.key === 'Home') { event.preventDefault(); selectAndFocus(items.findIndex((entry) => !entry.disabled)) } if (event.key === 'End') { event.preventDefault(); selectAndFocus(items.length - 1 - [...items].reverse().findIndex((entry) => !entry.disabled)) } }}>{item.label}{item.count != null && <span className="dg-tabs__count">{item.count}</span>}</button>)}</div>
}

export type ToggleSwitchProps = { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string; disabled?: boolean; showLabel?: boolean; className?: string }
export function ToggleSwitch({ checked, onCheckedChange, label, disabled = false, showLabel = false, className }: ToggleSwitchProps) {
  return <button data-ui="ToggleSwitch" type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={join('dg-toggle dg-ui-focus', showLabel && 'dg-toggle--with-label', className)} onClick={() => onCheckedChange(!checked)}>{showLabel && <span className="dg-toggle__state" aria-hidden="true">{checked ? '开' : '关'}</span>}<span className="dg-toggle__thumb" aria-hidden="true" /></button>
}

export type CheckboxProps = { checked: boolean; onCheckedChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean; className?: string }
export function Checkbox({ checked, onCheckedChange, label, disabled = false, className }: CheckboxProps) {
  return <label data-ui="Checkbox" className={join('dg-checkbox', className)}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onCheckedChange(event.target.checked)} /><span className="dg-checkbox__box" aria-hidden="true">{checked && <span className="dg-checkbox__check">✓</span>}</span><span>{label}</span></label>
}

export type StatusBadgeProps = { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'; children: ReactNode; className?: string; icon?: ReactNode }
export function StatusBadge({ tone = 'neutral', children, className, icon }: StatusBadgeProps) { return <span data-ui="StatusBadge" className={join('dg-status-badge', `dg-status-badge--${tone}`, className)}>{icon && <span className="dg-status-badge__icon" aria-hidden="true">{icon}</span>}{children}</span> }
export type CountBadgeProps = { count: number; max?: number; className?: string }
export function CountBadge({ count, max = 99, className }: CountBadgeProps) { if (count <= 0) return null; return <span data-ui="CountBadge" className={join('dg-count-badge', className)} aria-label={`${count}项`}>{count > max ? `${max}+` : count}</span> }

export type CellProps = { label: ReactNode; description?: ReactNode; value?: ReactNode; icon?: ReactNode; to?: string; onClick?: () => void; trailing?: ReactNode; arrow?: boolean; disabled?: boolean; className?: string }
export function Cell({ label, description, value, icon, to, onClick, trailing, arrow, disabled = false, className }: CellProps) {
  const isClickable = Boolean(to || onClick); const shouldArrow = arrow ?? isClickable
  const content = <>{icon && <span className="dg-cell__icon">{icon}</span>}<span className="dg-cell__main"><span className="dg-cell__label">{label}</span>{description && <span className="dg-cell__description">{description}</span>}</span>{value && <span className="dg-cell__value">{value}</span>}{trailing ? <span className="dg-cell__trailing">{trailing}</span> : shouldArrow && <ChevronRight className="dg-cell__arrow" size={18} strokeWidth={1.75} aria-hidden="true" />}</>
  const classes = join('dg-cell', isClickable && 'dg-cell--button dg-ui-focus', disabled && 'dg-cell--disabled', className)
  if (to && !disabled) return <Link data-ui="Cell" className={classes} to={to} onClick={() => onClick?.()}>{content}</Link>
  if (to && disabled) return <div data-ui="Cell" className={classes} aria-disabled="true">{content}</div>
  if (onClick) return <button data-ui="Cell" type="button" className={classes} onClick={onClick} disabled={disabled}>{content}</button>
  return <div data-ui="Cell" className={classes}>{content}</div>
}

export type EmptyStateViewProps = { title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode; compact?: boolean; className?: string }
export function EmptyStateView({ title, description, icon, action, compact = false, className }: EmptyStateViewProps) { return <section data-ui="EmptyStateView" className={join('dg-empty', compact && 'dg-empty--compact', className)}>{icon && <div className="dg-empty__icon">{icon}</div>}<Heading as="h2" variant="page" align="center" className="dg-empty__title">{title}</Heading>{description && <p className="dg-empty__description">{description}</p>}{action && <div className="dg-empty__action">{action}</div>}</section> }

type OverlayProps = { open: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode; closeOnBackdrop?: boolean; showClose?: boolean; className?: string }
type OverlayToken = { id: symbol; activation: number; open: boolean }
const activeOverlays: OverlayToken[] = []
const overlayListeners = new Set<() => void>()
let lockedOverflow: string | null = null
let overlayActivation = 0
const notifyOverlayStack = () => overlayListeners.forEach((listener) => listener())
function isOverlayTop(token: OverlayToken) { return activeOverlays.every((entry) => entry === token || entry.activation <= token.activation) }
function useOverlay(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement>, closeOnBackdrop: boolean) {
  const token = useMemo<OverlayToken>(() => ({ id: Symbol('overlay'), activation: 0, open: false }), [])
  if (open && !token.open) token.activation = ++overlayActivation
  token.open = open
  const onCloseRef = useRef(onClose)
  const [, setRevision] = useState(0)
  onCloseRef.current = onClose
  useEffect(() => {
    const onStackChange = () => setRevision((revision) => revision + 1)
    overlayListeners.add(onStackChange)
    return () => { overlayListeners.delete(onStackChange) }
  }, [])
  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    activeOverlays.push(token)
    notifyOverlayStack()
    if (activeOverlays.length === 1) { lockedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isOverlayTop(token)) return
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab') return
      const panel = panelRef.current; if (!panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(isVisibleFocusable)
      const first = focusable[0]; const last = focusable.at(-1)
      if (!first || !last) { event.preventDefault(); panel.focus(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    const timer = window.setTimeout(() => {
      if (!isOverlayTop(token)) return
      const panel = panelRef.current
      const firstFocusable = panel ? [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].find(isVisibleFocusable) : undefined
      ;(firstFocusable ?? panel)?.focus({ preventScroll: true })
    }, 0)
    return () => {
      window.clearTimeout(timer); window.removeEventListener('keydown', onKeyDown)
      const index = activeOverlays.lastIndexOf(token); if (index >= 0) activeOverlays.splice(index, 1)
      notifyOverlayStack()
      if (activeOverlays.length === 0 && lockedOverflow !== null) { document.body.style.overflow = lockedOverflow; lockedOverflow = null }
      previousFocus?.focus({ preventScroll: true })
    }
  }, [open, panelRef, token])
  const isTop = open && (activeOverlays.length === 0 || isOverlayTop(token))
  return { isTop, onBackdropClick: (event: React.MouseEvent<HTMLDivElement>) => { if (closeOnBackdrop && event.target === event.currentTarget && isOverlayTop(token)) onCloseRef.current() } }
}

export type DialogProps = OverlayProps
export function Dialog({ open, onClose, title, children, actions, closeOnBackdrop = true, showClose = true, className }: DialogProps) {
  const panelRef = useRef<HTMLElement>(null); const titleId = useId(); const overlay = useOverlay(open, onClose, panelRef, closeOnBackdrop)
  const inertProps = overlay.isTop ? {} : ({ inert: '' } as Record<string, string>)
  if (!open) return null
  const content = <div data-ui="Dialog" className="dg-overlay" onMouseDown={overlay.onBackdropClick} aria-hidden={overlay.isTop ? undefined : true} {...inertProps}><section ref={panelRef} tabIndex={-1} role="dialog" aria-modal={overlay.isTop || undefined} aria-labelledby={titleId} className={join('dg-dialog', className)}><header className="dg-dialog__head"><Heading id={titleId} variant="dialog" className="dg-dialog__title">{title}</Heading>{showClose && <IconButton className="dg-dialog__close" label="关闭" size="sm" onClick={onClose}><X size={20} aria-hidden="true" /></IconButton>}</header><div className="dg-dialog__body">{children}</div>{actions && <footer className="dg-dialog__actions">{actions}</footer>}</section></div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}

export type BottomSheetProps = OverlayProps & { subtitle?: string }
export function BottomSheet({ open, onClose, title, subtitle, children, actions, closeOnBackdrop = true, showClose = true, className }: BottomSheetProps) {
  const panelRef = useRef<HTMLElement>(null); const titleId = useId(); const overlay = useOverlay(open, onClose, panelRef, closeOnBackdrop)
  const inertProps = overlay.isTop ? {} : ({ inert: '' } as Record<string, string>)
  if (!open) return null
  const content = <div data-ui="BottomSheet" className="dg-overlay" onMouseDown={overlay.onBackdropClick} aria-hidden={overlay.isTop ? undefined : true} {...inertProps}><section ref={panelRef} tabIndex={-1} role="dialog" aria-modal={overlay.isTop || undefined} aria-labelledby={titleId} className={join('dg-bottom-sheet', className)}><span className="dg-bottom-sheet__handle" aria-hidden="true" /><header className="dg-bottom-sheet__head"><div className="dg-bottom-sheet__heading"><Heading as="h2" id={titleId} variant="page" className="dg-bottom-sheet__title">{title}</Heading>{subtitle && <p className="dg-bottom-sheet__subtitle">{subtitle}</p>}</div>{showClose && <IconButton label="关闭" size="sm" onClick={onClose}><X size={20} aria-hidden="true" /></IconButton>}</header><div className="dg-bottom-sheet__body">{children}</div>{actions && <footer className="dg-bottom-sheet__actions">{actions}</footer>}</section></div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}

export type FullScreenPanelProps = { open: boolean; onClose: () => void; title: string; header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string; theme?: 'light' | 'dark' }
/** A route-neutral, full-height overlay panel. It intentionally shares Dialog's overlay stack. */
export function FullScreenPanel({ open, onClose, title, header, footer, children, className, theme = 'light' }: FullScreenPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const overlay = useOverlay(open, onClose, panelRef, false)
  const inertProps = overlay.isTop ? {} : ({ inert: '' } as Record<string, string>)
  if (!open) return null
  const defaultHeader = <header className="dg-full-screen-panel__head"><Heading as="h2" variant="page" className="dg-full-screen-panel__title">{title}</Heading><IconButton className="dg-full-screen-panel__close" label="关闭" size="sm" onClick={onClose}><X size={20} aria-hidden="true" /></IconButton></header>
  const content = <div data-ui="FullScreenPanel" className="dg-full-screen-panel-overlay" aria-hidden={overlay.isTop ? undefined : true} {...inertProps}>
    <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal={overlay.isTop || undefined} aria-label={title} className={join('dg-full-screen-panel', `dg-full-screen-panel--${theme}`, className)}>
      {header ?? defaultHeader}
      <div className="dg-full-screen-panel__body">{children}</div>
      {footer && <footer className="dg-full-screen-panel__footer">{footer}</footer>}
    </section>
  </div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}

export type ToastProps = { message: string; onDismiss?: () => void; duration?: number }
export function Toast({ message, onDismiss, duration = 1800 }: ToastProps) {
  useEffect(() => { if (!message || !onDismiss) return; const timer = window.setTimeout(onDismiss, duration); return () => window.clearTimeout(timer) }, [duration, message, onDismiss])
  if (!message) return null
  return <div data-ui="Toast" className="dg-toast" role="status">{message}</div>
}
