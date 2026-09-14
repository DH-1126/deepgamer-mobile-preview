import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react'
import type { ProductDetail } from '../../types/productDetail'
import { Button, EmptyStateView, FullScreenPanel, Heading, IconButton, MetricGrid, SearchField, SectionHeader, StatusBar, Tabs } from '../ui'
import { assetImage, assetProgress, createAssetView, designFixtureGroupTotals, designProfessionFilters, designSkinFilters, filterAssetItems, getVisibleAssetCategories, isDesignAssetFixture, type AssetGroup, type AssetItem } from './assetInventoryModel'
import { VerificationSeal } from './VerificationSeal'
import './asset-inventory.css'

type Props = {
  detail: ProductDetail
  linked?: boolean
  onRowCountChange?: (rows: number) => void
  /** @deprecated Kept temporarily for component-library consumers; the flattened inventory does not open a panel. */
  onOpenAll?: (category: string, group: string) => void
}
export const ASSET_INVENTORY_COLUMNS = 4
const PREVIEW_CARD_COUNT = ASSET_INVENTORY_COLUMNS * 2
export function getAssetInventoryRowCount(itemCount: number) {
  return Math.ceil(Math.max(0, itemCount) / ASSET_INVENTORY_COLUMNS)
}
const overview = [{ label: '英雄数量', value: '108' }, { label: '皮肤数量', value: '312' }, { label: '传说皮肤', value: '41' }, { label: '史诗皮肤', value: '96' }, { label: '无双皮肤', value: '2' }, { label: '典藏皮肤', value: '3' }, { label: '珍品传说', value: '2' }]

