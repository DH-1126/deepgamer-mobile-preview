import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { assetPath } from './assetPath'
import { Heading, Button } from './ui'
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
    contentRef.current?.toggleAttribute('inert', unavailable)
    if (unavailable) retryRef.current?.focus()
  }, [unavailable])

  const retry = useCallback(() => {
    setOnline(readNavigatorOnline())
    if (!previewOffline) return
    navigate({ pathname: location.pathname, search: removeNetworkPreview(location.search), hash: location.hash }, { replace: true })
  }, [location.hash, location.pathname, location.search, navigate, previewOffline])

  return <>
    <div ref={contentRef} style={{ display: 'contents' }} aria-hidden={unavailable || undefined}>{children}</div>
    {unavailable && <section className="network-status-overlay" role="alertdialog" aria-modal="true" aria-labelledby="network-status-title" aria-describedby="network-status-description" data-node-id="4047:6403" onKeyDown={(event) => {
      if (event.key !== 'Tab') return
      event.preventDefault()
      retryRef.current?.focus()
    }}>
      <header className="network-status-bar" aria-hidden="true"><time>9:41</time><span>●●● ▮</span></header>
      <div className="network-status-body">
        <div className="network-status-icon"><img src={assetPath('assets/network-draft3/wifi-off.svg')} alt="" /></div>
        <Heading as="h1" variant="hero" id="network-status-title" data-node-id="4047:6443">没有网络</Heading>
        <p id="network-status-description">请检查网络设置或稍后重试</p>
        <Button ref={retryRef} onClick={retry}>重试</Button>
      </div>
    </section>}
  </>
}
