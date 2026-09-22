import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { games } from '../data/fixtures'
import { sellGames } from '../data/sellFixtures'
import { gameDirectory, gameIndexLetters, type GameDirectoryEntry, type GamePlatform } from '../data/gameDirectory'
import { filterDirectoryGames, getGameSelectionTarget, groupDirectoryGames, nextRecentGames, type GameSelectionScene } from '../components/gameSelectionModel'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import { assetPath } from '../components/assetPath'
import { getRuntimeStorage, isLinkedDataMode } from '../runtime/dataMode'
import { useLinkedState } from '../linked/linkedData'
import { sellRepository } from '../repository/sellRepository'
import { Button, EmptyStateView, Heading, IconButton, SearchField, Tabs, Toast } from '../components/ui'
import '../styles/game-select-v2.css'

const recentKey = 'deepgamer.game-directory.recent.v1'
function readRecent(): string[] {
  try { const data: unknown = JSON.parse(getRuntimeStorage().getItem(recentKey) ?? '[]'); return Array.isArray(data) ? data.filter((value): value is string => typeof value === 'string').slice(0, 5) : [] } catch { return [] }
}

function GameImage({ game, large = false }: { game: GameDirectoryEntry; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  return <span className={`game-list-art${game.insetImage ? ' game-list-art--inset' : ''}`}>
    {game.image && !failed ? <img src={game.image.startsWith('assets/') ? assetPath(game.image) : game.image} alt="" onError={() => setFailed(true)} /> : <span>{large ? '图待补' : '图'}</span>}
  </span>
}

export function GameSelectPage() {
  const linkedState = useLinkedState()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const scene: GameSelectionScene = params.get('scene') === 'sell' ? 'sell' : 'buy'
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState<'all' | GamePlatform>('all')
  const [activeLetter, setActiveLetter] = useState('A')
  const [toast, setToast] = useState('')
  const [recent, setRecent] = useState(readRecent)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const currentCode = params.get('current') ?? ''

  const sourceGames = useMemo<GameDirectoryEntry[]>(() => {
    if (isLinkedDataMode) return (linkedState?.games ?? []).filter(game => game.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder).map(game => {
      const metadata = gameDirectory.find(item => item.buyCode === game.code)
      return { ...metadata, code: game.code, name: game.name, initial: metadata?.initial ?? (/^[a-z]/i.test(game.name) ? game.name[0].toUpperCase() : '#'), platforms: metadata?.platforms ?? ['pc', 'mobile'], image: game.iconUrl || metadata?.image, buyCode: game.code, sellCode: undefined }
    })
    return gameDirectory.map(game => ({ ...game,
      buyCode: games.some(item => item.code === game.buyCode) ? game.buyCode : undefined,
      sellCode: sellGames.some(item => item.code === game.sellCode) ? game.sellCode : undefined,
    }))
  }, [linkedState])
  const current = sourceGames.find(game => game.code === currentCode || (scene === 'sell' ? game.sellCode : game.buyCode) === currentCode)
  const recentGames = useMemo(() => {
    const codes = current ? nextRecentGames(recent, current.code) : recent.length ? recent : ['wzry']
    return codes.map(code => sourceGames.find(game => game.code === code)).filter((game): game is GameDirectoryEntry => Boolean(game))
  }, [current, recent, sourceGames])
  const filtered = useMemo(() => filterDirectoryGames(sourceGames, query, platform), [sourceGames, query, platform])
  const groups = useMemo(() => groupDirectoryGames(filtered), [filtered])
  const recommended = sourceGames.filter(game => game.recommended).slice(0, 10)
  const indexLetters = groups.some(group => group.initial === '#') ? [...gameIndexLetters, '#'] : gameIndexLetters

  useEffect(() => { if (params.get('search') === '1') inputRef.current?.focus() }, [params])
  useEffect(() => { setActiveLetter(groups[0]?.initial ?? ''); if (query) scrollRef.current?.scrollTo({ top: 0 }) }, [groups, query])

  const choose = (game: GameDirectoryEntry) => {
    const target = getGameSelectionTarget(game, scene)
    if (!target) { setToast(scene === 'sell' ? '该游戏暂未开放回收，请选择其他游戏' : '该游戏暂未开放买号，请选择其他游戏'); return }
    if (scene === 'sell') {
      const sellGame = sellGames.find(item => item.code === game.sellCode)
      if (!sellGame || !sellRepository.selectGame(sellGame.code)) { setToast('游戏选择保存失败，请重试'); return }
    }
    const updated = nextRecentGames(recent, game.code)
    setRecent(updated)
    try { getRuntimeStorage().setItem(recentKey, JSON.stringify(updated)) } catch { /* Browsing can continue without a recent-history write. */ }
    navigate(target, { replace: true })
  }
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(scene === 'sell' ? '/sell' : current?.buyCode ? `/game?gameCode=${encodeURIComponent(current.buyCode)}` : '/')
  }
  const jumpToLetter = (letter: string) => {
    const section = sectionRefs.current.get(letter)
    const scroller = scrollRef.current
    if (!section || !scroller) return
    const top = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (tabsRef.current?.offsetHeight ?? 44)
    scroller.scrollTo({ top, behavior: 'auto' }); setActiveLetter(letter)
  }
  const updateActiveLetter = () => {
    const scroller = scrollRef.current
    if (!scroller) return
    const threshold = scroller.getBoundingClientRect().top + (tabsRef.current?.offsetHeight ?? 44) + 6
    let letter = groups[0]?.initial ?? ''
    for (const group of groups) { const section = sectionRefs.current.get(group.initial); if (section && section.getBoundingClientRect().top <= threshold) letter = group.initial }
    setActiveLetter(letter)
  }
  const tile = (game: GameDirectoryEntry, recentTile = false) => <button type="button" key={game.code} className={`game-list-tile${recentTile && (current?.code === game.code || (!current && recentGames[0]?.code === game.code)) ? ' game-list-tile--current' : ''}`} onClick={() => choose(game)} aria-label={`${game.name}${current?.code === game.code ? '，当前游戏' : ''}`}>
    <GameImage game={game} large /><span className="game-list-name">{game.name}</span>
  </button>

  return <main className="game-select-v2" aria-label="游戏列表" data-node-id="4535:3844" data-scene={scene}>
    <header className="game-list-header">
      <DesignPromptTrigger nodeId="4535:3844" className="game-list-status" />
      <form className="game-list-search-row" role="search" onSubmit={event => { event.preventDefault(); inputRef.current?.blur() }}>
        <IconButton label="返回" className="game-list-back" onClick={goBack}><img src={assetPath('assets/game-list-v3/back.svg')} alt="" /></IconButton>
        <SearchField ref={inputRef} className="game-list-search" value={query} onChange={event => setQuery(event.target.value)} onClear={() => { setQuery(''); inputRef.current?.focus() }} clearLabel="清空游戏搜索" aria-label="搜索游戏" placeholder="请输入游戏名称" autoComplete="off" />
      </form>
    </header>
    <div ref={scrollRef} className="game-list-scroll" onScroll={updateActiveLetter}>
      {!query.trim() && <div className="game-list-discovery">
        {recentGames.length > 0 && <section aria-labelledby="game-list-recent"><Heading id="game-list-recent" as="h2" variant="subsection">最近浏览</Heading><div className="game-list-grid game-list-recent-grid">{recentGames.map(game => tile(game, true))}</div></section>}
        {recommended.length > 0 && <section aria-labelledby="game-list-hot"><Heading id="game-list-hot" as="h2" variant="subsection">热门推荐</Heading><div className="game-list-grid">{recommended.map(game => tile(game))}</div></section>}
      </div>}
      <div ref={tabsRef} className="game-list-tabs"><Tabs label="游戏类型" variant="underline" value={platform} onValueChange={value => setPlatform(value as typeof platform)} items={[{ value: 'all', label: '全部' }, { value: 'pc', label: '端游' }, { value: 'mobile', label: '手游' }]} /></div>
      {groups.length ? <div className="game-list-directory">
        <div className="game-list-sections">{groups.map(group => <section key={group.initial} ref={element => { if (element) sectionRefs.current.set(group.initial, element); else sectionRefs.current.delete(group.initial) }} aria-labelledby={`game-letter-${group.initial}`}>
          <Heading id={`game-letter-${group.initial}`} className="game-list-letter" as="h2" variant="subsection">{group.initial}</Heading>
          <ul>{group.items.map(game => <li key={game.code}><button type="button" onClick={() => choose(game)}><GameImage game={game} /><span>{game.name}</span></button></li>)}</ul>
        </section>)}</div>
        <nav className="game-list-index" aria-label="游戏首字母索引">{indexLetters.map(letter => <button key={letter} type="button" className={letter === activeLetter ? 'active' : ''} aria-current={letter === activeLetter ? 'location' : undefined} aria-label={`跳转到 ${letter}`} disabled={!groups.some(group => group.initial === letter)} onClick={() => jumpToLetter(letter)}>{letter}</button>)}</nav>
      </div> : <EmptyStateView title="没有找到相关游戏" description="试试其他游戏名称或切换分类" action={<Button size="md" onClick={() => { setQuery(''); setPlatform('all'); inputRef.current?.focus() }}>查看全部游戏</Button>} />}
    </div>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}
