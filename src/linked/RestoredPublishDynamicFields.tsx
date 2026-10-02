import { useState, type ReactNode } from 'react'
import { Checkbox, SelectField, TextAreaField, TextField } from '../components/ui'
import type { RestoredPublishDirectoryField, RestoredPublishFieldValue, RestoredPublishForm } from './restoredPublish'

function provided(value: RestoredPublishFieldValue) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'boolean'
}

export function setRestoredPublishOption(field: RestoredPublishDirectoryField, value: RestoredPublishFieldValue, key: string) {
  const selected = new Set(Array.isArray(value) ? value : [])
  if (selected.has(key)) selected.delete(key)
  else selected.add(key)
  return field.options.filter(option => selected.has(option.key)).map(option => option.key)
}

function Required({ field }: { field: RestoredPublishDirectoryField }) {
  return field.required ? <em aria-hidden="true">*</em> : null
}

function hint(field: RestoredPublishDirectoryField) {
  return field.helpText ?? (field.valueType === 'NUMBER' || field.sourceType === 'GOODS_FIELD' ? '请按实际情况填写数值' : undefined)
}

function DynamicField({ field, value, disabled, onChange, renderGoodsMediaField }: {
  field: RestoredPublishDirectoryField
  value: RestoredPublishFieldValue
  disabled: boolean
  onChange: (value: RestoredPublishFieldValue) => void
  renderGoodsMediaField?: (field: RestoredPublishDirectoryField) => ReactNode
}) {
  if (field.sourceType === 'GOODS_FIELD') {
    const key = field.sourceKey.toLowerCase()
    if (['cover', 'cover_image', 'cover_image_url', 'images', 'image_urls', 'goods_images'].includes(key)) {
      return <fieldset className="restored-publish-media-field" disabled={disabled}><legend>{field.label}<Required field={field} /></legend>{renderGoodsMediaField?.(field) ?? <p role="alert">当前页面未提供商品图片控件</p>}</fieldset>
    }
    if (['title', 'goods_title'].includes(key)) return <TextField
      label={field.label} hint={hint(field)} value={typeof value === 'string' ? value : ''} required={field.required} disabled={disabled}
      minLength={field.validation.minLength} maxLength={field.validation.maxLength} placeholder={field.placeholder ?? '请输入商品标题'}
      onChange={event => onChange(event.target.value || undefined)} />
    if (['description', 'goods_description'].includes(key)) return <TextAreaField
      label={field.label} hint={hint(field)} value={typeof value === 'string' ? value : ''} required={field.required} disabled={disabled}
      minLength={field.validation.minLength} maxLength={field.validation.maxLength} showCount placeholder={field.placeholder ?? '请输入商品描述'}
      onChange={event => onChange(event.target.value || undefined)} />
    if (!['price', 'price_fen'].includes(key)) return <p className="restored-goods-error" role="alert">不支持的商品核心字段：{field.sourceKey}</p>
  }
  if (field.cardinality === 'MANY') {
    const selected = Array.isArray(value) ? value : []
    return <fieldset className="restored-publish-choice" disabled={disabled}>
      <legend>{field.label}<Required field={field} /></legend>
      <div className="restored-publish-options">{field.options.map(option => <Checkbox key={option.key} label={option.label} checked={selected.includes(option.key)} disabled={disabled} onCheckedChange={() => onChange(setRestoredPublishOption(field, selected, option.key))} />)}</div>
      {field.helpText && <small>{field.helpText}</small>}
    </fieldset>
  }
  if (field.valueType === 'ENUM' || field.valueType === 'GROUP_SET') {
    if (field.uiType === 'RADIO') return <fieldset className="restored-publish-choice" disabled={disabled}>
      <legend>{field.label}<Required field={field} /></legend>
      <div className="restored-publish-radios">{field.options.map(option => <label key={option.key}><input type="radio" name={field.fieldId} value={option.key} checked={value === option.key} onChange={() => onChange(option.key)} /><span>{option.label}</span></label>)}</div>
      {!field.required && provided(value) && <button type="button" onClick={() => onChange(undefined)}>清除选择</button>}
    </fieldset>
    return <SelectField label={field.label} hint={hint(field)} value={typeof value === 'string' ? value : ''} required={field.required} disabled={disabled} onChange={event => onChange(event.target.value || undefined)}>
      <option value="">{field.placeholder ?? `请选择${field.label}`}</option>
      {field.options.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
    </SelectField>
  }
  if (field.valueType === 'BOOLEAN') return <fieldset className="restored-publish-boolean" disabled={disabled}>
    <legend>{field.label}<Required field={field} /></legend>
    <div>
      <label><input type="radio" name={field.fieldId} checked={value === undefined} onChange={() => onChange(undefined)} /><span>未填写</span></label>
      <label><input type="radio" name={field.fieldId} checked={value === true} onChange={() => onChange(true)} /><span>是</span></label>
      <label><input type="radio" name={field.fieldId} checked={value === false} onChange={() => onChange(false)} /><span>否</span></label>
    </div>
    {field.helpText && <small>{field.helpText}</small>}
  </fieldset>
  if (field.valueType === 'TEXT' && field.uiType === 'TEXTAREA') return <TextAreaField
    label={field.label} hint={hint(field)} value={typeof value === 'string' ? value : ''} required={field.required} disabled={disabled}
    minLength={field.validation.minLength} maxLength={field.validation.maxLength} showCount
    placeholder={field.placeholder ?? `请输入${field.label}`} onChange={event => onChange(event.target.value || undefined)} />
  if (field.valueType === 'DATETIME') return <TextField
    label={field.label} hint={hint(field)} type="datetime-local" value={typeof value === 'string' ? value : ''} required={field.required} disabled={disabled}
    placeholder={field.placeholder} onChange={event => onChange(event.target.value || undefined)} />
  if (field.valueType === 'TEXT') return <TextField
    label={field.label} hint={hint(field)} value={typeof value === 'string' ? value : ''} required={field.required} disabled={disabled}
    minLength={field.validation.minLength} maxLength={field.validation.maxLength} placeholder={field.placeholder ?? `请输入${field.label}`}
    onChange={event => onChange(event.target.value || undefined)} />
  const goodsPrice = field.sourceType === 'GOODS_FIELD' && ['price', 'price_fen'].includes(field.sourceKey.toLowerCase())
  const display = typeof value === 'number' ? String(goodsPrice ? value / 100 : value) : ''
  const minimum = goodsPrice && field.validation.min !== undefined ? field.validation.min / 100 : field.validation.min
  const maximum = goodsPrice && field.validation.max !== undefined ? field.validation.max / 100 : field.validation.max
  return <TextField
    label={goodsPrice ? `${field.label}（元）` : field.label} hint={hint(field)} type="number" inputMode="decimal" step={goodsPrice ? '0.01' : 'any'}
    value={display} required={field.required} disabled={disabled} min={minimum} max={maximum} placeholder={field.placeholder ?? `请输入${field.label}`}
    onChange={event => {
      if (!event.target.value) return onChange(undefined)
      const parsed = Number(event.target.value)
      onChange(Number.isFinite(parsed) ? goodsPrice ? Math.round(parsed * 100) : parsed : undefined)
    }} />
}

export function RestoredPublishDynamicFields({ form, values, disabled, activeStep, onActiveStepChange, onChange, renderGoodsMediaField }: {
  form: RestoredPublishForm
  values: Record<string, RestoredPublishFieldValue>
  disabled: boolean
  activeStep: number
  onActiveStepChange: (step: number) => void
  onChange: (values: Record<string, RestoredPublishFieldValue>) => void
  renderGoodsMediaField?: (field: RestoredPublishDirectoryField) => ReactNode
}) {
  const [issue, setIssue] = useState('')
  const step = Math.max(0, Math.min(activeStep, form.steps.length - 1))
  const current = form.steps[step]
  const update = (fieldId: string, value: RestoredPublishFieldValue) => {
    const next = { ...values }
    if (value === undefined) delete next[fieldId]
    else next[fieldId] = value
    setIssue('')
    onChange(next)
  }
  const next = () => {
    const missing = current.fields.find(field => field.required && !provided(values[field.fieldId]))
    if (missing) return setIssue(`请填写${missing.label}`)
    setIssue('')
    onActiveStepChange(Math.min(form.steps.length - 1, step + 1))
  }
  return <section className="restored-publish-dynamic" aria-label="商品发布资料">
    <header><strong>游戏资料</strong><span>第 {step + 1}/{form.steps.length} 步</span></header>
    <ol aria-label="发布资料步骤">{form.steps.map((item, index) => <li key={item.stepId} className={index === step ? 'active' : index < step ? 'complete' : ''} aria-current={index === step ? 'step' : undefined}><i>{index + 1}</i><span>{item.name}</span></li>)}</ol>
    <fieldset className="restored-publish-step" disabled={disabled}>
      <legend>{current.name}</legend>
      {current.description && <p>{current.description}</p>}
      {current.fields.map(field => <DynamicField key={field.fieldId} field={field} value={values[field.fieldId]} disabled={disabled} onChange={value => update(field.fieldId, value)} renderGoodsMediaField={renderGoodsMediaField} />)}
    </fieldset>
    {issue && <p className="restored-goods-error" role="alert">{issue}</p>}
    <nav className="restored-publish-step-actions" aria-label="发布步骤操作">
      {step > 0 && <button type="button" disabled={disabled} onClick={() => { setIssue(''); onActiveStepChange(step - 1) }}>上一步</button>}
      {step < form.steps.length - 1 ? <button type="button" disabled={disabled} onClick={next}>下一步</button> : <p role="status">游戏资料已填写，请保存草稿或提交审核。</p>}
    </nav>
  </section>
}
