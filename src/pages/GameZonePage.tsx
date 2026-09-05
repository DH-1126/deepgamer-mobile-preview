import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { assetPath } from '../components/assetPath'
import { getActiveFilterChips, getActiveFilterCount, initialCatalogFilters, removeActiveFilter } from '../components/catalogFilterModel'
import { EmptyState } from '../components/EmptyState'
import { FilterDrawer } from '../components/FilterDrawer'
import { ProductCard } from '../components/ProductCard'
import { getPricePreset, getServerOption, getToolbarActiveState, hasInvalidPriceRange, pricePresets, serverPlatforms, sortOptions, type ServerOption, type ToolbarSelection } from '../components/quickFilterModel'
import { catalogRepository } from '../repository/catalogRepository'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { emptyFilters, type Game, type ProductFilters, type SortKey } from '../types/catalog'
import '../styles/catalog-draft3.css'

const asset = (name: string) => assetPath(`assets/catalog-v2/${name}`)

function filtersFromParams(params: URLSearchParams): ProductFilters {
  const list = (key: string) => params.get(key)?.split(',').map((item) => item.trim()).filter(Boolean) ?? []
  return {
    ...initialCatalogFilters,
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    minSkin: params.get('minSkin') ?? '',
    maxSkin: params.get('maxSkin') ?? '',
    minHero: params.get('minHero') ?? '',
    ranks: list('ranks'),
    eliteLevels: list('eliteLevels'),
    platforms: list('platforms'),
  }
}

