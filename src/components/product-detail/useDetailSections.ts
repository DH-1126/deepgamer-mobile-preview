import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { detailTabScrollTarget, parseDetailSection, type SectionId } from './detailSectionModel'

/** A selected panel is never changed by scrolling another panel into view. */
export function useDetailSections(productId: string) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useSearchParams()
  const activeSection = parseDetailSection(params.get('tab'))
  const pendingScroll = useRef<number | null>(null)
  const [pastTabTop, setPastTabTop] = useState(false)

  const measure = useCallback(() => {
    const container = scrollRef.current
    const panel = container?.querySelector<HTMLElement>('.detail-sections')
    const tabs = container?.querySelector<HTMLElement>('.detail-tabs')
    if (!container || !panel || !tabs) return null
    return {
      container,
      panelTop: panel.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop,
      tabHeight: tabs.getBoundingClientRect().height,
    }
  }, [])

  const onScroll = useCallback(() => {
    const measurement = measure()
    setPastTabTop(Boolean(measurement && measurement.container.scrollTop > measurement.panelTop - measurement.tabHeight + 24))
  }, [measure])

  const restoreScroll = useCallback((previousTop: number, returnToTop = false) => {
    const measured = measure()
    if (!measured) return
    const { container, panelTop, tabHeight } = measured
    container.scrollTo({ top: detailTabScrollTarget(previousTop, panelTop, tabHeight, container.scrollHeight, container.clientHeight, returnToTop), behavior: 'auto' })
    onScroll()
  }, [measure, onScroll])

  const goToSection = useCallback((id: SectionId) => {
    const previousTop = scrollRef.current?.scrollTop ?? 0
    if (id === activeSection) { restoreScroll(previousTop); return }
    pendingScroll.current = previousTop
    setParams(previous => {
      const next = new URLSearchParams(previous)
      next.set('tab', id)
      return next
    }, { replace: true, preventScrollReset: true })
  }, [activeSection, restoreScroll, setParams])

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return
    // Allow even a short panel to reach the sticky tab edge.
    const resize = () => {
      const tabHeight = container.querySelector('.detail-tabs')?.getBoundingClientRect().height ?? 44
      container.style.setProperty('--detail-panel-min-height', Math.max(0, container.clientHeight - tabHeight) + 'px')
    }
    resize()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [productId])

  useLayoutEffect(() => {
    pendingScroll.current = null
    setPastTabTop(false)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [productId])

  useLayoutEffect(() => {
    if (pendingScroll.current !== null) {
      restoreScroll(pendingScroll.current)
      pendingScroll.current = null
    }
    onScroll()
  }, [activeSection, onScroll, restoreScroll])

  const returnToTabTop = useCallback(() => restoreScroll(0, true), [restoreScroll])
  return { scrollRef, activeSection, pastTabTop, onScroll, goToSection, returnToTabTop }
}
