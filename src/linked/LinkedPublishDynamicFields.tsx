import { useEffect, useMemo, useState } from 'react'
import type { LinkedPublishForm, LinkedPublishFormField, LinkedPublishFormSection } from '../../../双端演示/src/publish-config'
import { Checkbox, ToggleSwitch } from '../components/ui'
import type { LinkedPublishFormValue, LinkedPublishFormValues } from './linkedPublishDraftModel'

const PAGE_SIZE = 20

export function isLinkedPublishValueProvided(value: LinkedPublishFormValue) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return Boolean(value.trim())
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'boolean'
}

export function linkedPublishSectionIssues(section: LinkedPublishFormSection, values: LinkedPublishFormValues) {
  return section.fields.filter((field) => field.required && !isLinkedPublishValueProvided(values[field.fieldKey])).map((field) => `请填写${field.label}`)
}

export function toggleLinkedPublishOption(field: LinkedPublishFormField, value: LinkedPublishFormValue, optionId: string) {
  const selected = new Set(Array.isArray(value) ? value : [])
  if (selected.has(optionId)) selected.delete(optionId)
  else selected.add(optionId)
  return field.options.filter((option) => selected.has(option.id)).map((option) => option.id)
}

export function filterLinkedPublishOptions(field: LinkedPublishFormField, keyword: string) {
  const query = keyword.trim().toLocaleLowerCase()
  return query ? field.options.filter((option) => option.name.toLocaleLowerCase().includes(query)) : field.options
}

function RequiredMark({ required }: { required: boolean }) {
  return required ? <em aria-hidden="true">*</em> : null
}

function FieldHint({ field }: { field: LinkedPublishFormField }) {
  if (field.helpText) return <small>{field.helpText}</small>
  if (field.valueType === 'NUMBER') return <small>请按账号实际情况填写数值</small>
  return null
}

function CheckboxField({ field, value, disabled, onChange }: {
  field: LinkedPublishFormField
  value: LinkedPublishFormValue
  disabled: boolean
  onChange: (value: LinkedPublishFormValue) => void
}) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const selected = Array.isArray(value) ? value : []
  const filtered = useMemo(() => filterLinkedPublishOptions(field, keyword), [field, keyword])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [field.fieldKey, keyword])

  return <fieldset className="linked-publish-choice-field" disabled={disabled}>
    <legend>{field.label}<RequiredMark required={field.required} /></legend>
    <div className="linked-publish-choice-tools">
      <input type="search" value={keyword} aria-label={`搜索${field.label}`} placeholder={`搜索${field.label}名称`} onChange={(event) => setKeyword(event.target.value)} />
      <span aria-live="polite">已选 {selected.length} 项</span>
      {selected.length > 0 && <button type="button" onClick={() => onChange([])}>清除</button>}
    </div>
    <div className="linked-publish-checkbox-options">
      {visible.map((option) => <Checkbox key={option.id} label={option.name} checked={selected.includes(option.id)} disabled={disabled} onCheckedChange={() => onChange(toggleLinkedPublishOption(field, selected, option.id))} />)}
      {!visible.length && <p role="status">没有匹配的选项</p>}
    </div>
    {filtered.length > PAGE_SIZE && <nav className="linked-publish-option-pages" aria-label={`${field.label}选项分页`}><button type="button" disabled={disabled || currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button><span>第 {currentPage}/{pageCount} 页</span><button type="button" disabled={disabled || currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>下一页</button></nav>}
    <FieldHint field={field} />
  </fieldset>
}

function DynamicField({ field, value, disabled, onChange }: {
  field: LinkedPublishFormField
  value: LinkedPublishFormValue
  disabled: boolean
  onChange: (value: LinkedPublishFormValue) => void
}) {
  if (field.uiType === 'CHECKBOX') return <CheckboxField field={field} value={value} disabled={disabled} onChange={onChange} />
  if (field.uiType === 'RADIO') return <fieldset className="linked-publish-choice-field" disabled={disabled}>
    <legend>{field.label}<RequiredMark required={field.required} /></legend>
    <div className="linked-publish-radio-options">{field.options.map((option) => <label key={option.id}><input type="radio" name={field.fieldKey} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} /><span>{option.name}</span></label>)}</div>
    {!field.required && typeof value === 'string' && value && <button className="linked-publish-clear" type="button" onClick={() => onChange(undefined)}>清除选择</button>}
    <FieldHint field={field} />
  </fieldset>
  if (field.uiType === 'SWITCH') {
    const provided = typeof value === 'boolean'
    return <div className="linked-publish-switch-field">
      <span>{field.label}<RequiredMark required={field.required} /></span>
      <div><ToggleSwitch checked={value === true} disabled={disabled} label={field.label} showLabel onCheckedChange={onChange} /><b>{provided ? value ? '是' : '否' : '未提供'}</b>{provided && !field.required && <button className="linked-publish-switch-clear" type="button" disabled={disabled} onClick={() => onChange(undefined)}>清除</button>}</div>
      <FieldHint field={field} />
    </div>
  }
  if (field.uiType === 'SELECT') return <label><span>{field.label}<RequiredMark required={field.required} /></span><select value={typeof value === 'string' ? value : ''} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.value || undefined)}><option value="">{field.placeholder || `请选择${field.label}`}</option>{field.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select><FieldHint field={field} /></label>
  return <label><span>{field.label}<RequiredMark required={field.required} /></span><input type="number" inputMode="decimal" step="any" value={typeof value === 'number' ? String(value) : ''} required={field.required} disabled={disabled} placeholder={field.placeholder || `请输入${field.label}`} onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))} /><FieldHint field={field} /></label>
}

