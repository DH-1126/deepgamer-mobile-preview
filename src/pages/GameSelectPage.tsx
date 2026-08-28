import { Check, ChevronLeft, Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { games } from '../data/fixtures'
import '../styles/game-select-v2.css'

const catalogAsset = (name: string) => assetPath(`assets/catalog-v2/${name}`)

export function GameSelectPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const currentCode = params.get('current') ?? ''

  const visibleGames = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN')
    if (!keyword) return games
    return games.filter((game) => `${game.name} ${game.description}`.toLocaleLowerCase('zh-CN').includes(keyword))
  }, [query])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(`/game?gameCode=${currentCode || 'wzry'}`)
  }

  return (
    <main className="game-select-v2">
      <header className="game-select-v2-header">
        <div className="game-select-v2-status" aria-hidden="true">
          <time>9:41</time>
          <span>
            <img src={catalogAsset('status-signal.svg')} alt="" />
            <img src={catalogAsset('status-wifi.svg')} alt="" />
            <img src={catalogAsset('status-battery.svg')} alt="" />
          </span>
        </div>
        <div className="game-select-v2-titlebar">
          <button type="button" aria-label="返回买号页面" onClick={goBack}><ChevronLeft size={25} strokeWidth={2} /></button>
          <h1>选择游戏</h1>
          <span aria-hidden="true" />
        </div>
        <label className="game-select-v2-search">
          <Search size={19} strokeWidth={2} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="搜索游戏"
            placeholder="搜索游戏名称"
            autoComplete="off"
          />
          {query && <button type="button" aria-label="清空游戏搜索" onClick={() => { setQuery(''); inputRef.current?.focus() }}><X size={15} aria-hidden="true" /></button>}
        </label>
      </header>

      <section className="game-select-v2-content" aria-labelledby="game-select-all-title">
        <div className="game-select-v2-section-title">
          <h2 id="game-select-all-title">全部游戏</h2>
          <span>{query ? `${visibleGames.length} 个结果` : `${games.length} 款游戏`}</span>
        </div>

        {visibleGames.length > 0 ? (
          <ul className="game-select-v2-list">
            {visibleGames.map((game) => {
              const selected = game.code === currentCode
              return (
                <li key={game.code}>
                  <button
                    type="button"
                    className={selected ? 'selected' : ''}
                    aria-pressed={selected}
                    aria-label={`${game.name}${selected ? '，当前已选择' : ''}`}
                    onClick={() => navigate(`/game?gameCode=${game.code}`)}
                  >
                    <img src={game.image} alt="" />
                    <span className="game-select-v2-copy">
                      <strong>{game.name}</strong>
                      <small>{game.description}</small>
                    </span>
                    {typeof game.saleCount === 'number' && <span className="game-select-v2-sales">{game.saleCount.toLocaleString('zh-CN')} 件在售</span>}
                    <span className="game-select-v2-check" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="game-select-v2-empty" role="status">
            <span aria-hidden="true"><Search size={25} /></span>
            <h2>没有找到相关游戏</h2>
            <p>试试其他游戏名称</p>
            <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus() }}>查看全部游戏</button>
          </div>
        )}
      </section>
    </main>
  )
}
