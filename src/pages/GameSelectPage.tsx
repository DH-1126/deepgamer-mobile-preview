import { Check, ChevronLeft, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { games } from '../data/fixtures'
import { isLinkedDataMode } from '../runtime/dataMode'
import { toCatalogGame, useLinkedState } from '../linked/linkedData'
import { Button, EmptyStateView, Heading, IconButton, PageHeader, SearchField, StatusBar } from '../components/ui'
import '../styles/game-select-v2.css'

export function GameSelectPage() {
  const linkedState = useLinkedState()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const currentCode = params.get('current') ?? ''

  const sourceGames = useMemo(() => isLinkedDataMode
    ? (linkedState?.games ?? []).filter((game) => game.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder).map((game) => toCatalogGame(game, linkedState?.goods.filter((goods) => goods.gameCode === game.code && goods.auditStatus === 'APPROVED' && goods.productStatus === 'ON_SALE').length ?? 0))
    : games, [linkedState])
  const visibleGames = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN')
    if (!keyword) return sourceGames
    return sourceGames.filter((game) => `${game.name} ${game.description}`.toLocaleLowerCase('zh-CN').includes(keyword))
  }, [query, sourceGames])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(`/game?gameCode=${currentCode || 'wzry'}`)
  }

  return (
    <main className="game-select-v2">
      <header className="game-select-v2-header">
        <StatusBar />
        <PageHeader className="game-select-v2-titlebar" bordered={false} title="选择游戏" left={<IconButton label="返回买号页面" onClick={goBack}><ChevronLeft size={25} strokeWidth={2} aria-hidden="true" /></IconButton>} />
        <SearchField
          ref={inputRef}
          className="game-select-v2-search"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onClear={() => { setSearchDraft(''); inputRef.current?.focus() }}
          onSearch={() => setQuery(searchDraft.trim())}
          clearLabel="清空游戏搜索"
          aria-label="搜索游戏"
          placeholder="搜索游戏名称"
          autoComplete="off"
        />
      </header>

      <section className="game-select-v2-content" aria-labelledby="game-select-all-title">
        <div className="game-select-v2-section-title">
          <Heading id="game-select-all-title" as="h2" variant="section">全部游戏</Heading>
          <span>{query ? `${visibleGames.length} 个结果` : `${sourceGames.length} 款游戏`}</span>
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
          <EmptyStateView
            className="game-select-v2-empty"
            icon={<Search size={25} aria-hidden="true" />}
            title="没有找到相关游戏"
            description="试试其他游戏名称"
            action={<Button size="md" onClick={() => { setSearchDraft(''); setQuery(''); inputRef.current?.focus() }}>查看全部游戏</Button>}
          />
        )}
      </section>
    </main>
  )
}
