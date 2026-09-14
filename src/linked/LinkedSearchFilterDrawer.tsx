import { useEffect, useMemo, useRef, useState } from 'react'
import type { LinkedSearchProjection } from '../../../双端演示/src/contract'
import { assetPath } from '../components/assetPath'
import { Button, ChoiceChip, IconButton } from '../components/ui'
import '../styles/advanced-filter.css'
import './linked-search.css'
import { buildLinkedSearchRequest, countLinkedSearchValues, createLinkedSearchBaseline, describeLinkedSearchValue, getLinkedSearchConflict, sortLinkedSearchFields, type LinkedSearchValues } from './linkedSearchModel'

type LinkedSearchFilterDrawerProps = {
  open: boolean
  gameName: string
  projection: LinkedSearchProjection
  currentProjection: LinkedSearchProjection
  values: LinkedSearchValues
  conflict: string
  onClose: () => void
  onApply: (values: LinkedSearchValues) => void
  onApplyLatest: () => void
  price?: { min: string; max: string }
  onApplyPrice?: (price: { min: string; max: string }) => void
  requestIssues?: (values: LinkedSearchValues) => string[]
  resultCounter?: (values: LinkedSearchValues, price?: { min: string; max: string }) => number
}

const closeIcon = assetPath('assets/filter-draft3/drawer-close.svg')

function projectionMessage(projection: LinkedSearchProjection) {
  if (projection.mode === 'MISSING') return '当前游戏尚未发布 SEARCH 筛选配置。'
  if (projection.mode === 'BLOCKED') return '当前 SEARCH 配置存在缺口，动态筛选暂不可用。'
  if (projection.mode === 'DISABLED') return '当前 SEARCH 配置中的搜索字段已全部停用，动态筛选暂不可用。'
  return ''
}

function CoverageDisclosure({ projection }: { projection: LinkedSearchProjection }) {
  return <details className="linked-search-coverage">
    <summary>本地配置接入 {projection.coverage.includedCount}/{projection.coverage.sourceActiveCount} 项{projection.mode === 'PARTIAL' ? ' · 部分可用' : ''}</summary>
    {projection.excludedFields.length > 0 ? <ul>{projection.excludedFields.map((field) => <li key={field.fieldId}><strong>{field.label}</strong><span>{field.detail}</span></li>)}</ul> : <p>当前本地配置字段均已接入。</p>}
  </details>
}

function RangeInputs({ label, value, onChange, disabled }: {
  label: string
  value: { min?: string; max?: string }
  onChange: (value: { min?: string; max?: string }) => void
  disabled: boolean
}) {
  const min = value.min ?? ''
  const max = value.max ?? ''
  const invalid = Boolean(min && max && Number(min) > Number(max))
  return <div className="linked-search-range">
    <input type="number" step="any" inputMode="decimal" aria-label={`${label}最低`} aria-invalid={invalid || undefined} placeholder="最低" value={min} disabled={disabled} onChange={(event) => onChange({ ...value, min: event.target.value })} />
    <span aria-hidden="true">—</span>
    <input type="number" step="any" inputMode="decimal" aria-label={`${label}最高`} aria-invalid={invalid || undefined} placeholder="最高" value={max} disabled={disabled} onChange={(event) => onChange({ ...value, max: event.target.value })} />
    {invalid && <p role="alert">最低值不能高于最高值</p>}
  </div>
}

export const LINKED_SEARCH_GROUP_PAGE_SIZE = 20

