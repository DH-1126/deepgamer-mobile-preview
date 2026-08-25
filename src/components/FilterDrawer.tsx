import { useEffect, useMemo, useRef, useState } from 'react'
import { hasInvalidPriceRange } from './quickFilterModel'
import { emptyFilters, type ProductFilters } from '../types/catalog'
import { assetPath } from './assetPath'

const filtersConfig = [
  { key: 'elite', label: '贵族等级' },
  { key: 'skinCount', label: '皮肤数量' },
  { key: 'price', label: '价格' },
  { key: 'platform', label: '系统平台' },
  { key: 'rank', label: '当前段位' },
  { key: 'realName', label: '实名状态' },
  { key: 'second', label: '能否二次实名' },
  { key: 'face', label: '是否支持人脸包赔' },
  { key: 'skins', label: '皮肤' },
] as const

type FilterKey = (typeof filtersConfig)[number]['key']

const elites = Array.from({ length: 13 }, (_, index) => `V${12 - index}`)
const platforms = ['安卓QQ', '安卓微信', 'iOS QQ', 'iOS 微信']
const ranks = ['倔强青铜', '秩序白银', '荣耀黄金', '尊贵铂金', '永恒钻石', '至尊星耀', '最强王者', '无双王者', '荣耀王者', '传奇王者']
const realNames = ['未实名', '已实名-可改实名', '已实名-不可改实名', '已实名-未知']
const faceOptions = ['支持', '不支持', '是', '否']
const skinGroups: Record<string, string[]> = {
  珍宝阁: ['玩趣恶龙', '优雅恋人', '蔷薇恋人'],
  战令限定: ['御风骁将', '沙漠行僧'],
  赛季限定: ['朱雀志'],
  星传说: ['星域神启'],
  史诗皮肤: ['天鹅之梦', '九霄神辉'],
  荣耀典藏: ['全息碎影', '无限飓风号', '倪克斯神谕'],
  限定皮肤: ['银白咏叹调', '幻阙歌'],
}

const optionsByKey: Record<FilterKey, string[]> = {
  elite: elites,
  skinCount: [],
  price: [],
  platform: platforms,
  rank: ranks,
  realName: realNames,
  second: ['是', '否'],
  face: faceOptions,
  skins: [...Object.keys(skinGroups), ...Object.values(skinGroups).flat()],
}

function Tags({ options, values, onChange }: { options: string[]; values: string[]; onChange: (value: string[]) => void }) {
  return <div className="filter-tags">{options.map((option) => { const selected = values.includes(option); return <button type="button" key={option} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => onChange(selected ? values.filter((value) => value !== option) : [...values, option])}>{option}</button> })}</div>
}

function getSelectedCount(key: FilterKey, filters: ProductFilters) {
  if (key === 'elite') return filters.eliteLevels.length
  if (key === 'skinCount') return Number(Boolean(filters.minSkin || filters.maxSkin))
  if (key === 'price') return Number(Boolean(filters.minPrice || filters.maxPrice))
  if (key === 'platform') return filters.platforms.length
  if (key === 'rank') return filters.ranks.length
  if (key === 'realName') return filters.realNames.length
  if (key === 'second') return Number(Boolean(filters.secondRealName))
  if (key === 'face') return Number(Boolean(filters.faceCompensation))
  return filters.skins.length
}