export function GameZonePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const initialQuery = params.get('q') ?? params.get('keyword') ?? ''
  const gameCode = params.get('gameCode') ?? 'wzry'
  const game = catalogRepository.getGame(gameCode)
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState<SortKey>('default')
  const [filters, setFilters] = useState<ProductFilters>(() => filtersFromParams(params))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSection, setDrawerSection] = useState<'hot' | 'skin' | 'rank' | 'platform' | 'price' | 'hero' | 'account' | 'other'>('hot')
  const [gamePickerOpen, setGamePickerOpen] = useState(false)
  const [gameOptions, setGameOptions] = useState<Game[]>([])
  const [quickPanel, setQuickPanel] = useState<'sort' | 'server' | 'price' | null>(null)
  const [toolbarSelection, setToolbarSelection] = useState<ToolbarSelection>('sort')
  const [serverDraft, setServerDraft] = useState<ServerOption>('all')
  const [priceDraft, setPriceDraft] = useState({ min: '', max: '', preset: null as string | null })
  const [showTop, setShowTop] = useState(false)
  const productsRef = useRef<HTMLElement>(null)
  const products = useMemo(() => catalogRepository.queryProducts(query, sort, filters, gameCode), [filters, gameCode, query, sort])
  const activeChips = useMemo(() => getActiveFilterChips(filters), [filters])
  const filterCount = getActiveFilterCount(filters)
  const displayedFilterCount = filterCount + Math.max(0, filters.skins.length - 1) + Math.max(0, filters.platforms.length - 1) + Math.max(0, filters.ranks.length - 1) + Math.max(0, filters.eliteLevels.length - 1) + Math.max(0, filters.realNames.length - 1)
  const priceRangeInvalid = hasInvalidPriceRange(priceDraft.min, priceDraft.max)
  const toolbarActive = getToolbarActiveState(toolbarSelection)
  const obscuredContentProps = quickPanel ? { inert: '', 'aria-hidden': true } : {}

  useEffect(() => {
    if (!quickPanel) return undefined
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setQuickPanel(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [quickPanel])

  useEffect(() => {
    void catalogRepository.getGames().then(setGameOptions)
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault(); setQuery(input)
    const next = new URLSearchParams(params); input ? next.set('q', input) : next.delete('q'); setParams(next, { replace: true })
  }
  const toggleQuickPanel = (panel: 'sort' | 'server' | 'price') => {
    setDrawerOpen(false)
    setToolbarSelection(panel)
    if (quickPanel === panel) { setQuickPanel(null); return }
    if (panel === 'server') setServerDraft(getServerOption(filters.platforms))
    if (panel === 'price') setPriceDraft({ min: filters.minPrice, max: filters.maxPrice, preset: getPricePreset(filters.minPrice, filters.maxPrice) })
    setQuickPanel(panel)
  }
  const changePrice = (key: 'min' | 'max', value: string) => {
    const next = { ...priceDraft, [key]: value.replace(/\D/g, '') }
    setPriceDraft({ ...next, preset: getPricePreset(next.min, next.max) })
  }
  const toggleRecommendation = (kind: 'rank' | 'hero' | 'skin' | 'negotiable') => setFilters((current) => {
    if (kind === 'rank') return { ...current, ranks: current.ranks.includes('荣耀王者') ? current.ranks.filter((value) => value !== '荣耀王者') : ['荣耀王者'] }
    if (kind === 'hero') return { ...current, minHero: current.minHero ? '' : '108' }
    if (kind === 'skin') return { ...current, minSkin: current.minSkin ? '' : '200', maxSkin: '' }
    return { ...current, negotiable: current.negotiable ? '' : 'true' }
  })
  const toggleGeneralRecommendation = (kind: 'budget' | 'qq' | 'negotiable' | 'latest') => {
    if (kind === 'latest') { setSort((current) => current === 'listed_at_desc' ? 'default' : 'listed_at_desc'); return }
    setFilters((current) => {
      if (kind === 'budget') return { ...current, maxPrice: current.maxPrice === '1000' ? '' : '1000' }
      if (kind === 'qq') return { ...current, platforms: current.platforms.length ? [] : ['安卓QQ', 'iOS QQ'] }
      return { ...current, negotiable: current.negotiable ? '' : 'true' }
    })
  }
  const editChip = (editor: 'server' | 'price' | 'drawer') => {
    if (editor === 'server' || editor === 'price') toggleQuickPanel(editor)
    else { setQuickPanel(null); setDrawerSection('skin'); setDrawerOpen(true) }
  }

  const chipLabel = (key: keyof ProductFilters, label: string) => key === 'skins' ? `皮肤：${label}` : label

  return (
    <main className="catalog-page catalog-d3">
      <header className="catalog-top">
        <div className="catalog-status" aria-hidden="true"><time>9:41</time><span><img src={asset('status-signal.svg')} alt="" /><img src={asset('status-wifi.svg')} alt="" /><img src={asset('status-battery.svg')} alt="" /></span></div>
        <form className="catalog-search" onSubmit={submit}><button type="button" aria-label={`切换游戏，当前${game.name}`} onClick={() => { setQuickPanel(null); setDrawerOpen(false); setGamePickerOpen(true) }}><img src={game.image || asset('game-switch.png')} alt="" /><span>切换</span></button><label><img src={asset('search.svg')} alt="" /><input aria-label={`搜索${game.name}商品`} value={input} onChange={(event) => setInput(event.target.value)} placeholder={game.code === 'wzry' ? '王者 倪克斯 镜 1500以内' : `搜${game.name}…`} /></label></form>
      </header>

      <section className="catalog-recommendations" aria-label="推荐筛选条件" {...obscuredContentProps}><div>{game.code === 'wzry' ? <>
        <button type="button" className="catalog-d3-find-skin" onClick={() => { setQuickPanel(null); setDrawerSection('skin'); setDrawerOpen(true) }}><span aria-hidden="true">♢</span>找皮肤</button>
        <button type="button" className={filters.ranks.includes('荣耀王者') ? 'selected' : ''} aria-pressed={filters.ranks.includes('荣耀王者')} onClick={() => toggleRecommendation('rank')}>荣耀王者</button>
        <button type="button" className={filters.minSkin === '200' ? 'selected' : ''} aria-pressed={filters.minSkin === '200'} onClick={() => toggleRecommendation('skin')}>200+皮肤</button>
        <button type="button" className={filters.negotiable === 'true' ? 'selected' : ''} aria-pressed={filters.negotiable === 'true'} onClick={() => toggleRecommendation('negotiable')}>支持议价</button>
      </> : <>
        <button type="button" className={filters.maxPrice === '1000' ? 'selected' : ''} aria-pressed={filters.maxPrice === '1000'} onClick={() => toggleGeneralRecommendation('budget')}>1000以内</button>
        <button type="button" className={filters.platforms.length > 0 ? 'selected' : ''} aria-pressed={filters.platforms.length > 0} onClick={() => toggleGeneralRecommendation('qq')}>QQ区</button>
        <button type="button" className={filters.negotiable === 'true' ? 'selected' : ''} aria-pressed={filters.negotiable === 'true'} onClick={() => toggleGeneralRecommendation('negotiable')}>支持议价</button>
        <button type="button" className={sort === 'listed_at_desc' ? 'selected' : ''} aria-pressed={sort === 'listed_at_desc'} onClick={() => toggleGeneralRecommendation('latest')}>最新上架</button>
      </>}</div></section>

      <section className="catalog-sort" role="toolbar" aria-label="商品排序和筛选">
        <button type="button" className={toolbarActive.sort ? 'active' : ''} aria-pressed={toolbarActive.sort} aria-haspopup="dialog" aria-expanded={quickPanel === 'sort'} aria-controls="sort-quick-filter" onClick={() => toggleQuickPanel('sort')}>排序<span className="catalog-sort-chevron" aria-hidden="true" /></button>
        <button type="button" className={toolbarActive.server ? 'active' : ''} aria-pressed={toolbarActive.server} aria-haspopup="dialog" aria-expanded={quickPanel === 'server'} aria-controls="server-quick-filter" onClick={() => toggleQuickPanel('server')}>游戏区服<span className="catalog-sort-chevron" aria-hidden="true" />{filters.platforms.length > 0 && <i className="catalog-filter-dot" aria-hidden="true" />}</button>
        <button type="button" className={toolbarActive.price ? 'active' : ''} aria-pressed={toolbarActive.price} aria-haspopup="dialog" aria-expanded={quickPanel === 'price'} aria-controls="price-quick-filter" onClick={() => toggleQuickPanel('price')}>价格<span className="catalog-sort-chevron" aria-hidden="true" />{Boolean(filters.minPrice || filters.maxPrice) && <i className="catalog-filter-dot" aria-hidden="true" />}</button>
        <button className={`catalog-filter-trigger ${displayedFilterCount > 0 ? 'active-filter' : ''}`} type="button" aria-pressed={displayedFilterCount > 0} aria-expanded={drawerOpen} aria-controls="filter-drawer" onClick={() => { setQuickPanel(null); setDrawerSection('hot'); setDrawerOpen(true) }}><img src={asset('filter.svg')} alt="" />筛选{displayedFilterCount > 0 && <b>{displayedFilterCount}</b>}</button>
      </section>

      {activeChips.length > 0 && <section className="catalog-selected" aria-label="已选筛选条件" {...obscuredContentProps}><div>{activeChips.map((chip) => <span className="catalog-filter-chip" key={String(chip.key)}><button type="button" onClick={() => editChip(chip.editor)}>{chipLabel(chip.key, chip.label)}</button><button type="button" aria-label={`删除${chip.label}`} onClick={() => setFilters((current) => removeActiveFilter(current, chip.key))}><img src={asset('remove-x.svg')} alt="" /></button></span>)}</div><button type="button" onClick={() => setFilters(emptyFilters)}>清空</button></section>}

      <section ref={productsRef} className="catalog-products" aria-label="商品列表" {...obscuredContentProps} onScroll={(event) => setShowTop(event.currentTarget.scrollTop > 500)}>{products.length ? products.map((product) => <ProductCard key={product.id} product={product} variant="catalogV2" to={`/goods/${product.id}`} />) : <EmptyState onReset={() => { setFilters(emptyFilters); setQuery(''); setInput('') }} />}</section>
      {showTop && !quickPanel && <button className="catalog-back-top" type="button" onClick={() => productsRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>顶部</button>}
      {!showTop && !quickPanel && !drawerOpen && !gamePickerOpen && <button className="catalog-d3-support" type="button" aria-label="联系客服" onClick={() => navigate(SUPPORT_CONVERSATION_ROUTE)}><img src={assetPath('assets/home-v2/customer-service.svg')} alt="" /></button>}

      {quickPanel && <div className="catalog-quick-layer"><button className="catalog-quick-mask" type="button" aria-label="关闭快捷筛选" onClick={() => setQuickPanel(null)} />{quickPanel === 'sort' ? <section id="sort-quick-filter" className="catalog-quick-panel" role="dialog" aria-label="商品排序"><h2>排序方式</h2><div className="sort-options">{sortOptions.map((option) => <button type="button" key={option.value} className={sort === option.value ? 'selected' : ''} aria-pressed={sort === option.value} onClick={() => { setSort(option.value); setToolbarSelection('sort'); setQuickPanel(null) }}>{option.label}</button>)}</div></section> : quickPanel === 'server' ? <section id="server-quick-filter" className="catalog-quick-panel" role="dialog" aria-label="游戏区服快捷筛选"><h2>游戏区服</h2><div className="server-options">{([['all', '全部'], ['qq', 'QQ'], ['wechat', '微信'], ['steam', 'Steam']] as const).map(([value, label]) => <button type="button" key={value} className={serverDraft === value ? 'selected' : ''} aria-pressed={serverDraft === value} onClick={() => setServerDraft(value)}>{label}</button>)}</div><footer><button type="button" onClick={() => setServerDraft('all')}>重置</button><button type="button" className="primary" onClick={() => { setFilters((current) => ({ ...current, platforms: [...serverPlatforms[serverDraft]] })); setQuickPanel(null) }}>确定</button></footer></section> : <section id="price-quick-filter" className="catalog-quick-panel" role="dialog" aria-label="价格快捷筛选"><h2>请输入价格区间</h2><div className="quick-price-range"><input inputMode="numeric" aria-label="最低价" aria-invalid={priceRangeInvalid} aria-describedby={priceRangeInvalid ? 'catalog-price-error' : undefined} placeholder="最低价" value={priceDraft.min} onChange={(event) => changePrice('min', event.target.value)} /><span>—</span><input inputMode="numeric" aria-label="最高价" aria-invalid={priceRangeInvalid} aria-describedby={priceRangeInvalid ? 'catalog-price-error' : undefined} placeholder="最高价" value={priceDraft.max} onChange={(event) => changePrice('max', event.target.value)} /></div>{priceRangeInvalid && <p id="catalog-price-error" className="quick-price-error" role="alert">最低价不能高于最高价</p>}<div className="price-presets">{pricePresets.map((preset) => <button type="button" key={preset.id} className={priceDraft.preset === preset.id ? 'selected' : ''} aria-pressed={priceDraft.preset === preset.id} onClick={() => setPriceDraft({ min: preset.min, max: preset.max, preset: preset.id })}><strong>{preset.min}–{preset.max}</strong><span>{preset.share}</span></button>)}</div><footer><button type="button" onClick={() => setPriceDraft({ min: '', max: '', preset: null })}>重置</button><button type="button" className="primary" disabled={priceRangeInvalid} onClick={() => { if (!priceRangeInvalid) { setFilters((current) => ({ ...current, minPrice: priceDraft.min, maxPrice: priceDraft.max })); setQuickPanel(null) } }}>确定</button></footer></section>}</div>}
      <FilterDrawer variant="catalogV2" open={drawerOpen} filters={filters} initialSection={drawerSection} gameName={game.name} resultCounter={(draft: ProductFilters) => catalogRepository.queryProducts(query, sort, draft, gameCode).length} onClose={() => setDrawerOpen(false)} onApply={(next) => { setFilters(next); setDrawerOpen(false) }} />
      {gamePickerOpen && <div className="catalog-d3-game-layer" role="dialog" aria-modal="true" aria-labelledby="catalog-game-title"><button className="catalog-d3-game-mask" type="button" aria-label="关闭切换游戏" onClick={() => setGamePickerOpen(false)} /><section className="catalog-d3-game-panel"><header><h2 id="catalog-game-title">切换游戏</h2><button type="button" aria-label="关闭" onClick={() => setGamePickerOpen(false)}>×</button></header><h3>游戏列表</h3><div>{gameOptions.concat(gameOptions.slice(0, 5)).map((option, index) => <button type="button" key={`${option.code}-${index}`} className={option.code === game.code ? 'selected' : ''} aria-pressed={option.code === game.code} onClick={() => { setGamePickerOpen(false); navigate(`/game?gameCode=${option.code}`) }}><img src={option.image} alt="" /><span>{option.name}</span></button>)}</div></section></div>}
      <div {...obscuredContentProps}><BottomNav variant="catalog" gameCode={game.code} gameName={game.name} /></div>
    </main>
  )
}
