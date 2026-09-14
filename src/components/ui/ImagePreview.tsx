import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { ChevronLeft, ChevronRight, Share2, X } from 'lucide-react'
import { assetPath } from '../assetPath'
import { nextGalleryIndex } from '../productDetailModel'
import { FullScreenPanel, IconButton } from './primitives'
import './ImagePreview.css'

export type ImagePreviewItem = {
  src: string
  alt: string
  label?: string
  source?: string
  date?: string
  description?: string
}

export type ImagePreviewProps = {
  open: boolean
  onClose: () => void
  items: ImagePreviewItem[]
  index: number
  onIndexChange: (index: number) => void
  onShare?: () => void
}

const statusAsset = (name: 'signal' | 'wifi' | 'battery') => assetPath(`assets/home-v2/status-${name}.svg`)

/** A controlled, touch-friendly gallery intended for account evidence and seller photos. */
export function ImagePreview({ open, onClose, items, index, onIndexChange, onShare }: ImagePreviewProps) {
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([])
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const length = items.length
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0
  const activeIndex = length ? Math.min(Math.max(safeIndex, 0), length - 1) : 0
  const item = items[activeIndex]

  const changeBy = (direction: -1 | 1) => {
    if (length > 1) onIndexChange(nextGalleryIndex(activeIndex, direction, length))
  }

  useEffect(() => {
    if (!open || !length) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); changeBy(-1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); changeBy(1) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, length, open])

  useEffect(() => {
    setFailedSource(null)
    thumbnailRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeIndex, item?.src, open])

  if (!length) return null

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) { swipeStart.current = null; return }
    const touch = event.touches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || event.changedTouches.length !== 1) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Retain native vertical scrolling; only a clearly horizontal one-finger gesture changes images.
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.2) return
    changeBy(dx < 0 ? 1 : -1)
  }

  const header = <>
    <div className="image-preview__status" aria-hidden="true"><span>9:41</span><span className="image-preview__status-icons"><img src={statusAsset('signal')} alt="" /><img src={statusAsset('wifi')} alt="" /><img src={statusAsset('battery')} alt="" /></span></div>
    <header className="image-preview__nav">
      <IconButton className="image-preview__nav-button" label="关闭图片预览" onClick={onClose}><X size={22} aria-hidden="true" /></IconButton>
      <strong aria-live="polite">{activeIndex + 1}/{length}</strong>
      <IconButton className="image-preview__nav-button" label="分享图片" onClick={onShare} disabled={!onShare}><Share2 size={21} aria-hidden="true" /></IconButton>
    </header>
  </>

  const footer = <div className="image-preview__thumbnails" aria-label="图片缩略图">
    {items.map((thumbnail, thumbnailIndex) => <button
      key={`${thumbnail.src}-${thumbnailIndex}`}
      ref={(node) => { thumbnailRefs.current[thumbnailIndex] = node }}
      className={`image-preview__thumbnail${thumbnailIndex === activeIndex ? ' image-preview__thumbnail--selected' : ''}`}
      type="button"
      aria-label={`查看第 ${thumbnailIndex + 1} 张图片${thumbnail.alt ? `：${thumbnail.alt}` : ''}`}
      aria-current={thumbnailIndex === activeIndex ? 'true' : undefined}
      onClick={() => onIndexChange(thumbnailIndex)}
    ><img src={thumbnail.src} alt="" /></button>)}
  </div>

  return <FullScreenPanel open={open} onClose={onClose} title="图片预览" header={header} footer={footer} theme="dark" className="image-preview">
    <div className="image-preview__content">
      <div className="image-preview__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {failedSource === item.src
          ? <p className="image-preview__fallback" role="status">图片加载失败，请稍后重试</p>
          : <img className="image-preview__image" src={item.src} alt={item.alt} onError={() => setFailedSource(item.src)} />}
        {length > 1 && <>
          <IconButton className="image-preview__arrow image-preview__arrow--previous" label="上一张图片" onClick={() => changeBy(-1)}><ChevronLeft size={26} aria-hidden="true" /></IconButton>
          <IconButton className="image-preview__arrow image-preview__arrow--next" label="下一张图片" onClick={() => changeBy(1)}><ChevronRight size={26} aria-hidden="true" /></IconButton>
        </>}
      </div>
      {(item.label || item.source || item.date) && <div className="image-preview__meta">{(item.source ?? item.label) && <span className="image-preview__label">{item.source ?? item.label}</span>}{item.date && <time>{item.date}</time>}</div>}
      {item.description && <p className="image-preview__description">{item.description}</p>}
    </div>
  </FullScreenPanel>
}
