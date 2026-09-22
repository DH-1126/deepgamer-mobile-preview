import { ChevronLeft, List, Search, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import { assetPath } from '../components/assetPath'
import { FilterDrawer } from '../components/FilterDrawer'
import { GuestLoginFloatingBar } from '../components/LoginFloatingBar'
import { getActiveFilterCount } from '../components/catalogFilterModel'
import { filtersFromSearchIntent, recognizeSearchIntent, relaxationLabel, type SearchCondition, type SearchIntent } from '../components/searchIntentModel'
import { allSearchConditionIds, nextSearchPriceSort } from '../components/searchResultsModel'
import { ProductCard } from '../components/ProductCard'
import { Button, Heading, RangeField, SearchField } from '../components/ui'
import { games as fixtureGames } from '../data/fixtures'
import { catalogRepository } from '../repository/catalogRepository'
import { emptyFilters, type Product, type ProductFilters, type SortKey } from '../types/catalog'
import { getRuntimeStorage, isLinkedDataMode } from '../runtime/dataMode'
import { LinkedSearchFilterDrawer } from '../linked/LinkedSearchFilterDrawer'
import { buildLinkedSearchRequest } from '../linked/linkedSearchModel'
import { toCatalogGame } from '../linked/linkedData'
import { useLinkedSearch } from '../linked/useLinkedSearch'
import '../styles/search-v2.css'
import '../styles/search-results-draft3.css'

const suggestedSearches = ['王者 108英雄', '和平精英 满级', '原神 五星6', 'QQ区 便宜号']
const searchRanking = ['王者 108英雄 千元内', '和平精英 满级 送皮肤', 'QQ区 便宜练手号', '原神 五星6 已验号']
const quickGames = [
  { code: 'wzry', count: '1,284 个在售' },
  { code: 'hpjy', count: '762 个在售' },
  { code: 'ys', count: '318 个在售' },
]
const homeGameAsset = (name: string) => assetPath(`assets/home-v2/${name}`)

type SearchView = 'idle' | 'loading' | 'results' | 'partial' | 'empty' | 'failure'
type ProductFilterOverrides = Partial<ProductFilters>

const productFilterKeys = Object.keys(emptyFilters) as (keyof ProductFilters)[]

function sameFilterValue(left: ProductFilters[keyof ProductFilters], right: ProductFilters[keyof ProductFilters]) {
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => value === right[index])
  return left === right
}

export function mergeFilterOverrides(base: ProductFilters, overrides: ProductFilterOverrides): ProductFilters {
  return { ...base, ...overrides }
}

export function filterOverridesFromApplied(applied: ProductFilters, searchFilters: ProductFilters): ProductFilterOverrides {
  return productFilterKeys.reduce<ProductFilterOverrides>((overrides, key) => {
    if (!sameFilterValue(applied[key], searchFilters[key])) Object.assign(overrides, { [key]: applied[key] })
    return overrides
  }, {})
}

function conditionMatchesProduct(intent: SearchIntent, condition: SearchCondition, product: Product) {
  const conditionIntent = { ...intent, conditions: [condition] }
  return catalogRepository.queryProducts('', 'default', filtersFromSearchIntent(conditionIntent), intent.gameCode).some((item) => item.id === product.id)
}

export function SearchResultProductCard({ product, satisfied = [], missing = [], showFit = false }: { product: Product; satisfied?: SearchCondition[]; missing?: SearchCondition[]; showFit?: boolean }) {
  return <div className="search-v2-result-item">
    <ProductCard product={product} variant="catalogV2" to={`/goods/${product.id}`} />
    {showFit && <span className="search-v2-fit"><small>✓ 满足 {satisfied.map((condition) => condition.label).join(' · ') || '游戏'}</small>{missing.length > 0 && <small>× 未满足 {missing.map((condition) => condition.value).join(' · ')}</small>}</span>}
  </div>
}

export function SearchPage() {
  return isLinkedDataMode ? <LinkedSearchPage /> : <StandaloneSearchPage />
}

