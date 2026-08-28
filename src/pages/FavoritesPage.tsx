import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Search, Trash2, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { FavoriteCard } from '../components/FavoriteCard'
import { assetPath } from '../components/assetPath'
import { clearSelectionForFilter, emptyFavoriteFilters, filterFavorites, projectFavorite, selectionState, toggleAllVisible, toggleFavoriteSelection } from '../components/favoritesModel'
import { favoriteRepository } from '../repository/favoriteRepository'
import type { FavoriteFilters, FavoriteRecord } from '../types/favorite'
import '../styles/favorites.css'

type Panel = 'game' | 'status' | 'time' | null
type Option = { value: string; label: string }
const statusOptions: Option[] = [{ value: 'all', label: '全部' }, { value: 'on_sale', label: '售卖中' }, { value: 'trading', label: '交易中' }, { value: 'sold', label: '已售出' }, { value: 'off_shelf', label: '已下架' }]
const timeOptions: Option[] = [{ value: 'all', label: '全部' }, { value: '7d', label: '最近7天' }, { value: '30d', label: '最近30天' }]

function getLabel(options: Option[], value: string, fallback: string) { return options.find((option) => option.value === value)?.label ?? fallback }

export function FavoritesPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<FavoriteRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [filters, setFilters] = useState<FavoriteFilters>(emptyFavoriteFilters)
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [draft, setDraft] = useState('all')
  const [managing, setManaging] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const listRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const triggerRefs = useRef<Record<Exclude<Panel, null>, HTMLButtonElement | null>>({ game: null, status: null, time: null })

  const sync = useCallback(() => {
    try { setRecords(favoriteRepository.list()); setLoadError('') } catch { setLoadError('收藏加载失败，请重试') }
    setLoaded(true)
  }, [])
  useEffect(() => { sync(); return favoriteRepository.subscribe(sync) }, [sync])
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 1800); return () => window.clearTimeout(timer) }, [toast])

  const views = useMemo(() => records.map(projectFavorite), [records])
  const gameOptions = useMemo<Option[]>(() => [{ value: 'all', label: '全部游戏' }, ...[...new Map(views.filter((view) => view.gameCode !== 'unknown').map((view) => [view.gameCode, view.gameName])).entries()].map(([value, label]) => ({ value, label }))], [views])
  const visible = useMemo(() => filterFavorites(records, filters, Date.now(), query), [filters, query, records])
  const visibleIds = visible.map((item) => item.productId)
  const checked = selectionState(selection, visibleIds)

  useEffect(() => {
    if (managing && visible.length === 0) { setManaging(false); setSelection(new Set()) }
  }, [managing, visible.length])
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (panel) { list.setAttribute('inert', ''); list.setAttribute('aria-hidden', 'true') }
    else { list.removeAttribute('inert'); list.removeAttribute('aria-hidden') }
  }, [panel])
  useEffect(() => {
    if (!panel) return undefined
    const previous = triggerRefs.current[panel]
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>('.selected, .favorite-filter-option')?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setPanel(null); return }
      if (event.key !== 'Tab') return
      const items = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); requestAnimationFrame(() => previous?.focus()) }
  }, [panel])

  const closeDelete = useCallback(() => { if (!deleting) setConfirmDelete(false) }, [deleting])
  useEffect(() => {
    if (!confirmDelete) return undefined
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusables = () => [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    requestAnimationFrame(() => focusables()[0]?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDelete(); return }
      if (event.key !== 'Tab') return
      const items = focusables(); if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); document.body.style.overflow = oldOverflow; requestAnimationFrame(() => deleteTriggerRef.current?.focus()) }
  }, [closeDelete, confirmDelete])

  const back = () => {
    if (managing) { setManaging(false); setSelection(new Set()); return }
    window.history.length > 1 ? navigate(-1) : navigate('/profile')
  }
  const toggleManage = () => { setPanel(null); setManaging((value) => !value); setSelection(new Set()) }
  const openPanel = (next: Exclude<Panel, null>) => {
    if (managing) return
    if (panel === next) { setPanel(null); return }
    setDraft(next === 'game' ? filters.gameCode : next === 'status' ? filters.status : filters.time)
    setPanel(next)
  }
  const resetDraft = () => setDraft('all')
  const applyDraft = () => {
    if (!panel) return
    setFilters((current) => ({ ...current, [panel === 'game' ? 'gameCode' : panel]: draft }))
    setSelection(clearSelectionForFilter())
    setPanel(null)
  }
  const clearFilters = () => { setFilters(emptyFavoriteFilters); setQuery(''); setSelection(new Set()) }
  const deleteSelected = () => {
    if (!selection.size || deleting) return
    setDeleting(true)
    const count = selection.size
    const ok = favoriteRepository.removeMany([...selection])
    setDeleting(false)
    if (!ok) { setDeleteError('删除失败，请重试'); return }
    setDeleteError(''); setConfirmDelete(false); setSelection(new Set()); setToast(`已删除 ${count} 件收藏`)
    if (records.length - count <= 0) setManaging(false)
  }
  const panelOptions = panel === 'game' ? gameOptions : panel === 'status' ? statusOptions : timeOptions

  return <main className={`favorites-page ${managing ? 'is-managing' : ''}`}>
    <header className="favorites-header">
      <div className="favorites-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
      <nav className="favorites-titlebar" aria-label="收藏页导航"><button type="button" onClick={back} aria-label={managing ? '退出管理' : '返回'}><ArrowLeft size={20} strokeWidth={2} aria-hidden="true" /></button><h1>我的收藏</h1><button type="button" onClick={toggleManage} disabled={!records.length}>{managing ? '完成' : '管理'}</button></nav>
      <form className="favorites-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <Search size={16} aria-hidden="true" />
        <input value={query} maxLength={50} disabled={managing} onChange={(event) => { setQuery(event.target.value); setSelection(new Set()) }} placeholder="搜索商品、游戏或商品编号" aria-label="搜索收藏" />
        {query && !managing && <button type="button" onClick={() => { setQuery(''); setSelection(new Set()) }} aria-label="清空搜索"><X size={15} /></button>}
      </form>
      <section className="favorites-filters" aria-label="筛选收藏">
        <button ref={(node) => { triggerRefs.current.game = node }} type="button" disabled={managing} aria-haspopup="dialog" aria-expanded={panel === 'game'} aria-controls="favorite-filter-panel" onClick={() => openPanel('game')}>{filters.gameCode === 'all' ? '选择游戏' : getLabel(gameOptions, filters.gameCode, '选择游戏')}<ChevronDown size={13} aria-hidden="true" /></button>
        <button ref={(node) => { triggerRefs.current.status = node }} type="button" disabled={managing} aria-haspopup="dialog" aria-expanded={panel === 'status'} aria-controls="favorite-filter-panel" onClick={() => openPanel('status')}>{filters.status === 'all' ? '商品状态' : getLabel(statusOptions, filters.status, '商品状态')}<ChevronDown size={13} aria-hidden="true" /></button>
        <button ref={(node) => { triggerRefs.current.time = node }} type="button" disabled={managing} aria-haspopup="dialog" aria-expanded={panel === 'time'} aria-controls="favorite-filter-panel" onClick={() => openPanel('time')}>{filters.time === 'all' ? '收藏时间' : getLabel(timeOptions, filters.time, '收藏时间')}<ChevronDown size={13} aria-hidden="true" /></button>
      </section>
    </header>

    <section ref={listRef} className="favorites-list" aria-label="收藏商品列表">
      {!loaded ? <div className="favorites-state"><span className="favorites-loading" aria-label="正在加载" /></div>
        : loadError ? <div className="favorites-state" role="alert"><h2>收藏加载失败</h2><p>{loadError}</p><button type="button" onClick={sync}>重试</button></div>
          : visible.length ? visible.map((item) => <FavoriteCard key={item.productId} item={item} managing={managing} selected={selection.has(item.productId)} onToggle={() => setSelection((current) => toggleFavoriteSelection(current, item.productId))} />)
            : records.length === 0 ? <div className="favorites-state"><h2>还没有收藏商品</h2><p>遇到喜欢的账号，点收藏就能在这里找到。</p><Link to="/game?gameCode=wzry">去逛逛</Link></div>
              : <div className="favorites-state"><h2>没有符合条件的收藏</h2><p>换个关键词或筛选条件再看看。</p><button type="button" onClick={clearFilters}>清空搜索与筛选</button></div>}
    </section>

    {panel && <div className="favorite-filter-layer"><button type="button" className="favorite-filter-mask" aria-label="关闭筛选" onClick={() => setPanel(null)} /><section id="favorite-filter-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={`${panel === 'game' ? '游戏' : panel === 'status' ? '商品状态' : '收藏时间'}筛选`}><div>{panelOptions.map((option) => <button type="button" className={`favorite-filter-option ${draft === option.value ? 'selected' : ''}`} aria-pressed={draft === option.value} key={option.value} onClick={() => setDraft(option.value)}>{option.label}{draft === option.value && <Check size={15} aria-hidden="true" />}</button>)}</div><footer><button type="button" onClick={resetDraft}>重置</button><button type="button" className="primary" onClick={applyDraft}>确定</button></footer></section></div>}

    {managing && visible.length > 0 && <footer className="favorites-manage-bar"><button type="button" role="checkbox" aria-checked={checked} onClick={() => setSelection((current) => toggleAllVisible(current, visibleIds))}><i aria-hidden="true">{checked && <Check size={14} strokeWidth={3} />}</i>全选</button><span>已选 <b>{selection.size}</b> 件</span><button ref={deleteTriggerRef} type="button" className="delete" disabled={!selection.size} onClick={() => { setDeleteError(''); setConfirmDelete(true) }}><Trash2 size={15} aria-hidden="true" />删除</button></footer>}

    {confirmDelete && <div className="favorite-delete-layer"><button type="button" className="favorite-delete-mask" aria-label="取消删除" onClick={closeDelete} /><section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="favorite-delete-title" aria-describedby="favorite-delete-desc"><h2 id="favorite-delete-title">删除收藏</h2><p id="favorite-delete-desc">确认删除所选 {selection.size} 件收藏？仅从收藏中移除，不影响商品和订单。</p>{deleteError && <small role="alert">{deleteError}</small>}<footer><button type="button" onClick={closeDelete} disabled={deleting}>取消</button><button type="button" className="danger" onClick={deleteSelected} disabled={deleting}>{deleting ? '删除中…' : '确认删除'}</button></footer></section></div>}
    {toast && <div className="favorites-toast" role="status" aria-live="polite">{toast}</div>}
  </main>
}
