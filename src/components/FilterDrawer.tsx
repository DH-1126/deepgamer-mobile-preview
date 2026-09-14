import { useEffect, useRef, useState, type ReactNode } from 'react'
import { emptyFilters, type ProductFilters } from '../types/catalog'
import { assetPath } from './assetPath'
import { advancedFilterSections, cloneAdvancedFilters, resolveAdvancedFilterSection, toggleFilterBoolean, type AdvancedFilterSection } from './advancedFilterModel'
import { getActiveFilterCount } from './catalogFilterModel'
import { hasInvalidPriceRange } from './quickFilterModel'
import { Button, ChoiceChip, Heading, IconButton, RangeField } from './ui'
import '../styles/advanced-filter.css'

export type FilterSectionKey = AdvancedFilterSection

const ranks = ['倔强青铜', '秩序白银', '荣耀黄金', '尊贵铂金', '永恒钻石', '至尊星耀', '最强王者', '无双王者', '荣耀王者']
const platforms = ['安卓QQ', '安卓微信', 'iOS QQ', 'iOS 微信', 'Steam']
const realNames = ['未实名', '已实名-可改实名', '已实名-不可改实名', '已实名-未知']
const asset = (name: string) => assetPath(`assets/filter-draft3/${name}.svg`)

function Choices({ options, values, onChange, checkmark = false, className = '' }: {
  options: readonly string[]; values: string[]; onChange: (values: string[]) => void; checkmark?: boolean; className?: string
}) {
  // Keep selected values from search editable even when they are not among the presets.
  const visibleOptions = [...new Set([...options, ...values])]
  return <div className={`advanced-filter-choices ${className}`}>{visibleOptions.map((option) => {
    const selected = values.includes(option)
    return <ChoiceChip key={option} selected={selected} showCheck={checkmark} onClick={() => onChange(selected ? values.filter((value) => value !== option) : [...values, option])}>{option}</ChoiceChip>
  })}</div>
}

function RangeFields({ label, min, max, onChange }: { label: string; min: string; max: string; onChange: (min: string, max: string) => void }) {
  return <div className="advanced-filter-range"><RangeField label={label} min={min} max={max} onChange={onChange} /></div>
}