export function getLinkedSearchGroupOptionPage(
  options: LinkedSearchProjection['fields'][number]['options'],
  query: string,
  requestedPage: number,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = normalizedQuery
    ? options.filter((option) => `${option.name} ${option.fullKey} ${option.id}`.toLocaleLowerCase().includes(normalizedQuery))
    : options
  const pageCount = Math.max(1, Math.ceil(filtered.length / LINKED_SEARCH_GROUP_PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  const offset = (page - 1) * LINKED_SEARCH_GROUP_PAGE_SIZE
  return { options: filtered.slice(offset, offset + LINKED_SEARCH_GROUP_PAGE_SIZE), total: filtered.length, page, pageCount }
}

function GroupMultiField({ field, value, disabled, onChange }: {
  field: LinkedSearchProjection['fields'][number]
  value: LinkedSearchValues[string]
  disabled: boolean
  onChange: (value: LinkedSearchValues[string]) => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const optionIds = Array.isArray(value.optionIds) ? value.optionIds : []
  const selected = new Set(optionIds)
  const selectedOptions = optionIds.flatMap((optionId) => {
    const matches = field.options.filter((option) => option.id === optionId)
    return matches.length === 1 ? matches : []
  })
  const optionPage = getLinkedSearchGroupOptionPage(field.options, query, page)
  const allowedModes = field.allowedMatchModes ?? []
  const selectedMode = value.matchMode ?? field.defaultMatchMode ?? 'ALL'
  const updateMode = (matchMode: 'ALL' | 'ANY') => onChange({ ...value, matchMode })
  const toggleOption = (optionId: string) => {
    const nextIds = selected.has(optionId) ? optionIds.filter((id) => id !== optionId) : [...optionIds, optionId]
    onChange({ ...value, optionIds: nextIds, matchMode: selectedMode })
  }

  return <div className="linked-search-group-multi">
    <div className="linked-search-group-mode" role="group" aria-label={`${field.label}匹配方式`}>
      <span>匹配</span>
      {allowedModes.includes('ALL') && <ChoiceChip selected={selectedMode === 'ALL'} disabled={disabled} onClick={() => updateMode('ALL')}>全部</ChoiceChip>}
      {allowedModes.includes('ANY') && <ChoiceChip selected={selectedMode === 'ANY'} disabled={disabled} onClick={() => updateMode('ANY')}>任一</ChoiceChip>}
    </div>
    {selectedOptions.length > 0 && <div className="linked-search-group-selected">
      <div><strong>已选 {selectedOptions.length} 项</strong><Button variant="ghost" size="xs" disabled={disabled} onClick={() => onChange({ ...value, optionIds: [] })}>清空</Button></div>
      <div className="advanced-filter-choices">{selectedOptions.map((option) => <ChoiceChip key={option.id} selected showCheck disabled={disabled} aria-label={`取消选择${option.name}`} onClick={() => toggleOption(option.id)}>{option.name}</ChoiceChip>)}</div>
    </div>}
    <label className="linked-search-group-query">
      <span className="sr-only">搜索{field.label}</span>
      <input type="search" value={query} disabled={disabled} placeholder="搜索选项" aria-label={`搜索${field.label}`} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
    </label>
    {optionPage.total > 0 ? <div className="advanced-filter-choices linked-search-group-options">{optionPage.options.map((option) => <ChoiceChip key={option.id} selected={selected.has(option.id)} disabled={disabled} onClick={() => toggleOption(option.id)}>{option.name}</ChoiceChip>)}</div>
      : <p className="linked-search-group-empty" role="status">未找到匹配选项</p>}
    {optionPage.pageCount > 1 && <div className="linked-search-group-pagination">
      <Button variant="ghost" size="xs" disabled={disabled || optionPage.page === 1} onClick={() => setPage(optionPage.page - 1)}>上一页</Button>
      <span>{optionPage.page}/{optionPage.pageCount} · 共 {optionPage.total} 项</span>
      <Button variant="ghost" size="xs" disabled={disabled || optionPage.page === optionPage.pageCount} onClick={() => setPage(optionPage.page + 1)}>下一页</Button>
    </div>}
  </div>
}

export function LinkedSearchFilterDrawer({
  open, gameName, projection, currentProjection, values, conflict, onClose, onApply, onApplyLatest, price, onApplyPrice, requestIssues, resultCounter,
}: LinkedSearchFilterDrawerProps) {
  const initialFields = sortLinkedSearchFields(projection.fields)
  const [draft, setDraft] = useState<LinkedSearchValues>(values)
  const [draftPrice, setDraftPrice] = useState(price ?? { min: '', max: '' })
  const [pinnedProjection, setPinnedProjection] = useState(projection)
  const [activeFieldId, setActiveFieldId] = useState(initialFields[0]?.id ?? (price ? 'generic-price' : ''))
  const sheetRef = useRef<HTMLElement>(null)
  const wasOpenRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(values)
      setDraftPrice(price ?? { min: '', max: '' })
      setPinnedProjection(projection)
      setActiveFieldId(sortLinkedSearchFields(projection.fields)[0]?.id ?? (price ? 'generic-price' : ''))
    }
    wasOpenRef.current = open
  }, [open, price, projection, values])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
      const first = focusable[0]; const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', keydown)
      document.body.style.overflow = oldOverflow
      previousFocus?.focus({ preventScroll: true })
    }
  }, [open])

  const draftConflict = getLinkedSearchConflict('', currentProjection, createLinkedSearchBaseline('', pinnedProjection), draft)
  const effectiveConflict = conflict || draftConflict
  const localBuild = useMemo(() => buildLinkedSearchRequest(pinnedProjection, draft), [draft, pinnedProjection])
  const issues = useMemo(() => [...localBuild.issues, ...(requestIssues?.(draft) ?? [])], [draft, localBuild.issues, requestIssues])
  const priceInvalid = Boolean(draftPrice.min && draftPrice.max && Number(draftPrice.min) > Number(draftPrice.max))
  const resultCount = resultCounter?.(draft, price ? draftPrice : undefined)
  const unavailable = projectionMessage(pinnedProjection)
  const displayedFields = useMemo(() => sortLinkedSearchFields(pinnedProjection.fields), [pinnedProjection.fields])
  const disabled = Boolean(effectiveConflict || unavailable)
  const activeCount = countLinkedSearchValues(draft)

  if (!open) return null
  return <div className="advanced-filter-layer linked-search-filter-layer">
    <button type="button" className="advanced-filter-mask" aria-label="关闭筛选" tabIndex={-1} onClick={onClose} />
    <section ref={sheetRef} id="linked-search-filter-drawer" className="advanced-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="linked-search-filter-title">
      <header className="advanced-filter-header">
        <h2 id="linked-search-filter-title">筛选</h2><span>{gameName}</span>
        <IconButton label="关闭" size="sm" onClick={onClose}><img src={closeIcon} alt="" /></IconButton>
      </header>

      {effectiveConflict ? <div className="linked-search-conflict" role="alert">
        <h3>筛选配置已变更</h3><p>{effectiveConflict}</p>
        <div className="linked-search-preserved-draft">{Object.entries(draft).map(([fieldId, value]) => {
          const field = pinnedProjection.fields.find((item) => item.id === fieldId)
          if (!field) return null
          const text = field.scene === 'BOOLEAN' || field.scene === 'GROUP_MULTI'
            ? describeLinkedSearchValue(pinnedProjection, fieldId, value)?.value
            : field.scene === 'SINGLE'
              ? field.options.find((option) => option.id === value.optionId)?.name
              : value.min || value.max ? `${value.min || '—'} 至 ${value.max || '—'}` : ''
          return text ? <p key={fieldId}><strong>{field.label}</strong><span>{text}</span></p> : null
        })}</div>
        <Button shape="pill" onClick={() => { setDraft({}); setPinnedProjection(currentProjection); setActiveFieldId(sortLinkedSearchFields(currentProjection.fields)[0]?.id ?? (price ? 'generic-price' : '')); onApplyLatest() }}>应用最新筛选</Button>
      </div> : unavailable ? <div className="linked-search-unavailable" role="status">
        <h3>动态筛选暂不可用</h3><p>{unavailable}</p>
        <CoverageDisclosure projection={currentProjection} />
        {currentProjection.issues.length > 0 && <ul>{currentProjection.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
        <p>仍可使用关键词、价格和排序查找商品。</p>
      </div> : <div className="advanced-filter-body">
        <nav className="advanced-filter-nav" aria-label="筛选分类">{price && <button type="button" aria-current={activeFieldId === 'generic-price' ? 'location' : undefined} aria-controls="linked-search-generic-price" onClick={() => { setActiveFieldId('generic-price'); document.getElementById('linked-search-generic-price')?.scrollIntoView({ block: 'start' }) }}>价格</button>}{displayedFields.map((field) => <button type="button" key={field.id} aria-current={activeFieldId === field.id ? 'location' : undefined} aria-controls={`linked-search-field-${field.id}`} onClick={() => { setActiveFieldId(field.id); document.getElementById(`linked-search-field-${field.id}`)?.scrollIntoView({ block: 'start' }) }}>{field.label}</button>)}</nav>
        <div className="advanced-filter-values">
          <CoverageDisclosure projection={pinnedProjection} />
          {price && <section className="advanced-filter-section" id="linked-search-generic-price"><h3>价格</h3><RangeInputs label="价格" value={draftPrice} disabled={Boolean(effectiveConflict)} onChange={(next) => setDraftPrice({ min: next.min ?? '', max: next.max ?? '' })} /></section>}{displayedFields.map((field) => {
          const value = draft[field.id] ?? {}
          return <section className="advanced-filter-section" id={`linked-search-field-${field.id}`} key={field.id}>
            <h3>{field.label}</h3>
            {field.scene === 'SINGLE' ? <div className="advanced-filter-choices">{field.options.map((option) => <ChoiceChip key={option.id} selected={value.optionId === option.id} disabled={disabled} onClick={() => setDraft((current) => ({ ...current, [field.id]: { optionId: value.optionId === option.id ? undefined : option.id } }))}>{option.name}</ChoiceChip>)}</div>
              : field.scene === 'BOOLEAN' ? <div className="advanced-filter-choices">
                <ChoiceChip selected={value.booleanValue === undefined} disabled={disabled} onClick={() => setDraft((current) => ({ ...current, [field.id]: {} }))}>不限</ChoiceChip>
                <ChoiceChip selected={value.booleanValue === true} disabled={disabled} onClick={() => setDraft((current) => ({ ...current, [field.id]: { booleanValue: true } }))}>是</ChoiceChip>
                <ChoiceChip selected={value.booleanValue === false} disabled={disabled} onClick={() => setDraft((current) => ({ ...current, [field.id]: { booleanValue: false } }))}>否</ChoiceChip>
              </div>
                : field.scene === 'GROUP_MULTI' ? <GroupMultiField field={field} value={value} disabled={disabled} onChange={(next) => setDraft((current) => ({ ...current, [field.id]: next }))} />
                : <RangeInputs label={field.label} value={value} disabled={disabled} onChange={(next) => setDraft((current) => ({ ...current, [field.id]: next }))} />}
          </section>
        })}</div>
      </div>}

      <footer className="advanced-filter-footer">
        <p><i aria-hidden="true" />{issues.length ? issues[0] : priceInvalid ? '价格的最低值不能高于最高值' : pinnedProjection.mode === 'PARTIAL' ? `本地配置接入 ${pinnedProjection.coverage.includedCount}/${pinnedProjection.coverage.sourceActiveCount} 项 · 部分可用` : '条件只在点击查看结果后生效'}</p>
        <div><Button variant="ghost" size="lg" onClick={() => { setDraft({}); if (price) setDraftPrice({ min: '', max: '' }) }}>重置全部</Button><Button className="advanced-filter-submit" size="lg" shape="pill" disabled={disabled || issues.length > 0 || priceInvalid} onClick={() => { onApply(draft); if (price) onApplyPrice?.(draftPrice) }}>查看结果{typeof resultCount === 'number' ? `（${resultCount}）` : ''}</Button></div>
        {activeCount > 0 && resultCount === 0 && !issues.length && <small className="linked-search-zero-result" role="status">当前条件暂无匹配商品，可调整或重置条件。</small>}
      </footer>
    </section>
  </div>
}