export function FilterDrawer({ open, filters, onClose, onApply, variant = 'default' }: { open: boolean; filters: ProductFilters; onClose: () => void; onApply: (value: ProductFilters) => void; variant?: 'default' | 'catalogV2' }) {
  const [active, setActive] = useState<FilterKey>('elite')
  const [draft, setDraft] = useState<ProductFilters>(filters)
  const [search, setSearch] = useState('')
  const [skinGroup, setSkinGroup] = useState('珍宝阁')
  const valuesRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const sectionRefs = useRef(new Map<FilterKey, HTMLElement>())
  const navItemRefs = useRef(new Map<FilterKey, HTMLButtonElement>())
  const syncingRef = useRef(false)
  const drawerRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const query = search.trim()
  const visibleConfig = useMemo(() => filtersConfig.filter((config) => !query || config.label.includes(query) || optionsByKey[config.key].some((option) => option.includes(query))), [query])
  const visibleKeys = visibleConfig.map((config) => config.key).join('|')

  useEffect(() => { if (open) setDraft(filters) }, [filters, open])
  useEffect(() => {
    if (!open) return undefined
    const original = document.body.style.overflow
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('button, input')?.focus())
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeRef.current(); return }
      if (event.key !== 'Tab' || !drawerRef.current) return
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]; const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = original; window.removeEventListener('keydown', handleKey); previousFocusRef.current?.focus() }
  }, [open])

  useEffect(() => {
    if (!open) return
    const first = visibleConfig[0]?.key
    if (first) setActive(first)
    requestAnimationFrame(() => { if (valuesRef.current) valuesRef.current.scrollTop = 0 })
    // visibleKeys is the stable signature of the search-filtered directory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visibleKeys])

  useEffect(() => {
    if (!open) return
    const nav = navRef.current
    const button = navItemRefs.current.get(active)
    if (!nav || !button) return
    const top = button.offsetTop
    const bottom = top + button.offsetHeight
    if (top < nav.scrollTop) nav.scrollTo({ top, behavior: 'smooth' })
    else if (bottom > nav.scrollTop + nav.clientHeight) nav.scrollTo({ top: bottom - nav.clientHeight, behavior: 'smooth' })
  }, [active, open])

  const matching = (options: string[], label: string) => !query || label.includes(query) ? options : options.filter((option) => option.includes(query))
  const range = (minKey: 'minPrice' | 'minSkin', maxKey: 'maxPrice' | 'maxSkin', label: string) => { const invalid = hasInvalidPriceRange(draft[minKey], draft[maxKey]); const errorId = `drawer-${minKey}-error`; return <><div className="range-row"><input inputMode="numeric" aria-label={`${label}最低`} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} placeholder="最低" value={draft[minKey]} onChange={(event) => setDraft({ ...draft, [minKey]: event.target.value.replace(/\D/g, '') })} /><span>—</span><input inputMode="numeric" aria-label={`${label}最高`} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} placeholder="最高" value={draft[maxKey]} onChange={(event) => setDraft({ ...draft, [maxKey]: event.target.value.replace(/\D/g, '') })} /></div>{invalid && <p className="drawer-range-error" id={errorId} role="alert">最低值不能高于最高值</p>}</> }
  const skinCategoryMatches = !query || '皮肤'.includes(query)
  const visibleSkinGroups = Object.entries(skinGroups).filter(([group, options]) => skinCategoryMatches || group.includes(query) || options.some((option) => option.includes(query)))
  const currentSkinGroup = visibleSkinGroups.some(([group]) => group === skinGroup) ? skinGroup : (visibleSkinGroups[0]?.[0] ?? skinGroup)

  const renderContent = (key: FilterKey, label: string) => {
    if (key === 'elite') return <Tags options={matching(elites, label)} values={draft.eliteLevels} onChange={(value) => setDraft({ ...draft, eliteLevels: value })} />
    if (key === 'skinCount') return range('minSkin', 'maxSkin', '皮肤数量')
    if (key === 'price') return range('minPrice', 'maxPrice', '价格')
    if (key === 'platform') return <Tags options={matching(platforms, label)} values={draft.platforms} onChange={(value) => setDraft({ ...draft, platforms: value })} />
    if (key === 'rank') return <Tags options={matching(ranks, label)} values={draft.ranks} onChange={(value) => setDraft({ ...draft, ranks: value })} />
    if (key === 'realName') return <Tags options={matching(realNames, label)} values={draft.realNames} onChange={(value) => setDraft({ ...draft, realNames: value })} />
    if (key === 'second') return <Tags options={matching(['是', '否'], label)} values={draft.secondRealName === '' ? [] : [draft.secondRealName === 'true' ? '是' : '否']} onChange={(value) => setDraft({ ...draft, secondRealName: value.at(-1) === '是' ? 'true' : value.at(-1) === '否' ? 'false' : '' })} />
    if (key === 'face') return <Tags options={matching(faceOptions, label)} values={draft.faceCompensation === '' ? [] : [draft.faceCompensation === 'true' ? '支持' : '不支持']} onChange={(value) => setDraft({ ...draft, faceCompensation: ['支持', '是'].includes(value.at(-1) ?? '') ? 'true' : ['不支持', '否'].includes(value.at(-1) ?? '') ? 'false' : '' })} />
    const groupOptions = skinGroups[currentSkinGroup] ?? []
    return <div className="skin-filter"><div className="skin-tabs">{visibleSkinGroups.map(([group]) => <button type="button" className={currentSkinGroup === group ? 'selected' : ''} aria-pressed={currentSkinGroup === group} key={group} onClick={() => setSkinGroup(group)}>{group}</button>)}</div><div className="match-rule"><span>匹配规则</span><button type="button" className={draft.skinMatchRule === 'any' ? 'selected' : ''} aria-pressed={draft.skinMatchRule === 'any'} onClick={() => setDraft({ ...draft, skinMatchRule: 'any' })}>任一</button><button type="button" className={draft.skinMatchRule === 'all' ? 'selected' : ''} aria-pressed={draft.skinMatchRule === 'all'} onClick={() => setDraft({ ...draft, skinMatchRule: 'all' })}>全部</button></div><button className="select-all" type="button" onClick={() => { const all = groupOptions.every((value) => draft.skins.includes(value)); setDraft({ ...draft, skins: all ? draft.skins.filter((value) => !groupOptions.includes(value)) : [...new Set([...draft.skins, ...groupOptions])] }) }}>全选当前分类</button><Tags options={skinCategoryMatches || currentSkinGroup.includes(query) ? groupOptions : groupOptions.filter((option) => option.includes(query))} values={draft.skins} onChange={(value) => setDraft({ ...draft, skins: value })} /></div>
  }

  const scrollToSection = (key: FilterKey) => {
    const pane = valuesRef.current
    const section = sectionRefs.current.get(key)
    if (!pane || !section) return
    syncingRef.current = true
    setActive(key)
    pane.scrollTo({ top: section.offsetTop - 12, behavior: 'smooth' })
    window.setTimeout(() => { syncingRef.current = false }, 350)
  }

  const syncActiveFromScroll = () => {
    if (syncingRef.current || !valuesRef.current || !visibleConfig.length) return
    const pane = valuesRef.current
    const marker = pane.scrollTop + 24
    let next = visibleConfig[0].key
    for (const config of visibleConfig) {
      const section = sectionRefs.current.get(config.key)
      if (section && section.offsetTop <= marker) next = config.key
      else break
    }
    if (pane.scrollHeight - pane.scrollTop - pane.clientHeight <= 2) next = visibleConfig.at(-1)!.key
    if (next !== active) setActive(next)
  }

  if (!open) return null
  const invalidDraft = hasInvalidPriceRange(draft.minPrice, draft.maxPrice) || hasInvalidPriceRange(draft.minSkin, draft.maxSkin)
  const iconBase = assetPath('assets/catalog-v2')
  return <div className={`drawer-layer ${variant === 'catalogV2' ? 'catalog-drawer-layer' : ''}`} role="dialog" aria-modal="true" aria-labelledby="filter-title"><button className="drawer-mask" type="button" aria-label="关闭筛选" onClick={onClose} /><section ref={drawerRef} id="filter-drawer" className={`filter-drawer ${variant === 'catalogV2' ? 'catalog-filter-drawer' : ''}`}><header><h2 id="filter-title">筛选</h2><button type="button" aria-label="关闭" onClick={onClose}><img src={`${iconBase}/remove-x.svg`} alt="" /></button></header><label className="drawer-search"><img src={`${iconBase}/search.svg`} alt="" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="请输入关键词筛选" />{search && <button type="button" aria-label="清空筛选关键词" onClick={() => setSearch('')}><img src={`${iconBase}/remove-x.svg`} alt="" /></button>}</label><div className="drawer-body"><nav ref={navRef} aria-label="筛选分类">{visibleConfig.map((config) => { const count = getSelectedCount(config.key, draft); return <button type="button" key={config.key} ref={(node) => { if (node) navItemRefs.current.set(config.key, node); else navItemRefs.current.delete(config.key) }} className={active === config.key ? 'active' : ''} aria-current={active === config.key ? 'true' : undefined} onClick={() => scrollToSection(config.key)}><span>{config.label}</span>{count > 0 && <b aria-label={`已选${count}项`}>{count}</b>}</button> })}</nav><div ref={valuesRef} className="drawer-values" aria-label="全部筛选条件" onScroll={syncActiveFromScroll}>{visibleConfig.length ? visibleConfig.map((config) => <section className="filter-section" id={`filter-section-${config.key}`} aria-labelledby={`filter-heading-${config.key}`} key={config.key} ref={(node) => { if (node) sectionRefs.current.set(config.key, node); else sectionRefs.current.delete(config.key) }}><h3 id={`filter-heading-${config.key}`}>{config.label}</h3>{renderContent(config.key, config.label)}</section>) : <div className="filter-empty" role="status">没有匹配的筛选项</div>}</div></div><footer><button type="button" onClick={() => setDraft(emptyFilters)}>重置</button><button className="primary" type="button" disabled={invalidDraft} onClick={() => { if (!invalidDraft) onApply(draft) }}>确定</button></footer></section></div>
}
