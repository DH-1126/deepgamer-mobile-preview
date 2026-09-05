import { ChevronLeft, List, Search, WifiOff, X } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { catalogUrlFromSearchIntent, filtersFromSearchIntent, recognizeSearchIntent, relaxationLabel, type SearchCondition, type SearchIntent } from '../components/searchIntentModel'
import { games } from '../data/fixtures'
import { catalogRepository } from '../repository/catalogRepository'
import type { Product } from '../types/catalog'
import '../styles/search-v2.css'

const suggestedSearches = ['王者 108英雄', '和平精英 满级', '原神 五星6', 'QQ区 便宜号']
const searchRanking = ['王者 108英雄 千元内', '和平精英 满级 送皮肤', 'QQ区 便宜练手号', '原神 五星6 已验号']
const quickGames = [
  { code: 'wzry', count: '1,284 个在售' },
  { code: 'hpjy', count: '762 个在售' },
  { code: 'ys', count: '318 个在售' },
]
const statusAsset = (name: string) => assetPath(`assets/catalog-v2/${name}`)
const homeGameAsset = (name: string) => assetPath(`assets/home-v2/${name}`)

type SearchView = 'idle' | 'loading' | 'partial' | 'empty' | 'failure'

function SearchStatusBar() {
  return <div className="search-v2-status" aria-hidden="true"><time>9:41</time><span><img src={statusAsset('status-signal.svg')} alt="" /><img src={statusAsset('status-wifi.svg')} alt="" /><img src={statusAsset('status-battery.svg')} alt="" /></span></div>
}

function conditionMatchesProduct(intent: SearchIntent, condition: SearchCondition, product: Product) {
  const conditionIntent = { ...intent, conditions: [condition] }
  return catalogRepository.queryProducts('', 'default', filtersFromSearchIntent(conditionIntent), intent.gameCode).some((item) => item.id === product.id)
}