export function LinkedSearchPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const gameCode = params.get('gameCode') ?? 'wzry'
  const initialQuery = params.get('q') ?? ''
  const [input, setInput] = useState(initialQuery)
  const [keyword, setKeyword] = useState(initialQuery)
  const [searched, setSearched] = useState(Boolean(initialQuery))
  const [filters, setFilters] = useState<ProductFilters>({ ...emptyFilters })
  const [sort, setSort] = useState<SortKey>('default')
  const [filterOpen, setFilterOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceDraft, setPriceDraft] = useState({ min: '', max: '' })
  const linkedSearch = useLinkedSearch(gameCode)
  const games = useMemo(() => (linkedSearch.state?.games ?? []).filter((game) => game.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder).map((game) => toCatalogGame(game, linkedSearch.state?.goods.filter((goods) => goods.gameCode === game.code && goods.auditStatus === 'APPROVED' && goods.productStatus === 'ON_SALE').length ?? 0)), [linkedSearch.state])
  const game = games.find((item) => item.code === gameCode) ?? catalogRepository.getGame(gameCode)
  const results = useMemo(() => searched && !linkedSearch.queryBlocked ? catalogRepository.queryProducts(keyword, sort, filters, gameCode, linkedSearch.request) : [], [filters, gameCode, keyword, linkedSearch.queryBlocked, linkedSearch.request, linkedSearch.state, searched, sort])
  const priceInvalid = Boolean(priceDraft.min && priceDraft.max && Number(priceDraft.min) > Number(priceDraft.max))

  const submitSearch = () => {
    const nextKeyword = input.trim()
    setInput(nextKeyword)
    setKeyword(nextKeyword)
    setSearched(true)
    const next = new URLSearchParams(params)
    next.set('gameCode', gameCode)
    nextKeyword ? next.set('q', nextKeyword) : next.delete('q')
    setParams(next, { replace: true })
  }
  const chooseGame = (code: string) => {
    const next = new URLSearchParams(params)
    next.set('gameCode', code)
    setParams(next)
    setFilterOpen(false)
  }

  return <main className="search-v2-page">
    <header className="search-v2-top">
      <DesignPromptTrigger nodeId="search:main" className="search-v2-status" />
      <form className="search-v2-bar" role="search" onSubmit={(event) => event.preventDefault()}>
        <button type="button" aria-label="返回" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <SearchField className="search-v2-search-field" value={input} onChange={(event) => setInput(event.target.value)} onClear={() => setInput('')} onSearch={submitSearch} clearLabel="清空搜索" placeholder={`搜${game.name}商品标题…`} aria-label={`搜索${game.name}商品`} />
      </form>
      {(linkedSearch.chips.length > 0 || filters.minPrice || filters.maxPrice) && <div className="search-v2-condition-strip" aria-label="已选搜索条件">
        {linkedSearch.chips.map((chip) => <button type="button" key={chip.fieldId} onClick={() => linkedSearch.removeValue(chip.fieldId)}><span>{chip.label}</span><strong>{chip.value}</strong><X size={11} aria-hidden="true" /></button>)}
        {(filters.minPrice || filters.maxPrice) && <button type="button" onClick={() => setFilters((current) => ({ ...current, minPrice: '', maxPrice: '' }))}><span>价格</span><strong>{filters.minPrice && filters.maxPrice ? `${filters.minPrice}–${filters.maxPrice}` : filters.minPrice ? `≥${filters.minPrice}` : `≤${filters.maxPrice}`}</strong><X size={11} aria-hidden="true" /></button>}
      </div>}
    </header>

    <div className="search-v2-scroll">
      <section className="search-v2-quick-games"><Heading as="h2" variant="section">选择搜索游戏</Heading><div>{games.map((item) => <button type="button" key={item.code} aria-pressed={item.code === gameCode} onClick={() => chooseGame(item.code)}><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{item.saleCount ?? 0} 个在售</small></span></button>)}</div></section>

      {linkedSearch.conflict && <article className="search-v2-preserved" role="alert"><strong>筛选配置已更新</strong><span>{linkedSearch.conflict}</span><Button size="sm" shape="pill" onClick={linkedSearch.applyLatest}>应用最新筛选</Button></article>}

      {searched && <section className="search-v2-results" aria-live="polite">
        <header className="search-v2-results-toolbar" aria-label="搜索结果排序和筛选">
          <button type="button" className={`dg-underline-tab${sort === 'default' ? ' active' : ''}`} aria-pressed={sort === 'default'} onClick={() => setSort('default')}>综合</button>
          <button type="button" className={`dg-underline-tab${sort === 'listed_at_desc' ? ' active' : ''}`} aria-pressed={sort === 'listed_at_desc'} onClick={() => setSort('listed_at_desc')}>最新</button>
          <button type="button" className={`dg-underline-tab${sort === 'price_asc' || sort === 'price_desc' ? ' active' : ''}`} aria-pressed={sort === 'price_asc' || sort === 'price_desc'} onClick={() => setSort(nextSearchPriceSort)}>价格 <span aria-hidden="true">{sort === 'price_desc' ? '↓' : '↑'}</span></button>
          <button type="button" onClick={() => { setPriceDraft({ min: filters.minPrice, max: filters.maxPrice }); setPriceOpen((open) => !open) }}>价格区间</button>
          <button type="button" className="search-v2-filter-trigger" aria-expanded={filterOpen} aria-controls="linked-search-filter-drawer" onClick={() => setFilterOpen(true)}><img src={assetPath('assets/filter-draft3/filter.svg')} alt="" />筛选{linkedSearch.chips.length > 0 && <b>{linkedSearch.chips.length}</b>}</button>
        </header>
        {priceOpen && <section className="search-v2-preserved" aria-label="价格区间"><RangeField label="价格" min={priceDraft.min} max={priceDraft.max} onChange={(min, max) => setPriceDraft({ min, max })} /><Button size="sm" shape="pill" disabled={priceInvalid} onClick={() => { setFilters((current) => ({ ...current, minPrice: priceDraft.min, maxPrice: priceDraft.max })); setPriceOpen(false) }}>应用价格</Button></section>}
        <div className="search-v2-result-meta"><button type="button" onClick={() => { linkedSearch.setValues({}); setFilters({ ...emptyFilters }) }}>清空</button><span>共 {results.length} 个</span></div>
        {results.length ? <><div className="search-v2-results-list">{results.map((product) => <SearchResultProductCard key={product.id} product={product} />)}</div><p className="search-v2-results-end">已显示 {results.length} / {results.length}</p></>
          : <section className="search-v2-no-match"><span className="search-v2-state-icon"><Search size={31} aria-hidden="true" /></span><Heading variant="result">没有匹配商品</Heading><p>{linkedSearch.conflict ? '当前动态条件已过期，请先应用最新筛选。' : '可调整关键词、价格或动态筛选条件。'}</p></section>}
      </section>}

      {!searched && <article className="search-v2-preserved"><strong>联动搜索</strong><span>输入普通关键词，或在结果页使用当前游戏已发布的 SEARCH 筛选。</span></article>}
    </div>

    <LinkedSearchFilterDrawer open={filterOpen} gameName={game.name} projection={linkedSearch.projection} currentProjection={linkedSearch.currentProjection} values={linkedSearch.values} conflict={linkedSearch.conflict} requestIssues={() => linkedSearch.issues} resultCounter={(draft) => {
      const built = buildLinkedSearchRequest(linkedSearch.projection, draft)
      return built.issues.length ? 0 : catalogRepository.queryProducts(keyword, sort, filters, gameCode, built.request).length
    }} onClose={() => setFilterOpen(false)} onApply={(next) => { linkedSearch.setValues(next); setFilterOpen(false) }} onApplyLatest={linkedSearch.applyLatest} />
  </main>
}

