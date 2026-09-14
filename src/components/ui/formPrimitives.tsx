import { forwardRef, useId, useState, type ReactNode, type ButtonHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { useKeyboardModality } from './useKeyboardModality'
import './formPrimitives.css'

type FieldHelp = { label?: string; error?: string; hint?: string }
export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldHelp & { showCount?: boolean }
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField({ label, error, hint, showCount = false, rows = 4, maxLength, value, defaultValue, onChange, className = '', id, 'aria-describedby': describedBy, ...props }, ref) {
  const generatedId = useId(); const fieldId = id ?? generatedId; const helpId = `${fieldId}-help`
  const keyboardMode = useKeyboardModality()
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? ''))
  return <div data-ui="TextAreaField" className={`dg-form-field${keyboardMode ? ' dg-form-field--keyboard' : ''} ${className}`}>
    {label && <label htmlFor={fieldId} className="dg-form-field__label">{label}</label>}
    <textarea {...props} ref={ref} id={fieldId} className="dg-form-field__textarea dg-ui-focus" rows={rows} maxLength={maxLength} value={value} defaultValue={defaultValue} onChange={event => { if (value === undefined) setUncontrolledValue(event.target.value); onChange?.(event) }} aria-invalid={Boolean(error) || undefined} aria-describedby={[describedBy, (error || hint) && helpId].filter(Boolean).join(' ') || undefined} />
    {(error || hint || showCount) && <span className="dg-form-field__footer">{(error || hint) && <span id={helpId} className={error ? 'dg-form-field__error' : ''} role={error ? 'alert' : undefined}>{error ?? hint}</span>}{showCount && <span className="dg-form-field__count">{String(value ?? uncontrolledValue).length}{maxLength != null ? `/${maxLength}` : ''}</span>}</span>}
  </div>
})

export type OptionTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  title: ReactNode; description?: ReactNode; icon?: ReactNode; trailing?: ReactNode; selected?: boolean
}
/** Rich selection card; selection state is always owned by the containing form. */
export const OptionTile = forwardRef<HTMLButtonElement, OptionTileProps>(function OptionTile({ title, description, icon, trailing, selected = false, className = '', type = 'button', ...props }, ref) {
  return <button {...props} ref={ref} type={type} data-ui="OptionTile" aria-pressed={selected} className={`dg-option-tile dg-ui-focus ${className}`}>
    {icon && <span className="dg-option-tile__icon" aria-hidden="true">{icon}</span>}
    <span className="dg-option-tile__content"><strong>{title}</strong>{description && <span>{description}</span>}</span>
    {trailing && <span className="dg-option-tile__trailing" aria-hidden="true">{trailing}</span>}
  </button>
})

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & FieldHelp & {
  options?: { value: string; label: ReactNode; disabled?: boolean }[]; compact?: boolean;
}
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField({ label, error, hint, options, compact = false, children, className = '', id, 'aria-describedby': describedBy, ...props }, ref) {
  const generatedId = useId(); const fieldId = id ?? generatedId; const helpId = `${fieldId}-help`
  const keyboardMode = useKeyboardModality()
  return <div data-ui="SelectField" className={`dg-form-field${keyboardMode ? ' dg-form-field--keyboard' : ''} ${className}`}>
    {label && <label htmlFor={fieldId} className="dg-form-field__label">{label}</label>}
    <span className="dg-form-field__select-wrap"><select {...props} ref={ref} id={fieldId} className={`dg-form-field__select dg-ui-focus${compact ? ' dg-form-field__select--compact' : ''}`} aria-invalid={Boolean(error) || undefined} aria-describedby={[describedBy, (error || hint) && helpId].filter(Boolean).join(' ') || undefined}>{options ? options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>) : children}</select><ChevronDown size={16} aria-hidden="true" /></span>
    {(error || hint) && <span id={helpId} className={`dg-form-field__footer${error ? ' dg-form-field__error' : ''}`} role={error ? 'alert' : undefined}>{error ?? hint}</span>}
  </div>
})
