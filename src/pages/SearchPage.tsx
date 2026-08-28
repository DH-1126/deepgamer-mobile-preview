import { ChevronLeft, Search, X } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { catalogUrlFromSearchIntent, filtersFromSearchIntent, recognizeSearchIntent, relaxationLabel, type SearchCondition } from '../components/searchIntentModel'
import { catalogRepository } from '../repository/catalogRepository'
import '../styles/search-v2.css'

const suggestedSearches = ['王者 108英雄', '和平精英 满级', '原神 五星6', 'QQ区 便宜号']
const statusAsset = (name: string) => assetPath(`assets/catalog-v2/${name}`)

function SearchStatusBar() {
  return <div className="search-v2-status" aria-hidden="true"><time>9:41</time><span><img src={statusAsset('status-signal.svg')} alt="" /><img src={statusAsset('status-wifi.svg')} alt="" /><img src={statusAsset('status-battery.svg')} alt="" /></span></div>
}

export function SearchPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [recognizedQuery, setRecognizedQuery] = useState(initialQuery)
  const [history, setHistory] = useState<string[]>([])
  const [removedConditions, setRemovedConditions] = useState<Set<string>>(new Set())
  const [showNoMatch, setShowNoMatch] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('deep_search_history') ?? '[]')) } catch { setHistory([]) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecognizedQuery(query.trim())
      setRemovedConditions(new Set())
      setShowNoMatch(false)
    }, 260)
    return () => window.clearTimeout(timer)
  }, [query])

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

  const commitSearch = () => {
    const keyword = query.trim()
    if (!keyword) return
    const currentIntent = recognizeSearchIntent(keyword)
    const currentFilters = filtersFromSearchIntent(currentIntent, removedConditions)
    const currentActive = currentIntent.conditions.filter((condition) => !removedConditions.has(condition.id))
    const result = catalogRepository.queryProducts(currentActive.length ? '' : keyword, 'default', currentFilters, currentIntent.gameCode)
    remember(keyword)
    setRecognizedQuery(keyword)
    if (result.length) {
      if (currentActive.length) navigate(catalogUrlFromSearchIntent(currentIntent, removedConditions))
      else navigate(`/game?gameCode=${currentIntent.gameCode}&q=${encodeURIComponent(keyword)}`)
      return
    }
    setShowNoMatch(true)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    commitSearch()
  }

  const useSearch = (value: string) => {
    setQuery(value)
    setRecognizedQuery(value)
    setRemovedConditions(new Set())
    setShowNoMatch(false)
    inputRef.current?.focus()
  }

  const removeHistory = (value: string) => {
    const next = history.filter((item) => item !== value)
    setHistory(next)
    localStorage.setItem('deep_search_history', JSON.stringify(next))
  }

  const removeCondition = (id: string) => {
    setRemovedConditions((current) => new Set([...current, id]))
    setShowNoMatch(false)
  }

  const relaxationSuggestions = activeConditions.filter((condition) => condition.kind !== 'game').map((condition) => {
    const excluded = new Set([...removedConditions, condition.id])
    const relaxedFilters = filtersFromSearchIntent(intent, excluded)
    const relaxedMatches = catalogRepository.queryProducts('', 'default', relaxedFilters, intent.gameCode)
    const nearestPrice = condition.kind === 'price' ? relaxedMatches.map((product) => product.price).sort((a, b) => a - b)[0] : undefined
    return { condition, count: relaxedMatches.length, nearestPrice }
  }).filter((suggestion) => suggestion.count > matches.length)

  const applyRelaxation = (condition: SearchCondition) => {
    const nextRemoved = new Set([...removedConditions, condition.id])
    const relaxedFilters = filtersFromSearchIntent(intent, nextRemoved)
    const relaxed = catalogRepository.queryProducts('', 'default', relaxedFilters, intent.gameCode)
    setRemovedConditions(nextRemoved)
    if (relaxed.length) navigate(catalogUrlFromSearchIntent(intent, nextRemoved))
  }

  return (
    <main className="search-v2-page">
      <header className="search-v2-top">
        <SearchStatusBar />
        <form className="search-v2-bar" role="search" onSubmit={submit}>
          <button type="button" aria-label="返回" onClick={() => navigate(-1)}><ChevronLeft size={26} /></button>
          <label><Search size={20} aria-hidden="true" /><input ref={inputRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索游戏、段位、英雄或预算" aria-label="搜索游戏、段位、英雄或预算" />{query && <button type="button" aria-label="清空搜索" onClick={() => { setQuery(''); setRecognizedQuery(''); setRemovedConditions(new Set()); setShowNoMatch(false); inputRef.current?.focus() }}><X size={17} /></button>}</label>
          <button type="button" onClick={() => navigate(-1)}>取消</button>
        </form>
      </header>

      <div className="search-v2-scroll">
        {showNoMatch ? <section className="search-v2-no-match" aria-live="polite">
          <span className="search-v2-empty-icon"><Search size={34} aria-hidden="true" /></span>
          <h1>没有完全匹配的号</h1>
          {activeConditions.length ? <><p>「{activeConditions.filter((condition) => condition.kind !== 'game').map((condition) => condition.value).join(' + ') || intent.gameName}」近 30 天成交均价 <strong>¥{averagePrice.toLocaleString('zh-CN')}</strong></p>{filters.maxPrice && averagePrice > Number(filters.maxPrice) && <small>高于你设定的预算 ¥{Number(filters.maxPrice).toLocaleString('zh-CN')}</small>}</> : <p>没有找到“{recognizedQuery}”相关商品，换个关键词试试。</p>}
          <article className="search-v2-relax-card">
            <h2>{relaxationSuggestions.length ? '放宽一个条件就有结果' : '换个条件继续看看'}</h2>
            {relaxationSuggestions.map(({ condition, count, nearestPrice }) => <button type="button" key={condition.id} onClick={() => applyRelaxation(condition)}><span>{relaxationLabel(condition, nearestPrice)}</span><strong>{count}个 ↑</strong></button>)}
            <button type="button" className="muted" onClick={() => navigate(`/game?gameCode=${intent.gameCode}`)}><span>清空全部条件</span><b>{allGameProducts.length.toLocaleString('zh-CN')}个 ↑</b></button>
          </article>
        </section> : <>
          {recognizedQuery && activeConditions.length > 0 && <section className="search-v2-recognition" aria-live="polite">
            <h1><span aria-hidden="true">✓</span>已识别 {activeConditions.length} 个条件，点右上角可移除</h1>
            <div>{activeConditions.map((condition) => <article key={condition.id}><span>{condition.label}</span><strong>{condition.value}</strong><button type="button" aria-label={`移除${condition.label}${condition.value}`} onClick={() => removeCondition(condition.id)}><X size={17} /></button></article>)}</div>
            <button type="button" className="search-v2-confirm" onClick={commitSearch}>确认</button>
          </section>}

          <section className="search-v2-common">
            <h2>大家在搜</h2>
            <div>{suggestedSearches.map((item) => <button type="button" key={item} onClick={() => useSearch(item)}>{item}</button>)}</div>
          </section>

          {history.length > 0 && <section className="search-v2-history">
            <header><h2>搜索历史</h2><button type="button" onClick={() => { setHistory([]); localStorage.removeItem('deep_search_history') }}>清空</button></header>
            <div>{history.map((item) => <div className="search-v2-history-row" key={item}><button type="button" onClick={() => useSearch(item)}><span>{item}</span></button><button type="button" aria-label={`删除搜索记录${item}`} onClick={() => removeHistory(item)}><X size={16} /></button></div>)}</div>
          </section>}
        </>}
      </div>
    </main>
  )
}