function StandaloneSearchPage() {
  const storage = getRuntimeStorage()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [recognizedQuery, setRecognizedQuery] = useState(initialQuery)
  const [history, setHistory] = useState<string[]>([])
  const [removedConditions, setRemovedConditions] = useState<Set<string>>(new Set())
  const [view, setView] = useState<SearchView>(initialQuery ? 'loading' : 'idle')
  const [resultGameCode, setResultGameCode] = useState(() => recognizeSearchIntent(initialQuery).gameCode)
  const [resultFilterOverrides, setResultFilterOverrides] = useState<ProductFilterOverrides>({})
  const [resultSort, setResultSort] = useState<SortKey>('default')
  const [filterOpen, setFilterOpen] = useState(false)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [games, setGames] = useState(fixtureGames)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<number>()

  useEffect(() => {
    try { setHistory(JSON.parse(storage.getItem('deep_search_history') ?? '[]')) } catch { setHistory([]) }
    const sync = () => { setCatalogRevision((value) => value + 1); void catalogRepository.getGames().then(setGames) }
    sync()
    return catalogRepository.subscribe(sync)
  }, [])

  useEffect(() => () => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
  }, [])

  const intent = useMemo(() => recognizeSearchIntent(recognizedQuery), [recognizedQuery])
  const activeConditions = useMemo(() => intent.conditions.filter((condition) => !removedConditions.has(condition.id)), [intent, removedConditions])
  const filters = useMemo(() => filtersFromSearchIntent(intent, removedConditions), [intent, removedConditions])
  const resultFilters = useMemo(() => mergeFilterOverrides(filters, resultFilterOverrides), [filters, resultFilterOverrides])
  const keywordOnly = activeConditions.length === 0 ? recognizedQuery : ''
  const matches = useMemo(() => recognizedQuery ? catalogRepository.queryProducts(keywordOnly, 'default', filters, intent.gameCode) : [], [catalogRevision, filters, intent.gameCode, keywordOnly, recognizedQuery])
  const allGameProducts = useMemo(() => catalogRepository.queryProducts('', 'default', filtersFromSearchIntent(intent, intent.conditions.map((condition) => condition.id)), intent.gameCode), [catalogRevision, intent])
  const comparableProducts = useMemo(() => {
    const priceCondition = intent.conditions.find((condition) => condition.kind === 'price')
    const excluded = priceCondition ? new Set([...removedConditions, priceCondition.id]) : removedConditions
    return catalogRepository.queryProducts('', 'default', filtersFromSearchIntent(intent, excluded), intent.gameCode)
  }, [catalogRevision, intent, removedConditions])
  const averagePrice = comparableProducts.length ? Math.round(comparableProducts.reduce((sum, product) => sum + product.price, 0) / comparableProducts.length / 100) * 100 : 0
  const resultKeyword = intent.conditions.length === 0 ? recognizedQuery : ''
  const resultProducts = useMemo(() => catalogRepository.queryProducts(resultKeyword, resultSort, resultFilters, resultGameCode), [catalogRevision, resultFilters, resultGameCode, resultKeyword, resultSort])
  const resultFilterCount = getActiveFilterCount(resultFilters)

  const remember = (value: string) => {
    const next = [value, ...history.filter((item) => item !== value)].slice(0, 10)
    setHistory(next)
    storage.setItem('deep_search_history', JSON.stringify(next))
  }

  const evaluateSearch = (keyword: string, exclusions: Set<string>) => {
    const currentIntent = recognizeSearchIntent(keyword)
    const currentFilters = mergeFilterOverrides(filtersFromSearchIntent(currentIntent, exclusions), resultFilterOverrides)
    const currentActive = currentIntent.conditions.filter((condition) => !exclusions.has(condition.id))
    const currentGameCode = keyword ? currentIntent.gameCode : resultGameCode
    const result = catalogRepository.queryProducts(currentActive.length ? '' : keyword, resultSort, currentFilters, currentGameCode)
    if (!window.navigator.onLine) {
      setView('failure')
      return
    }
    if (result.length) {
      setResultGameCode(currentGameCode)
      setView('results')
      return
    }
    const hasRelaxedResult = currentActive.some((condition) => {
      if (condition.kind === 'game') return false
      const excluded = new Set([...exclusions, condition.id])
      return catalogRepository.queryProducts('', resultSort, mergeFilterOverrides(filtersFromSearchIntent(currentIntent, excluded), resultFilterOverrides), currentGameCode).length > 0
    })
    setResultGameCode(currentGameCode)
    setView(hasRelaxedResult ? 'partial' : 'empty')
  }

  useEffect(() => {
    if (!initialQuery) return
    const exclusions = new Set<string>()
    searchTimerRef.current = window.setTimeout(() => evaluateSearch(initialQuery.trim(), exclusions), 0)
  }, [])

  const commitSearch = (value = query) => {
    const keyword = value.trim()
    setQuery(keyword)
    if (keyword) remember(keyword)
    setRecognizedQuery(keyword)
    setRemovedConditions(new Set())
    setView('loading')
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    const exclusions = new Set<string>()
    searchTimerRef.current = window.setTimeout(() => evaluateSearch(keyword, exclusions), 520)
  }

  const useSearch = (value: string) => {
    commitSearch(value)
  }

  const removeHistory = (value: string) => {
    const next = history.filter((item) => item !== value)
    setHistory(next)
    storage.setItem('deep_search_history', JSON.stringify(next))
  }

  const removeCondition = (id: string) => {
    const nextRemoved = new Set([...removedConditions, id])
    setRemovedConditions(nextRemoved)
    if (view !== 'results') setView('idle')
  }

  const relaxationSuggestions = activeConditions.filter((condition) => condition.kind !== 'game').map((condition) => {
    const excluded = new Set([...removedConditions, condition.id])
    const relaxedFilters = filtersFromSearchIntent(intent, excluded)
    const relaxedMatches = catalogRepository.queryProducts('', 'default', relaxedFilters, intent.gameCode)
    const nearestPrice = condition.kind === 'price' ? relaxedMatches.map((product) => product.price).sort((a, b) => a - b)[0] : undefined
    return { condition, count: relaxedMatches.length, nearestPrice, products: relaxedMatches }
  }).filter((suggestion) => suggestion.count > matches.length)

  const closestProducts = useMemo(() => {
    const seen = new Set<string>()
    return relaxationSuggestions.flatMap((suggestion) => suggestion.products).filter((product) => {
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    }).slice(0, 2)
  }, [relaxationSuggestions])

  const applyRelaxation = (condition: SearchCondition) => {
    const nextRemoved = new Set([...removedConditions, condition.id])
    const relaxedFilters = filtersFromSearchIntent(intent, nextRemoved)
    const relaxed = catalogRepository.queryProducts('', 'default', relaxedFilters, intent.gameCode)
    setRemovedConditions(nextRemoved)
    if (relaxed.length) {
      setView('results')
    }
  }

  const clearQuery = () => {
    setQuery('')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const showConditionStrip = (view === 'loading' || view === 'results' || view === 'partial' || view === 'failure') && activeConditions.length > 0
  const loginParams = new URLSearchParams(params)
  if (recognizedQuery) loginParams.set('q', recognizedQuery)
  else loginParams.delete('q')
  const loginReturnTo = '/search' + (loginParams.size ? `?${loginParams}` : '')

  return (
    <main className="search-v2-page">
      <header className="search-v2-top">
        <DesignPromptTrigger nodeId="search:main" className="search-v2-status" />
        <form className="search-v2-bar" role="search" onSubmit={(event) => event.preventDefault()}>
          <button type="button" aria-label="返回" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
          <SearchField ref={inputRef} className="search-v2-search-field" value={query} onChange={(event) => setQuery(event.target.value)} onClear={clearQuery} onSearch={() => commitSearch()} clearLabel="清空搜索" placeholder="说出你要的号，例：王者 108英雄 500-1500" aria-label="说出你要的号" />
        </form>
        {showConditionStrip && <div className="search-v2-condition-strip" aria-label="已识别的搜索条件">
          {activeConditions.slice(0, 4).map((condition) => <button type="button" key={condition.id} onClick={() => removeCondition(condition.id)}><span>{condition.kind === 'game' ? condition.value : condition.label}</span>{condition.kind !== 'game' && <strong>{condition.value}</strong>}<X size={11} aria-hidden="true" /></button>)}
        </div>}
      </header>

      <div className="search-v2-scroll">
        {view === 'loading' ? <SearchLoading /> : view === 'results' ? <section className="search-v2-results" aria-live="polite">
          <header className="search-v2-results-toolbar" aria-label="搜索结果排序和筛选">
            <button type="button" className={`dg-underline-tab${resultSort === 'default' ? ' active' : ''}`} aria-pressed={resultSort === 'default'} onClick={() => setResultSort('default')}>综合</button>
            <button type="button" className={`dg-underline-tab${resultSort === 'listed_at_desc' ? ' active' : ''}`} aria-pressed={resultSort === 'listed_at_desc'} onClick={() => setResultSort('listed_at_desc')}>最新</button>
            <button type="button" className={`dg-underline-tab${resultSort === 'price_asc' || resultSort === 'price_desc' ? ' active' : ''}`} aria-pressed={resultSort === 'price_asc' || resultSort === 'price_desc'} onClick={() => setResultSort(nextSearchPriceSort)}>价格 <span aria-hidden="true">{resultSort === 'price_desc' ? '↓' : '↑'}</span></button>
            <Button variant="ghost" size="md" className="search-v2-filter-trigger" aria-expanded={filterOpen} aria-controls="filter-drawer" onClick={() => setFilterOpen(true)} icon={<img src={assetPath('assets/filter-draft3/filter.svg')} alt="" />}>筛选{resultFilterCount > 0 && <b>{resultFilterCount}</b>}</Button>
          </header>
          <div className="search-v2-result-meta"><button type="button" onClick={() => { setRemovedConditions(allSearchConditionIds(intent)); setResultFilterOverrides({}) }}>清空</button><span>共 {resultProducts.length} 个</span></div>
          <div className="search-v2-results-list">{resultProducts.map((product) => <SearchResultProductCard key={product.id} product={product} />)}</div>
          <p className="search-v2-results-end">已显示 {resultProducts.length} / {resultProducts.length} · 上滑加载更多</p>
        </section> : view === 'failure' ? <section className="search-v2-failure" aria-live="polite">
          <span className="search-v2-state-icon"><WifiOff size={31} aria-hidden="true" /></span>
          <Heading variant="result">网络不稳定，未能获取结果</Heading>
          <p>你的搜索词与已识别条件已保留，恢复网络后可直接重试。</p>
          <button type="button" className="search-v2-retry" onClick={() => commitSearch()}>重试</button>
          <button type="button" className="search-v2-network-settings" onClick={() => window.location.reload()}>检查网络设置</button>
          <article className="search-v2-preserved"><strong>保留的搜索条件</strong><span>{activeConditions.map((condition) => condition.kind === 'game' ? condition.value : `${condition.label}${condition.value}`).join(' · ')}</span></article>
        </section> : view === 'partial' ? <section className="search-v2-partial" aria-live="polite">
          <article className="search-v2-partial-summary">
            <Heading variant="result">没有完全匹配，先看最接近的 {closestProducts.length || allGameProducts.length} 个↑</Heading>
            <p>{activeConditions.length} 个条件未完全满足。下面结果按满足度排序。</p>
            <div>{relaxationSuggestions.slice(0, 2).map(({ condition, nearestPrice }) => <button type="button" key={condition.id} onClick={() => applyRelaxation(condition)}>{relaxationLabel(condition, nearestPrice)}</button>)}</div>
          </article>
          <header className="search-v2-partial-sort"><strong>按满足度</strong><span>最新</span><span>价格 ↕</span><b>筛选 <i>{activeConditions.length}</i></b></header>
          <div className="search-v2-nearby-list">{(closestProducts.length ? closestProducts : allGameProducts.slice(0, 2)).map((product) => {
            const satisfied = activeConditions.filter((condition) => condition.kind !== 'game' && conditionMatchesProduct(intent, condition, product))
            const missing = activeConditions.filter((condition) => condition.kind !== 'game' && !conditionMatchesProduct(intent, condition, product))
            return <SearchResultProductCard key={product.id} product={product} satisfied={satisfied} missing={missing} showFit />
          })}</div>
        </section> : view === 'empty' ? <section className="search-v2-no-match" aria-live="polite">
          <span className="search-v2-state-icon"><Search size={31} aria-hidden="true" /></span>
          <Heading variant="result">没有完全匹配的号</Heading>
          {activeConditions.length ? <><p>「{activeConditions.filter((condition) => condition.kind !== 'game').map((condition) => condition.value).join(' + ') || intent.gameName}」近 30 天成交均价 <strong>¥{averagePrice.toLocaleString('zh-CN')}</strong></p>{filters.maxPrice && averagePrice > Number(filters.maxPrice) && <small>高于你设定的预算 ¥{Number(filters.maxPrice).toLocaleString('zh-CN')}</small>}</> : <p>没有找到“{recognizedQuery}”相关商品，换个关键词试试。</p>}
          <article className="search-v2-relax-card">
            <Heading as="h2" variant="section">{relaxationSuggestions.length ? '放宽一个条件就有结果' : '换个条件继续看看'}</Heading>
            {relaxationSuggestions.map(({ condition, count, nearestPrice }) => <button type="button" key={condition.id} onClick={() => applyRelaxation(condition)}><span>{relaxationLabel(condition, nearestPrice)}</span><strong>{count}个 ↑</strong></button>)}
            <button type="button" className="muted" onClick={() => navigate(`/game?gameCode=${intent.gameCode}`)}><span>清空全部条件</span><b>{allGameProducts.length.toLocaleString('zh-CN')}个 ↑</b></button>
          </article>
        </section> : <>
          {recognizedQuery && activeConditions.length > 0 ? <section className="search-v2-recognition" aria-live="polite">
          <Heading as="h1" variant="group"><span aria-hidden="true">✓</span>已识别 {activeConditions.length} 个条件，点任一条可改</Heading>
            <div>{activeConditions.map((condition) => <article key={condition.id}><button type="button" aria-label={`移除${condition.label}${condition.value}`} onClick={() => removeCondition(condition.id)}><span>{condition.label}</span><strong>{condition.value}</strong><X size={13} /></button></article>)}</div>
            <button type="button" className="search-v2-confirm" onClick={() => commitSearch()}>查看结果</button>
          </section> : !recognizedQuery && <DefaultSearchContent navigate={navigate} games={games} history={history} removeHistory={removeHistory} clearHistory={() => { setHistory([]); storage.removeItem('deep_search_history') }} useSearch={useSearch} />}

          {recognizedQuery && <>
            <section className="search-v2-common"><Heading as="h2" variant="section">大家在搜</Heading><div>{suggestedSearches.map((item) => <button type="button" key={item} onClick={() => useSearch(item)}>{item}</button>)}</div></section>
            {history.length > 0 && <section className="search-v2-history">
              <header><Heading as="h2" variant="section">搜索历史</Heading><button type="button" onClick={() => { setHistory([]); storage.removeItem('deep_search_history') }}>清空</button></header>
              <div>{history.map((item) => <div className="search-v2-history-row" key={item}><button type="button" onClick={() => useSearch(item)}><span>{item}</span></button><button type="button" aria-label={`删除搜索记录${item}`} onClick={() => removeHistory(item)}><X size={15} /></button></div>)}</div>
            </section>}
          </>}
        </>}
      </div>
      <GuestLoginFloatingBar returnTo={loginReturnTo} />
      <FilterDrawer variant="catalogV2" open={filterOpen} filters={resultFilters} gameName={games.find((game) => game.code === resultGameCode)?.name ?? intent.gameName} resultCounter={(draft) => catalogRepository.queryProducts(resultKeyword, resultSort, draft, resultGameCode).length} onClose={() => setFilterOpen(false)} onApply={(next) => { setResultFilterOverrides(filterOverridesFromApplied(next, filters)); setFilterOpen(false) }} />
    </main>
  )
}