function BooleanChoices({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="advanced-filter-choices">{(['true', 'false'] as const).map((option) => <ChoiceChip key={option} selected={value === option} onClick={() => onChange(toggleFilterBoolean(value, option))}>{option === 'true' ? '支持' : '不支持'}</ChoiceChip>)}</div>
}

type FilterDrawerProps = {
  open: boolean; filters: ProductFilters; onClose: () => void; onApply: (value: ProductFilters) => void
  variant?: 'default' | 'catalogV2'; initialSection?: FilterSectionKey; gameName?: string
  resultCounter?: (value: ProductFilters) => number
}

export function FilterDrawer({ open, filters, onClose, onApply, initialSection = 'skinCount', gameName = '王者荣耀', resultCounter }: FilterDrawerProps) {
  const [draft, setDraft] = useState(() => cloneAdvancedFilters(filters))
  const [active, setActive] = useState(() => resolveAdvancedFilterSection(initialSection))
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [requestNotice, setRequestNotice] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const valuesRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const sectionRefs = useRef<Partial<Record<FilterSectionKey, HTMLElement>>>({})
  const onCloseRef = useRef(onClose)
  const pendingAnchorRef = useRef<FilterSectionKey | null>(null)
  const savedScrollRef = useRef(0)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    setDraft(cloneAdvancedFilters(filters))
    setActive(resolveAdvancedFilterSection(initialSection))
    pendingAnchorRef.current = resolveAdvancedFilterSection(initialSection)
    setRecoveryOpen(false)
    setRequestNotice(false)
    savedScrollRef.current = 0
  }, [filters, initialSection, open])

  useEffect(() => {
    if (!open) return
    const oldOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !drawerRef.current) return
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
      const first = focusable[0]; const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', keydown)
      previousFocus?.focus({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open || recoveryOpen || !valuesRef.current) return
    const container = valuesRef.current
    const lastSection = sectionRefs.current[advancedFilterSections.at(-1)!.key]
    const measure = () => {
      // Allow the final heading to reach the top without adding gaps between sections.
      container.style.setProperty('--filter-trailing-space', `${Math.max(0, container.clientHeight - (lastSection?.offsetHeight ?? 0) - 28)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    if (lastSection) observer.observe(lastSection)
    const frame = requestAnimationFrame(() => {
      const section = pendingAnchorRef.current && sectionRefs.current[pendingAnchorRef.current]
      container.scrollTo({ top: section ? section.offsetTop - 14 : savedScrollRef.current, behavior: 'instant' })
      pendingAnchorRef.current = null
    })
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [initialSection, open, recoveryOpen])

  const scrollToSection = (key: FilterSectionKey) => {
    setActive(key)
    if (recoveryOpen) {
      pendingAnchorRef.current = key
      setRecoveryOpen(false)
    } else {
      pendingAnchorRef.current = null
      const section = sectionRefs.current[key]
      if (section) valuesRef.current?.scrollTo({ top: section.offsetTop - 14, behavior: 'instant' })
    }
  }
  const syncActiveSection = () => {
    const container = valuesRef.current
    if (!container || recoveryOpen) return
    savedScrollRef.current = container.scrollTop
    const current = [...advancedFilterSections].reverse().find(({ key }) => (sectionRefs.current[key]?.offsetTop ?? Infinity) <= container.scrollTop + 18)
    if (!current) return
    setActive(current.key)
    const nav = navRef.current
    const button = nav?.querySelector<HTMLElement>(`[data-filter-anchor="${current.key}"]`)
    if (nav && button) {
      if (button.offsetTop < nav.scrollTop) nav.scrollTop = button.offsetTop
      else if (button.offsetTop + button.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = button.offsetTop + button.offsetHeight - nav.clientHeight
    }
  }

  const resultCount = resultCounter?.(draft)
  const invalid = hasInvalidPriceRange(draft.minPrice, draft.maxPrice) || hasInvalidPriceRange(draft.minSkin, draft.maxSkin)
  const reset = () => {
    setDraft(cloneAdvancedFilters(emptyFilters))
    setRecoveryOpen(false)
    setRequestNotice(false)
    pendingAnchorRef.current = 'skinCount'
    scrollToSection('skinCount')
  }
  const recover = (next: ProductFilters) => {
    setDraft(cloneAdvancedFilters(next))
    setRecoveryOpen(false)
    pendingAnchorRef.current = active
  }
  const submit = () => {
    if (invalid) return
    if (resultCount === 0) { setRecoveryOpen(true); return }
    onApply(cloneAdvancedFilters(draft))
  }

  const sectionContent: Record<FilterSectionKey, ReactNode> = {
    skinCount: <RangeFields label="皮肤数量" min={draft.minSkin} max={draft.maxSkin} onChange={(minSkin, maxSkin) => setDraft({ ...draft, minSkin, maxSkin })} />,
    rank: <Choices options={ranks} values={draft.ranks} className="advanced-filter-ranks" onChange={(values) => setDraft({ ...draft, ranks: values })} />,
    price: <RangeFields label="价格" min={draft.minPrice} max={draft.maxPrice} onChange={(minPrice, maxPrice) => setDraft({ ...draft, minPrice, maxPrice })} />,
    platform: <Choices options={platforms} values={draft.platforms} onChange={(values) => setDraft({ ...draft, platforms: values })} />,
    realName: <Choices options={realNames} values={draft.realNames} onChange={(values) => setDraft({ ...draft, realNames: values })} />,
    secondRealName: <BooleanChoices value={draft.secondRealName} onChange={(value) => setDraft({ ...draft, secondRealName: value })} />,
    faceCompensation: <BooleanChoices value={draft.faceCompensation} onChange={(value) => setDraft({ ...draft, faceCompensation: value })} />,
  }

  if (!open) return null
  return <div className="advanced-filter-layer">
    <button type="button" className="advanced-filter-mask" aria-label="关闭筛选" tabIndex={-1} onClick={onClose} />
    <section ref={drawerRef} id="filter-drawer" className="advanced-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title">
      <header className="advanced-filter-header"><Heading id="filter-title" as="h2" variant="page">筛选</Heading><span>{gameName}</span><IconButton label="关闭" size="sm" onClick={onClose}><img src={asset('drawer-close')} alt="" /></IconButton></header>
      <div className="advanced-filter-body">
        <nav ref={navRef} className="advanced-filter-nav" aria-label="筛选分类">{advancedFilterSections.map(({ key, label }) => <button type="button" key={key} data-filter-anchor={key} aria-current={active === key ? 'location' : undefined} aria-controls={`filter-section-${key}`} onClick={() => scrollToSection(key)}>{label}</button>)}</nav>
        {recoveryOpen ? <div className="advanced-filter-recovery" role="status">
          <Heading as="h3" variant="subsection">当前条件暂无匹配账号</Heading><p>已选 {getActiveFilterCount(draft)} 个条件，放宽条件后再查看结果。</p><Heading as="h4" variant="subsection">放宽一个条件</Heading>
          {(draft.minPrice || draft.maxPrice) && <button type="button" onClick={() => recover({ ...draft, minPrice: '', maxPrice: '' })}><strong>清除价格限制</strong><small>保留其他条件，扩大价格范围</small></button>}
          <button type="button" onClick={() => scrollToSection(active)}>返回修改条件</button><hr /><Heading as="h4" variant="subsection">或者</Heading><button type="button" onClick={reset}>清空全部条件</button>
          <button type="button" className="advanced-filter-request" onClick={() => setRequestNotice(true)}>发布求购，有号就通知你</button>
          {requestNotice && <p>当前为本地演示，暂不支持发布求购和到货通知。</p>}
        </div> : <div ref={valuesRef} className="advanced-filter-values" onScroll={syncActiveSection}>
          {advancedFilterSections.map(({ key, label }) => <section key={key} id={`filter-section-${key}`} ref={(element) => { if (element) sectionRefs.current[key] = element; else delete sectionRefs.current[key] }} className="advanced-filter-section" aria-labelledby={`filter-heading-${key}`}><Heading id={`filter-heading-${key}`} as="h3" variant="subsection">{label}</Heading>{sectionContent[key]}</section>)}
          <div className="advanced-filter-scroll-spacer" aria-hidden="true" />
        </div>}
      </div>
      <footer className="advanced-filter-footer"><p><i aria-hidden="true" />修改尚未生效，点下方按钮后应用到列表</p><div><Button variant="ghost" size="lg" onClick={reset}>重置全部</Button><Button className="advanced-filter-submit" size="lg" shape="pill" disabled={invalid || (recoveryOpen && resultCount === 0)} onClick={submit}>{recoveryOpen && resultCount === 0 ? '暂无匹配结果' : '查看结果'}</Button></div></footer>
    </section>
  </div>
}