export function SearchPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [recognizedQuery, setRecognizedQuery] = useState(initialQuery)
  const [history, setHistory] = useState<string[]>([])
  const [removedConditions, setRemovedConditions] = useState<Set<string>>(new Set())
  const [view, setView] = useState<SearchView>('idle')
  const [editing, setEditing] = useState(Boolean(initialQuery))
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<number>()

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('deep_search_history') ?? '[]')) } catch { setHistory([]) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecognizedQuery(query.trim())
      setRemovedConditions(new Set())
      setView('idle')
    }, 260)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => () => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
  }, [])

  const intent = useMemo(() => recognizeSearchIntent(recognizedQuery), [recognizedQuery])
  const activeConditions = useMemo(() => intent.conditions.filter((condition) => !removedConditions.has(condition.id)), [intent, removedConditions])
  const filters = useMemo(() => filtersFromSearchIntent(intent, removedConditions), [intent, removedConditions])
  const keywordOnly = activeConditions.length === 0 ? recognizedQuery : ''
  const matches = useMemo(() => recognizedQuery ? catalogRepository.queryProducts(keywordOnly, 'default', filters, intent.gameCode) : [], [filters, intent.gameCode, keywordOnly, recognizedQuery])
  const allGameProducts = useMemo(() => catalogRepository.queryProducts('', 'default', filtersFromSearchIntent(intent, intent.conditions.map((condition) => condition.id)), intent.gameCode), [intent])
  const comparableProducts = useMemo(() => {
    const priceCondition = intent.conditions.find((condition) => condition.kind === 'price')
    const excluded = priceCondition ? new Set([...removedConditions, priceCondition.id]) : removedConditions
    return catalogRepository.queryProducts('', 'default', filtersFromSearchIntent(intent, excluded), intent.gameCode)
  }, [intent, removedConditions])
  const averagePrice = comparableProducts.length ? Math.round(comparableProducts.reduce((sum, product) => sum + product.price, 0) / comparableProducts.length / 100) * 100 : 0

  const remember = (value: string) => {
    const next = [value, ...history.filter((item) => item !== value)].slice(0, 10)
    setHistory(next)
    localStorage.setItem('deep_search_history', JSON.stringify(next))
  }

  const evaluateSearch = (keyword: string, exclusions: Set<string>) => {
    const currentIntent = recognizeSearchIntent(keyword)
    const currentFilters = filtersFromSearchIntent(currentIntent, exclusions)
    const currentActive = currentIntent.conditions.filter((condition) => !exclusions.has(condition.id))
    const result = catalogRepository.queryProducts(currentActive.length ? '' : keyword, 'default', currentFilters, currentIntent.gameCode)
    if (!window.navigator.onLine) {
      setView('failure')
      return
    }
    if (result.length) {
      if (currentActive.length) navigate(catalogUrlFromSearchIntent(currentIntent, exclusions))
      else navigate(`/game?gameCode=${currentIntent.gameCode}&q=${encodeURIComponent(keyword)}`)
      return
    }
    const hasRelaxedResult = currentActive.some((condition) => {
      if (condition.kind === 'game') return false
      const excluded = new Set([...exclusions, condition.id])
      return catalogRepository.queryProducts('', 'default', filtersFromSearchIntent(currentIntent, excluded), currentIntent.gameCode).length > 0
    })
    setView(hasRelaxedResult ? 'partial' : 'empty')
  }

  const commitSearch = () => {
    const keyword = query.trim()
    if (!keyword) return
    remember(keyword)
    setRecognizedQuery(keyword)
    setView('loading')
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    const exclusions = new Set(removedConditions)
    searchTimerRef.current = window.setTimeout(() => evaluateSearch(keyword, exclusions), 520)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    commitSearch()
  }

  const useSearch = (value: string) => {
    setQuery(value)
    setRecognizedQuery(value)
    setRemovedConditions(new Set())
    setView('idle')
    setEditing(true)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const removeHistory = (value: string) => {
    const next = history.filter((item) => item !== value)
    setHistory(next)
    localStorage.setItem('deep_search_history', JSON.stringify(next))
  }

  const removeCondition = (id: string) => {
    setRemovedConditions((current) => new Set([...current, id]))
    setView('idle')
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
    if (relaxed.length) navigate(catalogUrlFromSearchIntent(intent, nextRemoved))
  }

  const clearQuery = () => {
    setQuery('')
    setRecognizedQuery('')
    setRemovedConditions(new Set())
    setView('idle')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const showConditionStrip = (view === 'loading' || view === 'partial' || view === 'failure') && activeConditions.length > 0

  return (
    <main className="search-v2-page">
      <header className="search-v2-top">
        <SearchStatusBar />
        <form className={`search-v2-bar${editing || query ? ' is-editing' : ''}`} role="search" onSubmit={submit}>
          <button type="button" aria-label="返回" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
          <label><Search size={17} aria-hidden="true" /><input ref={inputRef} value={query} onFocus={() => setEditing(true)} onBlur={() => { if (!query) setEditing(false) }} onChange={(event) => setQuery(event.target.value)} placeholder="说出你要的号，例：王者 108英雄 500-1500" aria-label="说出你要的号" />{query && <button type="button" aria-label="清空搜索" onClick={clearQuery}><X size={15} /></button>}</label>
          {(editing || query) && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => navigate(-1)}>取消</button>}
        </form>
        {showConditionStrip && <div className="search-v2-condition-strip" aria-label="已识别的搜索条件">
          {activeConditions.slice(0, 4).map((condition) => <button type="button" key={condition.id} onClick={() => removeCondition(condition.id)}><span>{condition.kind === 'game' ? condition.value : condition.label}</span>{condition.kind !== 'game' && <strong>{condition.value}</strong>}<X size={11} aria-hidden="true" /></button>)}
        </div>}
      </header>

      <div className="search-v2-scroll">
        {view === 'loading' ? <SearchLoading /> : view === 'failure' ? <section className="search-v2-failure" aria-live="polite">
          <span className="search-v2-state-icon"><WifiOff size={31} aria-hidden="true" /></span>
          <h1>网络不稳定，未能获取结果</h1>
          <p>你的搜索词与已识别条件已保留，恢复网络后可直接重试。</p>
          <button type="button" className="search-v2-retry" onClick={commitSearch}>重试</button>
          <button type="button" className="search-v2-network-settings" onClick={() => window.location.reload()}>检查网络设置</button>
          <article className="search-v2-preserved"><strong>保留的搜索条件</strong><span>{activeConditions.map((condition) => condition.kind === 'game' ? condition.value : `${condition.label}${condition.value}`).join(' · ')}</span></article>
        </section> : view === 'partial' ? <section className="search-v2-partial" aria-live="polite">
          <article className="search-v2-partial-summary">
            <h1>没有完全匹配，先看最接近的 {closestProducts.length || allGameProducts.length} 个↑</h1>
            <p>{activeConditions.length} 个条件未完全满足。下面结果按满足度排序。</p>
            <div>{relaxationSuggestions.slice(0, 2).map(({ condition, nearestPrice }) => <button type="button" key={condition.id} onClick={() => applyRelaxation(condition)}>{relaxationLabel(condition, nearestPrice)}</button>)}</div>
          </article>
          <header className="search-v2-partial-sort"><strong>按满足度</strong><span>最新</span><span>价格 ↕</span><b>筛选 <i>{activeConditions.length}</i></b></header>
          <div className="search-v2-nearby-list">{(closestProducts.length ? closestProducts : allGameProducts.slice(0, 2)).map((product) => {
            const satisfied = activeConditions.filter((condition) => condition.kind !== 'game' && conditionMatchesProduct(intent, condition, product))
            const missing = activeConditions.filter((condition) => condition.kind !== 'game' && !conditionMatchesProduct(intent, condition, product))
            return <button type="button" className="search-v2-product-card" key={product.id} onClick={() => navigate(`/goods/${product.id}`)}>
              <img src={product.image} alt="" />
              <span className="search-v2-product-main"><strong>{product.displayTitle || `${product.rank} · ${product.heroCount ?? '--'}英雄 · ${product.skinCount}皮肤`}</strong><small>{product.tags.slice(0, 3).join(' · ')}</small><span>{product.tags.slice(0, 2).map((tag) => <i key={tag}>{tag}</i>)}</span><b>¥{product.price.toLocaleString('zh-CN')}</b></span>
              <em>{product.wantCount ?? 0}人想要</em>
              <span className="search-v2-fit"><small>✓ 满足 {satisfied.map((condition) => condition.label).join(' · ') || '游戏'}</small>{missing.length > 0 && <small>× 未满足 {missing.map((condition) => condition.value).join(' · ')}</small>}</span>
            </button>
          })}</div>
        </section> : view === 'empty' ? <section className="search-v2-no-match" aria-live="polite">
          <span className="search-v2-state-icon"><Search size={31} aria-hidden="true" /></span>
          <h1>没有完全匹配的号</h1>
          {activeConditions.length ? <><p>「{activeConditions.filter((condition) => condition.kind !== 'game').map((condition) => condition.value).join(' + ') || intent.gameName}」近 30 天成交均价 <strong>¥{averagePrice.toLocaleString('zh-CN')}</strong></p>{filters.maxPrice && averagePrice > Number(filters.maxPrice) && <small>高于你设定的预算 ¥{Number(filters.maxPrice).toLocaleString('zh-CN')}</small>}</> : <p>没有找到“{recognizedQuery}”相关商品，换个关键词试试。</p>}
          <article className="search-v2-relax-card">
            <h2>{relaxationSuggestions.length ? '放宽一个条件就有结果' : '换个条件继续看看'}</h2>
            {relaxationSuggestions.map(({ condition, count, nearestPrice }) => <button type="button" key={condition.id} onClick={() => applyRelaxation(condition)}><span>{relaxationLabel(condition, nearestPrice)}</span><strong>{count}个 ↑</strong></button>)}
            <button type="button" className="muted" onClick={() => navigate(`/game?gameCode=${intent.gameCode}`)}><span>清空全部条件</span><b>{allGameProducts.length.toLocaleString('zh-CN')}个 ↑</b></button>
          </article>
        </section> : <>
          {recognizedQuery && activeConditions.length > 0 ? <section className="search-v2-recognition" aria-live="polite">
            <h1><span aria-hidden="true">✓</span>已识别 {activeConditions.length} 个条件，点任一条可改</h1>
            <div>{activeConditions.map((condition) => <article key={condition.id}><button type="button" aria-label={`移除${condition.label}${condition.value}`} onClick={() => removeCondition(condition.id)}><span>{condition.label}</span><strong>{condition.value}</strong><X size={13} /></button></article>)}</div>
            <button type="button" className="search-v2-confirm" onClick={commitSearch}>查看结果</button>
          </section> : !recognizedQuery && <DefaultSearchContent navigate={navigate} history={history} removeHistory={removeHistory} clearHistory={() => { setHistory([]); localStorage.removeItem('deep_search_history') }} useSearch={useSearch} />}

          {recognizedQuery && <>
            <section className="search-v2-common"><h2>大家在搜</h2><div>{suggestedSearches.map((item) => <button type="button" key={item} onClick={() => useSearch(item)}>{item}</button>)}</div></section>
            {history.length > 0 && <section className="search-v2-history">
              <header><h2>搜索历史</h2><button type="button" onClick={() => { setHistory([]); localStorage.removeItem('deep_search_history') }}>清空</button></header>
              <div>{history.map((item) => <div className="search-v2-history-row" key={item}><button type="button" onClick={() => useSearch(item)}><span>{item}</span></button><button type="button" aria-label={`删除搜索记录${item}`} onClick={() => removeHistory(item)}><X size={15} /></button></div>)}</div>
            </section>}
          </>}
        </>}
      </div>
    </main>
  )
}

