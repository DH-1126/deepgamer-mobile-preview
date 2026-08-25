import { ChevronLeft, Search, Trash2, X } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { games, searchHot } from '../data/fixtures'
import { assetPath } from '../components/assetPath'

export function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('deep_search_history') ?? '[]')) } catch { setHistory([]) }
  }, [])
  const remember = (value: string) => {
    const next = [value, ...history.filter((item) => item !== value)].slice(0, 10)
    setHistory(next); localStorage.setItem('deep_search_history', JSON.stringify(next))
  }
  const runSearch = (value: string) => {
    const keyword = value.trim(); if (!keyword) return
    remember(keyword); navigate(`/buy/list?keyword=${encodeURIComponent(keyword)}`)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault(); runSearch(query)
  }
  return (
    <main className="search-page">
      <form className="search-header" onSubmit={submit}>
        <button type="button" aria-label="返回" onClick={() => navigate('/')}><ChevronLeft size={23} /></button>
        <label><Search size={18} /><input ref={inputRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索商品关键字" aria-label="搜索商品关键字" />{query && <button type="button" aria-label="清空搜索" onClick={() => { setQuery(''); inputRef.current?.focus() }}><X size={16} /></button>}</label>
        <button type="submit">搜索</button>
        <button className="cancel-search" type="button" onClick={() => history.length > 1 ? navigate(-1) : navigate('/')}>取消</button>
      </form>
      <section className="search-body">
        {history.length > 0 && <><div className="section-heading"><h2>最近搜索</h2><button type="button" onClick={() => { setHistory([]); localStorage.removeItem('deep_search_history') }}><Trash2 size={14} />清空</button></div><div className="hot-chips history-chips">{history.map((item) => <button type="button" key={item} onClick={() => runSearch(item)}>{item}<X size={12} onClick={(event) => { event.stopPropagation(); const next = history.filter((value) => value !== item); setHistory(next); localStorage.setItem('deep_search_history', JSON.stringify(next)) }} /></button>)}</div></>}
        <div className={`section-heading ${history.length ? 'spaced-heading' : ''}`}><h2>热门搜索</h2></div>
        <div className="hot-chips">{searchHot.slice(0, 3).map((item, index) => <button type="button" key={item} onClick={() => runSearch(item)}><i>{index + 1}</i>{item}</button>)}</div>
        <div className="section-heading game-heading"><h2>游戏筛选</h2><span>先选游戏更准</span></div>
        <div className="search-game-grid">
          {games.slice(0, 3).map((game) => <button type="button" key={game.code} onClick={() => navigate(`/game?gameCode=${game.code}`)}><img src={game.image} alt="" /><span><strong>{game.name}</strong><small>{game.description}</small></span></button>)}
          <button type="button" className="all-games" onClick={() => navigate('/#game-selection')}><img src={assetPath('assets/games/all-games.png')} alt="" /><span><strong>全部游戏</strong><small>返回首页选择游戏</small></span></button>
        </div>
      </section>
    </main>
  )
}