function DefaultSearchContent({ navigate, games, history, removeHistory, clearHistory, useSearch }: { navigate: ReturnType<typeof useNavigate>; games: typeof fixtureGames; history: string[]; removeHistory: (value: string) => void; clearHistory: () => void; useSearch: (value: string) => void }) {
  const displayedQuickGames = isLinkedDataMode ? games.slice(0, 3).map((game) => ({ code: game.code, count: `${game.saleCount ?? 0} 个在售` })) : quickGames
  return <div className="search-v2-default">
    <section className="search-v2-quick-games"><Heading as="h2" variant="section">选游戏直接开始</Heading><div>
      {displayedQuickGames.map((entry) => {
        const game = games.find((item) => item.code === entry.code)
        if (!game) return null
        const image = isLinkedDataMode ? game.image : entry.code === 'wzry' ? homeGameAsset('game-wzry.png') : entry.code === 'hpjy' ? homeGameAsset('game-hpjy.png') : homeGameAsset('game-genshin.png')
        return <button type="button" key={entry.code} onClick={() => navigate(`/game?gameCode=${entry.code}`)}><img src={image} alt="" /><span><strong>{game.name}</strong><small>{entry.count}</small></span></button>
      })}
      <button type="button" onClick={() => navigate('/game/select?current=wzry')}><i><List size={18} aria-hidden="true" /></i><span><strong>全部游戏</strong><small>按分类浏览</small></span></button>
    </div></section>
    {history.length > 0 && <section className="search-v2-recent"><header><Heading as="h2" variant="section">最近搜索</Heading><button type="button" onClick={clearHistory}>清空</button></header><div>{history.slice(0, 4).map((item) => <span key={item}><button type="button" onClick={() => useSearch(item)}>{item}</button><button type="button" aria-label={`删除搜索记录${item}`} onClick={() => removeHistory(item)}><X size={11} /></button></span>)}</div></section>}
    <section className="search-v2-ranking"><Heading as="h2" variant="section">大家在搜</Heading><div>{searchRanking.map((item, index) => <button type="button" key={item} onClick={() => useSearch(item)}><b>{index + 1}</b><span>{item}</span>{index === 0 && <em>HOT</em>}</button>)}</div></section>
  </div>
}

function SearchLoading() {
  return <section className="search-v2-loading" aria-live="polite"><p><i aria-hidden="true" />正在匹配符合条件的账号…</p>{[0, 1, 2, 3].map((item) => <article key={item}><i /><span><b /><b /><b /><em><small /><small /><small /></em><b /></span></article>)}</section>
}