function DynamicSection({ section, values, disabled, onChange }: {
  section: LinkedPublishFormSection
  values: LinkedPublishFormValues
  disabled: boolean
  onChange: (fieldKey: string, value: LinkedPublishFormValue) => void
}) {
  return <fieldset className="linked-publish-section" disabled={disabled}>
    <legend>{section.title}</legend>
    {section.description && <p>{section.description}</p>}
    {section.requiredObserved && section.requiredSemantics === null && <small className="linked-publish-section-observation">线上步骤标记为必填；本地仅按具体字段的必填标记校验。</small>}
    {section.fields.map((field) => <DynamicField key={field.fieldKey} field={field} value={values[field.fieldKey]} disabled={disabled} onChange={(value) => onChange(field.fieldKey, value)} />)}
  </fieldset>
}

export function LinkedPublishDynamicFields({ form, values, disabled, activeStep, onActiveStepChange, onChange }: {
  form: LinkedPublishForm
  values: LinkedPublishFormValues
  disabled: boolean
  activeStep: number
  onActiveStepChange: (step: number) => void
  onChange: (values: LinkedPublishFormValues) => void
}) {
  const [stepIssues, setStepIssues] = useState<string[]>([])
  const wizard = Boolean(form.reconstruction)
  const safeStep = Math.max(0, Math.min(activeStep, Math.max(0, form.sections.length - 1)))
  const visibleSections = wizard ? form.sections.slice(safeStep, safeStep + 1) : form.sections
  const update = (fieldKey: string, value: LinkedPublishFormValue) => {
    setStepIssues([])
    const next = { ...values }
    if (value === undefined) delete next[fieldKey]
    else next[fieldKey] = value
    onChange(next)
  }
  const next = () => {
    const section = form.sections[safeStep]
    if (!section) return
    const issues = linkedPublishSectionIssues(section, values)
    setStepIssues(issues)
    if (!issues.length) onActiveStepChange(Math.min(form.sections.length - 1, safeStep + 1))
  }

  return <div className={`linked-publish-sections${wizard ? ' is-wizard' : ''}`}>
    {wizard && <><header className="linked-publish-wizard-header"><strong>游戏资料</strong><span>第 {safeStep + 1}/{form.sections.length} 步</span></header><ol className="linked-publish-wizard-steps" aria-label="发布资料步骤">{form.sections.map((section, index) => <li className={index === safeStep ? 'active' : index < safeStep ? 'complete' : ''} aria-current={index === safeStep ? 'step' : undefined} key={section.sectionKey}><i>{index + 1}</i><span>{section.title}</span></li>)}</ol></>}
    {visibleSections.map((section) => <DynamicSection key={section.sectionKey} section={section} values={values} disabled={disabled} onChange={update} />)}
    {stepIssues.length > 0 && <p className="linked-goods-error" role="alert">{stepIssues[0]}</p>}
    {wizard && <div className="linked-publish-wizard-actions">{safeStep > 0 && <button type="button" disabled={disabled} onClick={() => { setStepIssues([]); onActiveStepChange(safeStep - 1) }}>上一步</button>}{safeStep < form.sections.length - 1 ? <button type="button" disabled={disabled} onClick={next}>下一步</button> : <p role="status">游戏资料已完成，请核对后提交审核。</p>}</div>}
  </div>
}