function DefaultSearchContent({ navigate, history, removeHistory, clearHistory, useSearch }: { navigate: ReturnType<typeof useNavigate>; history: string[]; removeHistory: (value: string) => void; clearHistory: () => void; useSearch: (value: string) => void }) {
  return <div className="search-v2-default">
    <section className="search-v2-quick-games"><h2>选游戏直接开始</h2><div>
      {quickGames.map((entry) => {
        const game = games.find((item) => item.code === entry.code)
        if (!game) return null
        const image = entry.code === 'wzry' ? homeGameAsset('game-wzry.png') : entry.code === 'hpjy' ? homeGameAsset('game-hpjy.png') : homeGameAsset('game-genshin.png')
        return <button type="button" key={entry.code} onClick={() => navigate(`/game?gameCode=${entry.code}`)}><img src={image} alt="" /><span><strong>{game.name}</strong><small>{entry.count}</small></span></button>
      })}
      <button type="button" onClick={() => navigate('/game/select?current=wzry')}><i><List size={18} aria-hidden="true" /></i><span><strong>全部游戏</strong><small>按分类浏览</small></span></button>
    </div></section>
    {history.length > 0 && <section className="search-v2-recent"><header><h2>最近搜索</h2><button type="button" onClick={clearHistory}>清空</button></header><div>{history.slice(0, 4).map((item) => <span key={item}><button type="button" onClick={() => useSearch(item)}>{item}</button><button type="button" aria-label={`删除搜索记录${item}`} onClick={() => removeHistory(item)}><X size={11} /></button></span>)}</div></section>}
    <section className="search-v2-ranking"><h2>大家在搜</h2><div>{searchRanking.map((item, index) => <button type="button" key={item} onClick={() => useSearch(item)}><b>{index + 1}</b><span>{item}</span>{index === 0 && <em>HOT</em>}</button>)}</div></section>
  </div>
}

function SearchLoading() {
  return <section className="search-v2-loading" aria-live="polite"><p><i aria-hidden="true" />正在匹配符合条件的账号…</p>{[0, 1, 2, 3].map((item) => <article key={item}><i /><span><b /><b /><b /><em><small /><small /><small /></em><b /></span></article>)}</section>
}