function AssetArtwork({ entry }: { entry: AssetItem }) {
  const crop = entry.imageCrop
  const style: CSSProperties | undefined = crop ? {
    position: 'absolute', maxWidth: 'none', objectFit: 'fill',
    width: `${crop.sourceWidth / crop.width * 100}%`, height: `${crop.sourceHeight / crop.height * 100}%`,
    left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%`,
  } : undefined
  return <img src={assetImage(entry)} style={style} data-cropped={Boolean(crop) || undefined} data-placeholder={!entry.image || undefined} alt={entry.name + '资产预览'} loading="lazy" />
}

function AssetGrid({ items, rows, id, children }: { items: AssetItem[]; rows: number; id: string; children?: ReactNode }) {
  return <div id={id} className="asset-inventory-grid" data-column-count={ASSET_INVENTORY_COLUMNS} data-row-count={rows}>
    {items.map(entry => <div className="asset-inventory-tile" key={entry.name}><div className="asset-inventory-image"><AssetArtwork entry={entry} />{entry.rarity && <b className={'asset-rarity asset-rarity--' + entry.rarity}>{entry.rarity}</b>}{entry.skinCount != null && <em>已有{entry.skinCount}皮肤</em>}</div><small>{entry.name}</small></div>)}
    {children}
  </div>
}

export function AssetInventory({ detail, linked = false, onRowCountChange }: Props) {
  const [category, setCategory] = useState('英雄')
  const [profession, setProfession] = useState('全部')
  const [expanded, setExpanded] = useState(false)
  const headingRef = useRef<HTMLElement>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const gridId = useId()
  const fixture = isDesignAssetFixture(detail, linked)
  const categoryNames = getVisibleAssetCategories(detail, linked)
  const activeCategory = categoryNames.includes(category) ? category : (categoryNames[0] ?? '')
  const view = useMemo(() => createAssetView(detail, activeCategory, linked), [detail, activeCategory, linked])
  const owned = view.total
  const isSkin = activeCategory === '皮肤'
  const total = fixture && activeCategory === '英雄' ? 121 : null
  const progress = isSkin ? assetProgress(view.items.length, owned) : assetProgress(owned, total)
  const visibleItems = useMemo(() => filterAssetItems(view.items, profession, ''), [view.items, profession])
  const canExpand = visibleItems.length > PREVIEW_CARD_COUNT
  const showExpandCard = canExpand && !expanded
  const displayedItems = showExpandCard ? visibleItems.slice(0, PREVIEW_CARD_COUNT - 1) : visibleItems
  const rowCount = getAssetInventoryRowCount(displayedItems.length + (showExpandCard ? 1 : 0))
  const professions = fixture ? (isSkin ? designSkinFilters : activeCategory === '英雄' ? designProfessionFilters : []) : []
  const displayNote = view.source === 'seller_submitted' && view.note === '卖家填写，待核验' ? undefined : view.note
  useEffect(() => { onRowCountChange?.(rowCount) }, [onRowCountChange, rowCount])
  const collapse = () => {
    setExpanded(false)
    requestAnimationFrame(() => {
      headingRef.current?.scrollIntoView({ block: 'start' })
      expandButtonRef.current?.focus({ preventScroll: true })
    })
  }
  return <section className="asset-inventory" aria-label="资产概览">
    <div className="asset-inventory-overview">
      <VerificationSeal watermark className="asset-overview-seal" />
      <SectionHeader className="asset-inventory-heading" title="资产概览" />
      <MetricGrid columns={4} variant="plain" label="账号资产统计" items={fixture ? overview : detail.assetCategories.filter(entry => categoryNames.includes(entry.name)).map(entry => ({ label: entry.name, value: String(entry.count) }))} className="asset-inventory-metrics" />
    </div>
    <SectionHeader ref={headingRef} className="asset-inventory-heading asset-inventory-heading--check" title="资产清点" />
    {categoryNames.length ? <Tabs label="资产类型" variant="underline" size="md" value={activeCategory} onValueChange={name => { setCategory(name); setProfession('全部'); setExpanded(false) }} items={categoryNames.map(name => ({ value: name, label: name }))} /> : <EmptyStateView compact title="暂无资产分类" />}
    <div className="asset-inventory-total"><strong>{owned ?? '—'}</strong><span>{isSkin ? ` 款皮肤 · 已提供 ${view.items.length} 项明细` : total != null ? ' / 全服' + total + ' · 已拥有' + progress + '%' : owned != null ? ' 项' : ' / 未提供统计'}</span></div>
    {progress != null && <div className="asset-inventory-progress" role="progressbar" aria-label={isSkin ? '皮肤明细收录比例' : '资产拥有比例'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: progress + '%' }} /></div>}
    {professions.length > 0 && <div className="asset-inventory-pills"><Tabs label={isSkin ? '皮肤品质筛选' : '资产职业筛选'} variant="pill" size="sm" wrap value={profession} onValueChange={name => { setProfession(name); setExpanded(false) }} items={professions} /></div>}
    <div className="asset-inventory-caption-row"><p className="asset-inventory-caption">{fixture ? '稀有优先' : '已提供的资产清单'}</p>{expanded && canExpand && <Button variant="ghost" size="sm" onClick={collapse} aria-expanded={true} aria-controls={gridId} aria-label={`收起${activeCategory}资产，顶部`} icon={<ChevronUp size={14} aria-hidden="true" />}>收起</Button>}</div>
    {!visibleItems.length && <p className="asset-inventory-unprovided">{isSkin ? '暂未提供该分类的皮肤明细' : '暂无已提供的资产明细'}</p>}
    {activeCategory && visibleItems.length > 0 && <AssetGrid id={gridId} items={displayedItems} rows={rowCount}>
      {showExpandCard && <button ref={expandButtonRef} type="button" className="asset-inventory-tile asset-inventory-more dg-ui-focus" onClick={() => setExpanded(true)} aria-label={`查看全部${activeCategory}资产`} aria-expanded={false} aria-controls={gridId}><span className="asset-inventory-image"><ChevronDown size={22} aria-hidden="true" /><strong>查看全部</strong></span><small>共 {visibleItems.length} 项</small></button>}
    </AssetGrid>}
    {displayNote && <p className="asset-inventory-note">{showExpandCard ? displayNote.replace(/^当前展示 /, '清单包含 ') : displayNote}</p>}
    {expanded && canExpand && <Button className="asset-inventory-collapse" variant="secondary" size="sm" fullWidth onClick={collapse} aria-expanded={true} aria-controls={gridId} aria-label={`收起${activeCategory}资产，底部`} icon={<ChevronUp size={14} aria-hidden="true" />}>收起</Button>}
  </section>
}

function AssetCard({ entry }: { entry: AssetItem }) {
  return <div className="asset-panel-card"><div className="asset-inventory-image"><AssetArtwork entry={entry} />{entry.rarity && <b className={'asset-rarity asset-rarity--' + entry.rarity}>{entry.rarity}</b>}{entry.skinCount != null && <em>已有{entry.skinCount}皮肤</em>}</div><strong>{entry.name}</strong></div>
}

export function AssetInventoryPanel({ open, onClose, detail, initialCategory, initialGroup = '全部', linked = false, footer }: { open: boolean; onClose: () => void; detail: ProductDetail; initialCategory: string; initialGroup?: string; linked?: boolean; footer?: ReactNode }) {
  const [category, setCategory] = useState(initialCategory || '英雄')
  const [group, setGroup] = useState(initialGroup)
  const [draft, setDraft] = useState('')
  const [submitted, setSubmitted] = useState('')
  useEffect(() => { if (open) { setCategory(initialCategory || '英雄'); setGroup(initialGroup); setDraft(''); setSubmitted('') } }, [open, initialCategory, initialGroup])
  const fixture = isDesignAssetFixture(detail, linked)
  const availableCategories = getVisibleAssetCategories(detail, linked)
  const activeCategory = availableCategories.includes(category) ? category : (availableCategories[0] ?? '')
  const heroFixture = fixture && activeCategory === '英雄'
  const skinFixture = fixture && activeCategory === '皮肤'
  const view = useMemo(() => createAssetView(detail, activeCategory, linked), [detail, activeCategory, linked])
  const filtered = useMemo(() => filterAssetItems(view.items, group, submitted), [view.items, group, submitted])
  const groups = heroFixture ? ['全部', '荣耀典藏', '限定', '传说', '射手', '刺客', '法师', '战士', '坦克'] : skinFixture ? designSkinFilters.map(item => item.value) : ['全部']
  const groupCount: Record<string, number> = skinFixture ? Object.fromEntries(designSkinFilters.map(item => [item.value, item.count])) : { 全部: 108, 荣耀典藏: 6, 限定: 14, 传说: 22, 射手: 18, 刺客: 16 }
  const shownGroups: AssetGroup[] = [...new Set(filtered.map(entry => entry.group))]
  const nextCategory = availableCategories[(Math.max(0, availableCategories.indexOf(activeCategory)) + 1) % Math.max(1, availableCategories.length)]
  const summaryItems = skinFixture ? [{ label: '已拥有皮肤', value: String(view.total ?? '—') }, { label: '典藏皮肤', value: '3' }, { label: '传说皮肤', value: '41' }] : fixture ? [{ label: '已拥有英雄', value: '108' }, { label: '皮肤总数', value: '312' }, { label: '荣耀典藏', value: '6' }] : detail.assetCategories.filter(entry => availableCategories.includes(entry.name)).slice(0, 3).map(entry => ({ label: entry.name, value: String(entry.count) }))
  const sourceNote = !linked && (fixture || detail.verified) ? '英雄与皮肤清单由平台验号时读取，以验号报告为准。' : '以上资产由卖家填写，尚待平台核验。'
  return <FullScreenPanel open={open} onClose={onClose} title={'全部' + activeCategory} className="asset-inventory-panel" footer={footer} header={<>
    <StatusBar className="asset-panel-status" />
    <header className="asset-panel-header"><IconButton label="关闭全部资产" size="sm" onClick={onClose}><ChevronLeft size={22} /></IconButton><Heading as="h2" variant="page" align="center">全部{activeCategory}</Heading>{availableCategories.length > 1 ? <button type="button" onClick={() => { setCategory(nextCategory); setGroup('全部'); setDraft(''); setSubmitted('') }}>{nextCategory}</button> : <span />}</header>
  </>}>
    <div className="asset-panel-content">
      <SearchField value={draft} onChange={event => setDraft(event.target.value)} onClear={() => setDraft('')} onSearch={() => setSubmitted(draft.trim())} placeholder={'搜索' + (activeCategory || '资产') + '名称'} aria-label="搜索资产名称" />
      <Tabs label={skinFixture ? '皮肤品质筛选' : '资产稀有度与职业'} variant="pill" value={group} onValueChange={setGroup} items={groups.map(value => ({ value, label: value, count: heroFixture || skinFixture ? groupCount[value] : undefined }))} />
      <MetricGrid variant="summary" columns={3} label="资产统计" items={summaryItems} className="asset-panel-summary" />
      {filtered.length ? shownGroups.map(assetGroup => {
        const entries = filtered.filter(entry => entry.group === assetGroup)
        const total = heroFixture && group === '全部' && !submitted ? designFixtureGroupTotals[assetGroup] ?? entries.length : entries.length
        const title = heroFixture || skinFixture ? assetGroup === '其他' ? '其他' + activeCategory : (assetGroup === '荣耀典藏' ? '典藏' : assetGroup) + (skinFixture ? '皮肤' : '') : activeCategory + '清单'
        return <section className="asset-panel-group" key={assetGroup}><header><Heading as="h3" variant="subsection">{title}</Heading><small>{total} {activeCategory === '英雄' ? '位' : '项'}</small></header><div className="asset-panel-grid">{entries.map(entry => <AssetCard entry={entry} key={entry.name} />)}</div></section>
      }) : <EmptyStateView compact title={submitted ? '没有找到匹配资产' : skinFixture ? '暂未提供该分类的皮肤明细' : '暂无可展示资产'} />}
      {view.note && <p className="asset-panel-fixture-note">{view.note}</p>}
      <p className="asset-panel-tip">{sourceNote}</p>
    </div>
  </FullScreenPanel>
}
