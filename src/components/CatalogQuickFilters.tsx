import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { SortKey } from '../types/catalog'
import { getPricePreset, getServerOption, hasInvalidPriceRange, pricePresets, serverPlatforms, sortOptions, type ServerOption } from './quickFilterModel'
import { Button, ChoiceChip, Heading, RangeField } from './ui'
import './catalog-quick-filters.css'

export type CatalogQuickFilterPanel = 'sort' | 'server' | 'price'

type CatalogQuickFilterDraft = {
  sort: SortKey
  server: ServerOption
  price: { min: string; max: string; preset: string | null }
}

type CatalogQuickFiltersProps = {
  panel: CatalogQuickFilterPanel
  anchorRef: RefObject<HTMLElement>
  sort: SortKey
  platforms: string[]
  minPrice: string
  maxPrice: string
  linkedMode?: boolean
  onClose: () => void
  onApplySort: (sort: SortKey) => void
  onApplyServer: (platforms: string[]) => void
  onApplyPrice: (min: string, max: string) => void
}

export function createCatalogQuickFilterDraft(sort: SortKey, platforms: string[], minPrice: string, maxPrice: string): CatalogQuickFilterDraft {
  return {
    sort,
    server: getServerOption(platforms),
    price: { min: minPrice, max: maxPrice, preset: getPricePreset(minPrice, maxPrice) },
  }
}

export function resetCatalogQuickFilterDraft(panel: CatalogQuickFilterPanel, draft: CatalogQuickFilterDraft): CatalogQuickFilterDraft {
  if (panel === 'sort') return { ...draft, sort: 'default' }
  if (panel === 'server') return { ...draft, server: 'all' }
  return { ...draft, price: { min: '', max: '', preset: null } }
}

const panelTitles: Record<CatalogQuickFilterPanel, string> = {
  sort: '排序方式',
  server: '游戏区服',
  price: '价格区间',
}

function getAnchorBottom(anchorRef: RefObject<HTMLElement>) {
  return anchorRef.current?.getBoundingClientRect().bottom ?? 0
}

export function CatalogQuickFilters({ panel, anchorRef, sort, platforms, minPrice, maxPrice, linkedMode = false, onClose, onApplySort, onApplyServer, onApplyPrice }: CatalogQuickFiltersProps) {
  const [draft, setDraft] = useState(() => createCatalogQuickFilterDraft(sort, platforms, minPrice, maxPrice))
  const [top, setTop] = useState(() => getAnchorBottom(anchorRef))
  const panelRef = useRef<HTMLElement>(null)
  const invalidPrice = hasInvalidPriceRange(draft.price.min, draft.price.max)
  const panelId = `${panel}-quick-filter`

  useEffect(() => {
    const updateTop = () => setTop(getAnchorBottom(anchorRef))
    updateTop()
    window.addEventListener('resize', updateTop)
    window.addEventListener('scroll', updateTop, true)
    const observer = typeof ResizeObserver === 'undefined' || !anchorRef.current ? null : new ResizeObserver(updateTop)
    if (anchorRef.current) observer?.observe(anchorRef.current)
    return () => {
      window.removeEventListener('resize', updateTop)
      window.removeEventListener('scroll', updateTop, true)
      observer?.disconnect()
    }
  }, [anchorRef])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>(panel === 'price' ? 'input' : '[aria-pressed="true"]')
      ;(preferred ?? panelRef.current)?.focus({ preventScroll: true })
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, panel])

  const apply = () => {
    if (panel === 'sort') onApplySort(draft.sort)
    else if (panel === 'server') onApplyServer([...serverPlatforms[draft.server]])
    else if (!invalidPrice) onApplyPrice(draft.price.min, draft.price.max)
  }

  return <div className="catalog-qf-layer" style={{ '--catalog-qf-top': `${top}px` } as CSSProperties}>
    <button className="catalog-qf-backdrop" type="button" tabIndex={-1} aria-label={`取消${panelTitles[panel]}并关闭`} onClick={onClose} />
    <section id={panelId} ref={panelRef} tabIndex={-1} className="catalog-qf-panel" role="dialog" aria-modal="true" aria-label={`${panelTitles[panel]}筛选`}>
      <Heading as="h2" variant="section">{panelTitles[panel]}</Heading>
      {panel === 'sort' && <div className="catalog-qf-options catalog-qf-options--sort">
        {sortOptions.map((option) => <ChoiceChip key={option.value} selected={draft.sort === option.value} showCheck onClick={() => setDraft((current) => ({ ...current, sort: option.value }))}>{option.label}</ChoiceChip>)}
      </div>}
      {panel === 'server' && <div className="catalog-qf-options catalog-qf-options--server">
        {([['all', '全部'], ['qq', 'QQ'], ['wechat', '微信'], ['steam', 'Steam']] as const).map(([value, label]) => <ChoiceChip key={value} selected={draft.server === value} showCheck onClick={() => setDraft((current) => ({ ...current, server: value }))}>{label}</ChoiceChip>)}
      </div>}
      {panel === 'price' && <div className="catalog-qf-price">
        <RangeField label="价格" min={draft.price.min} max={draft.price.max} onChange={(min, max) => setDraft((current) => ({ ...current, price: { min, max, preset: getPricePreset(min, max) } }))} />
        <div className="catalog-qf-options catalog-qf-options--price" aria-label="快捷价格区间">
          {pricePresets.map((preset) => <ChoiceChip key={preset.id} selected={draft.price.preset === preset.id} showCheck description={linkedMode ? undefined : preset.share} onClick={() => setDraft((current) => ({ ...current, price: { min: preset.min, max: preset.max, preset: preset.id } }))}><strong>{preset.min}–{preset.max}</strong></ChoiceChip>)}
        </div>
      </div>}
      <footer className="catalog-qf-actions">
        <Button variant="outline" size="md" shape="pill" onClick={() => setDraft((current) => resetCatalogQuickFilterDraft(panel, current))}>重置</Button>
        <Button size="md" shape="pill" disabled={panel === 'price' && invalidPrice} onClick={apply}>确定</Button>
      </footer>
    </section>
  </div>
}
