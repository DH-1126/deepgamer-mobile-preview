import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react'
import { createRestoredClientController, initialRestoredClientSnapshot, type RestoredClientSnapshot } from './restoredClientController'
import { Button, Heading, Spinner, SurfaceCard } from '../components/ui'

type RestoredClientContextValue = RestoredClientSnapshot & { reconnect: () => void }
const unavailable: RestoredClientContextValue = { ...initialRestoredClientSnapshot, reconnect: () => {} }
const RestoredClientContext = createContext<RestoredClientContextValue>(unavailable)

export function useRestoredClient() { return useContext(RestoredClientContext) }

export function RestoredClientProvider({ children }: PropsWithChildren) {
  const [controller] = useState(createRestoredClientController)
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => { void controller.connect(); return () => controller.disconnect() }, [controller])
  return <RestoredClientContext.Provider value={{ ...state, reconnect: () => { void controller.connect() } }}>{children}</RestoredClientContext.Provider>
}

export function RestoredConnectionBoundary({ children }: PropsWithChildren) {
  const state = useRestoredClient()
  if (state.status === 'ready' && state.connection && state.transport) return <>{children}</>
  return <main className="linked-connection-state"><SurfaceCard>
    <Heading as="h1" variant="result">{state.status === 'error' ? '本地联动未连接' : '正在连接本地联动'}</Heading>
    {state.status === 'error' ? <><p role="alert">{state.error}</p><Button onClick={state.reconnect}>重新连接</Button></> : <p role="status"><Spinner decorative />正在核验运行版本与演示身份…</p>}
    <p>本地演示，可写入本地数据。支付、签署等外部服务均不是真实操作。</p>
    <small>连接失败时不会使用原型资料或管理员身份代替。</small>
  </SurfaceCard></main>
}
