import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { CatalogQuickFilters, type CatalogQuickFilterPanel } from '../components/CatalogQuickFilters'
import { buildGameSelectRoute } from '../components/gameSelectionModel'
import { useAuthStatus } from '../components/AuthAccess'
import { assetPath } from '../components/assetPath'
import { getActiveFilterChips, getActiveFilterCount, initialCatalogFilters, removeActiveFilter } from '../components/catalogFilterModel'
import { EmptyState } from '../components/EmptyState'
import { FilterDrawer, type FilterSectionKey } from '../components/FilterDrawer'
import { getAdvancedFilterSectionForField } from '../components/advancedFilterModel'
import { ProductCard } from '../components/ProductCard'
import { FilterTrigger, Heading, SearchField } from '../components/ui'
import { catalogRepository } from '../repository/catalogRepository'
import { SUPPORT_RECOMMENDATION_ROUTE } from '../data/messageFixtures'
import { LinkedSearchFilterDrawer } from '../linked/LinkedSearchFilterDrawer'
import { buildLinkedSearchRequest } from '../linked/linkedSearchModel'
import { useLinkedSearch } from '../linked/useLinkedSearch'
import { isLinkedDataMode } from '../runtime/dataMode'
import { emptyFilters, type ProductFilters, type SortKey } from '../types/catalog'
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
  const authenticated = useAuthStatus()
  const [params, setParams] = useSearchParams()
  const initialQuery = params.get('q') ?? params.get('keyword') ?? ''
  const gameCode = params.get('gameCode') ?? 'wzry'
  const game = catalogRepository.getGame(gameCode)
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState<SortKey>('default')
  const [filters, setFilters] = useState<ProductFilters>(() => isLinkedDataMode
    ? { ...emptyFilters, minPrice: params.get('minPrice') ?? '', maxPrice: params.get('maxPrice') ?? '' }
    : filtersFromParams(params))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSection, setDrawerSection] = useState<FilterSectionKey>('skinCount')
  const [quickPanel, setQuickPanel] = useState<CatalogQuickFilterPanel | null>(null)
  const [toolbarSelection, setToolbarSelection] = useState<CatalogQuickFilterPanel>('sort')
  const [showTop, setShowTop] = useState(false)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const linkedSearch = useLinkedSearch(gameCode, isLinkedDataMode)
  const productsRef = useRef<HTMLElement>(null)
  const toolbarRef = useRef<HTMLElement>(null)
  const quickReturnFocusRef = useRef<HTMLElement | null>(null)
  const products = useMemo(() => linkedSearch.queryBlocked ? [] : catalogRepository.queryProducts(query, sort, filters, gameCode, linkedSearch.request), [catalogRevision, filters, gameCode, linkedSearch.queryBlocked, linkedSearch.request, query, sort])
  const activeChips = useMemo(() => isLinkedDataMode ? [] : getActiveFilterChips(filters), [filters])
  const filterCount = isLinkedDataMode ? linkedSearch.chips.length : getActiveFilterCount(filters)
  const displayedFilterCount = filterCount + Math.max(0, filters.platforms.length - 1) + Math.max(0, filters.ranks.length - 1) + Math.max(0, filters.eliteLevels.length - 1) + Math.max(0, filters.realNames.length - 1)
  const obscuredContentProps = quickPanel ? { inert: '', 'aria-hidden': true } : {}

  useEffect(() => {
    const sync = () => { setCatalogRevision((value) => value + 1) }
    sync()
    return catalogRepository.subscribe(sync)
  }, [])

  const submitSearch = () => {
    const keyword = input.trim()
    setInput(keyword)
    setQuery(keyword)
    const next = new URLSearchParams(params); keyword ? next.set('q', keyword) : next.delete('q'); setParams(next, { replace: true })
  }
  const closeQuickPanel = useCallback(() => {
    setQuickPanel(null)
    setToolbarSelection('sort')
    window.requestAnimationFrame(() => quickReturnFocusRef.current?.focus({ preventScroll: true }))
  }, [])
  const toggleQuickPanel = (panel: CatalogQuickFilterPanel) => {
    setDrawerOpen(false)
    if (quickPanel === panel) { closeQuickPanel(); return }
    quickReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setToolbarSelection(panel)
    setQuickPanel(panel)
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
  const editChip = (editor: 'server' | 'price' | 'drawer', key: keyof ProductFilters) => {
    if (editor === 'server' || editor === 'price') toggleQuickPanel(editor)
    else { setQuickPanel(null); setToolbarSelection('sort'); setDrawerSection(getAdvancedFilterSectionForField(key)); setDrawerOpen(true) }
  }

  return (
    <main className="catalog-page catalog-d3">
      <header className="catalog-top">
        <div className="catalog-status" aria-hidden="true"><time>9:41</time><span><img src={asset('status-signal.svg')} alt="" /><img src={asset('status-wifi.svg')} alt="" /><img src={asset('status-battery.svg')} alt="" /></span></div>
        <form className="catalog-search" role="search" onSubmit={(event) => event.preventDefault()}><button type="button" aria-label={`切换游戏，当前${game.name}`} onClick={() => { setQuickPanel(null); setToolbarSelection('sort'); setDrawerOpen(false); navigate(buildGameSelectRoute({ scene: 'buy', current: game.code })) }}><img src={game.image || asset('game-switch.png')} alt="" /><span>切换</span></button><SearchField className="catalog-search-field" aria-label={`搜索${game.name}商品`} value={input} onChange={(event) => setInput(event.target.value)} onClear={() => setInput('')} onSearch={submitSearch} clearLabel="清空搜索" placeholder={isLinkedDataMode ? `搜${game.name}商品标题…` : game.code === 'wzry' ? '王者 倪克斯 镜 1500以内' : `搜${game.name}…`} /></form>
      </header>

      {!isLinkedDataMode && <section className="catalog-recommendations" aria-label="推荐筛选条件" {...obscuredContentProps}><div>{game.code === 'wzry' ? <>
        <button type="button" className={filters.ranks.includes('荣耀王者') ? 'selected' : ''} aria-pressed={filters.ranks.includes('荣耀王者')} onClick={() => toggleRecommendation('rank')}>荣耀王者</button>
        <button type="button" className={filters.minSkin === '200' ? 'selected' : ''} aria-pressed={filters.minSkin === '200'} onClick={() => toggleRecommendation('skin')}>200+皮肤</button>
        <button type="button" className={filters.negotiable === 'true' ? 'selected' : ''} aria-pressed={filters.negotiable === 'true'} onClick={() => toggleRecommendation('negotiable')}>支持议价</button>
      </> : <>
        <button type="button" className={filters.maxPrice === '1000' ? 'selected' : ''} aria-pressed={filters.maxPrice === '1000'} onClick={() => toggleGeneralRecommendation('budget')}>1000以内</button>
        <button type="button" className={filters.platforms.length > 0 ? 'selected' : ''} aria-pressed={filters.platforms.length > 0} onClick={() => toggleGeneralRecommendation('qq')}>QQ区</button>
        <button type="button" className={filters.negotiable === 'true' ? 'selected' : ''} aria-pressed={filters.negotiable === 'true'} onClick={() => toggleGeneralRecommendation('negotiable')}>支持议价</button>
        <button type="button" className={sort === 'listed_at_desc' ? 'selected' : ''} aria-pressed={sort === 'listed_at_desc'} onClick={() => toggleGeneralRecommendation('latest')}>最新上架</button>
      </>}</div></section>}

      <section ref={toolbarRef} className={`catalog-sort ${isLinkedDataMode ? 'catalog-sort--linked' : ''}`} role="toolbar" aria-label="商品排序和筛选">
        <FilterTrigger active={toolbarSelection === 'sort'} aria-pressed={toolbarSelection === 'sort'} aria-haspopup="dialog" expanded={quickPanel === 'sort'} aria-controls="sort-quick-filter" onClick={() => toggleQuickPanel('sort')}>排序</FilterTrigger>
        {!isLinkedDataMode && <FilterTrigger active={toolbarSelection === 'server'} aria-pressed={toolbarSelection === 'server'} aria-haspopup="dialog" expanded={quickPanel === 'server'} aria-controls="server-quick-filter" onClick={() => toggleQuickPanel('server')}>游戏区服{filters.platforms.length > 0 && <i className="catalog-filter-dot" aria-hidden="true" />}</FilterTrigger>}
        <FilterTrigger active={toolbarSelection === 'price'} aria-pressed={toolbarSelection === 'price'} aria-haspopup="dialog" expanded={quickPanel === 'price'} aria-controls="price-quick-filter" onClick={() => toggleQuickPanel('price')}>价格{Boolean(filters.minPrice || filters.maxPrice) && <i className="catalog-filter-dot" aria-hidden="true" />}</FilterTrigger>
        <button className={`catalog-filter-trigger ${displayedFilterCount > 0 ? 'active-filter' : ''}`} type="button" aria-pressed={displayedFilterCount > 0} aria-haspopup="dialog" aria-expanded={drawerOpen} aria-controls={isLinkedDataMode ? 'linked-search-filter-drawer' : 'filter-drawer'} onClick={() => { setQuickPanel(null); setToolbarSelection('sort'); setDrawerSection('skinCount'); setDrawerOpen(true) }}><img src={asset('filter.svg')} alt="" />筛选{displayedFilterCount > 0 && <b>{displayedFilterCount}</b>}</button>
      </section>

      {activeChips.length > 0 && <section className="catalog-selected" aria-label="已选筛选条件" {...obscuredContentProps}><div>{activeChips.map((chip) => <span className="catalog-filter-chip" key={String(chip.key)}><button type="button" onClick={() => editChip(chip.editor, chip.key)}>{chip.label}</button><button type="button" aria-label={`删除${chip.label}`} onClick={() => setFilters((current) => removeActiveFilter(current, chip.key))}><img src={asset('remove-x.svg')} alt="" /></button></span>)}</div><button type="button" onClick={() => setFilters(emptyFilters)}>清空</button></section>}
      {isLinkedDataMode && linkedSearch.chips.length > 0 && <section className="catalog-selected" aria-label="已选动态筛选条件" {...obscuredContentProps}><div>{linkedSearch.chips.map((chip) => <span className="catalog-filter-chip" key={chip.fieldId}><button type="button" onClick={() => setDrawerOpen(true)}>{chip.label}：{chip.value}</button><button type="button" aria-label={`删除${chip.label}${chip.value}`} onClick={() => linkedSearch.removeValue(chip.fieldId)}><img src={asset('remove-x.svg')} alt="" /></button></span>)}</div><button type="button" onClick={() => linkedSearch.setValues({})}>清空</button></section>}
      {isLinkedDataMode && linkedSearch.conflict && <section className="catalog-selected" role="alert" aria-label="筛选配置更新提示"><div><span className="catalog-filter-chip"><button type="button" onClick={() => setDrawerOpen(true)}>筛选配置已更新，当前条件已停止匹配</button></span></div><button type="button" onClick={linkedSearch.applyLatest}>应用最新筛选</button></section>}

      <section ref={productsRef} className="catalog-products" aria-label="商品列表" {...obscuredContentProps} onScroll={(event) => setShowTop(event.currentTarget.scrollTop > 500)}>{products.length ? products.map((product) => <ProductCard key={product.id} product={product} variant="catalogV2" to={`/goods/${product.id}`} />) : <EmptyState onReset={() => { setFilters(emptyFilters); if (isLinkedDataMode) linkedSearch.setValues({}); setQuery(''); setInput('') }} />}</section>
      {showTop && !quickPanel && <button className="catalog-back-top" type="button" onClick={() => productsRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>顶部</button>}
      {authenticated && !showTop && !quickPanel && !drawerOpen && <button className="catalog-d3-support" type="button" aria-label="联系客服" onClick={() => navigate(SUPPORT_RECOMMENDATION_ROUTE)}><img src={assetPath('assets/home-v2/customer-service.svg')} alt="" /></button>}

      {quickPanel && <CatalogQuickFilters key={quickPanel} panel={quickPanel} anchorRef={toolbarRef} sort={sort} platforms={filters.platforms} minPrice={filters.minPrice} maxPrice={filters.maxPrice} linkedMode={isLinkedDataMode} onClose={closeQuickPanel} onApplySort={(next) => { setSort(next); closeQuickPanel() }} onApplyServer={(next) => { setFilters((current) => ({ ...current, platforms: next })); closeQuickPanel() }} onApplyPrice={(min, max) => { setFilters((current) => ({ ...current, minPrice: min, maxPrice: max })); closeQuickPanel() }} />}
      {isLinkedDataMode ? <LinkedSearchFilterDrawer open={drawerOpen} gameName={game.name} projection={linkedSearch.projection} currentProjection={linkedSearch.currentProjection} values={linkedSearch.values} conflict={linkedSearch.conflict} requestIssues={() => linkedSearch.issues} resultCounter={(draft) => {
        const built = buildLinkedSearchRequest(linkedSearch.projection, draft)
        return built.issues.length ? 0 : catalogRepository.queryProducts(query, sort, filters, gameCode, built.request).length
      }} onClose={() => setDrawerOpen(false)} onApply={(next) => { linkedSearch.setValues(next); setDrawerOpen(false) }} onApplyLatest={linkedSearch.applyLatest} />
        : <FilterDrawer variant="catalogV2" open={drawerOpen} filters={filters} initialSection={drawerSection} gameName={game.name} resultCounter={(draft: ProductFilters) => catalogRepository.queryProducts(query, sort, draft, gameCode).length} onClose={() => setDrawerOpen(false)} onApply={(next) => { setFilters(next); setDrawerOpen(false) }} />}
      <div {...obscuredContentProps}><BottomNav variant="catalog" gameCode={game.code} gameName={game.name} /></div>
    </main>
  )
}
