import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { assetPath } from './assetPath'
import { Heading, Button } from './ui'
import { DesignPromptTrigger } from './DesignPromptTrigger'
import '../styles/network-status-boundary.css'

export function isNetworkPreviewOffline(search: string) {
  return new URLSearchParams(search).get('network') === 'offline'
}

export function removeNetworkPreview(search: string) {
  const params = new URLSearchParams(search)
  params.delete('network')
  const next = params.toString()
  return next ? `?${next}` : ''
}

export function shouldShowNetworkOverlay(search: string, online: boolean) {
  return isNetworkPreviewOffline(search) || !online
}

function readNavigatorOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function NetworkStatusBoundary({ children }: PropsWithChildren) {
  const location = useLocation()
  const navigate = useNavigate()
  const [online, setOnline] = useState(readNavigatorOnline)
  const retryRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const previewOffline = isNetworkPreviewOffline(location.search)
  const unavailable = shouldShowNetworkOverlay(location.search, online)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    contentRef.current?.toggleAttribute('inert', unavailable)
    if (unavailable) retryRef.current?.focus()
    return () => { if (unavailable) { contentRef.current?.removeAttribute('inert'); previousFocus?.focus() } }
  }, [unavailable])

  const retry = useCallback(() => {
    setOnline(readNavigatorOnline())
    if (!previewOffline) return
    navigate({ pathname: location.pathname, search: removeNetworkPreview(location.search), hash: location.hash }, { replace: true })
  }, [location.hash, location.pathname, location.search, navigate, previewOffline])

  return <>
    <div ref={contentRef} style={{ display: 'contents' }} aria-hidden={unavailable || undefined}>{children}</div>
    {unavailable && <section className="network-status-overlay" role="alertdialog" aria-modal="true" aria-labelledby="network-status-title" aria-describedby="network-status-description" data-node-id="7115:1006" onKeyDown={(event) => {
      if (event.key !== 'Tab' || (event.target instanceof Element && event.target.closest('.page-review-dock'))) return
      event.preventDefault()
      const triggers = [...document.querySelectorAll<HTMLButtonElement>('[data-page-spec-trigger][data-node-id="7115:1006"]')]
      const controls = [retryRef.current, ...triggers].filter((control): control is HTMLButtonElement => Boolean(control))
      const index = controls.indexOf(event.target as HTMLButtonElement)
      controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus()
    }}>
      <DesignPromptTrigger nodeId="7115:1006" className="network-status-bar" />
      <div className="network-status-body">
        <div className="network-status-icon"><img src={assetPath('assets/network-draft3/wifi-off.svg')} alt="" /></div>
        <Heading as="h1" variant="hero" id="network-status-title">没有网络</Heading>
        <p id="network-status-description">请检查网络设置或稍后重试</p>
        <Button ref={retryRef} onClick={retry}>重试</Button>
      </div>
    </section>}
  </>
}
