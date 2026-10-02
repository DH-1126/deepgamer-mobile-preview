import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
it('holds restored routes at the explicit connection gate rather than prototype onboarding', async () => {
  vi.stubEnv('VITE_DATA_MODE', 'restored-linked')
  const { App } = await import('./App')
  const html = renderToStaticMarkup(<StaticRouter location="/profile"><App /></StaticRouter>)
  expect(html).toContain('正在连接本地联动')
  expect(html).toContain('本地演示，可写入本地数据')
  expect(html).not.toContain('欢迎来到')
})

it('routes restored recycle entry to save-only requests and exposes the owner request URL', async () => {
  vi.stubEnv('VITE_DATA_MODE', 'restored-linked')
  vi.doMock('../linked/RestoredClientProvider', () => ({
    RestoredClientProvider: ({ children }: { children: React.ReactNode }) => children,
    RestoredConnectionBoundary: ({ children }: { children: React.ReactNode }) => children,
    useRestoredClient: () => ({ transport: null }),
  }))
  const { App } = await import('./App')
  const home = renderToStaticMarkup(<StaticRouter location="/recycle"><App /></StaticRouter>)
  const owner = renderToStaticMarkup(<StaticRouter location="/recycle/requests/request-1"><App /></StaticRouter>)
  expect(home).toContain('保存回收资料')
  expect(home).not.toContain('确认并逐商提交')
  expect(owner).toContain('已保存回收请求')
  expect(owner).toContain('分发给新回收商')
  vi.doUnmock('../linked/RestoredClientProvider')
})

it('routes restored owned order list and detail without rendering prototype order actions', async () => {
  vi.stubEnv('VITE_DATA_MODE', 'restored-linked')
  vi.doMock('../linked/RestoredClientProvider', () => ({
    RestoredClientProvider: ({ children }: { children: React.ReactNode }) => children,
    RestoredConnectionBoundary: ({ children }: { children: React.ReactNode }) => children,
    useRestoredClient: () => ({ transport: null }),
  }))
  const { App } = await import('./App')
  const list = renderToStaticMarkup(<StaticRouter location="/orders"><App /></StaticRouter>)
  const detail = renderToStaticMarkup(<StaticRouter location="/orders/order-1"><App /></StaticRouter>)
  expect(list).toContain('本人买卖订单')
  expect(detail).toContain('订单详情')
  expect(list + detail).not.toMatch(/(?:去支付|取消订单|申请售后)/)
  vi.doUnmock('../linked/RestoredClientProvider')
})

it('routes restored public purchase, quote confirmation, and same-order payment without prototype pages', async () => {
  vi.stubEnv('VITE_DATA_MODE', 'restored-linked')
  vi.doMock('../linked/RestoredClientProvider', () => ({
    RestoredClientProvider: ({ children }: { children: React.ReactNode }) => children,
    RestoredConnectionBoundary: ({ children }: { children: React.ReactNode }) => children,
    useRestoredClient: () => ({ transport: null }),
  }))
  const { App } = await import('./App')
  const catalog = renderToStaticMarkup(<StaticRouter location="/buy"><App /></StaticRouter>)
  const checkout = renderToStaticMarkup(<StaticRouter location="/buy/confirm?goodsId=harness-purchase-goods&amp;package=STANDARD"><App /></StaticRouter>)
  const payment = renderToStaticMarkup(<StaticRouter location="/orders/order-1/payment"><App /></StaticRouter>)
  expect(catalog).toContain('购买账号')
  expect(checkout).toContain('购买确认')
  expect(payment).toContain('本地模拟支付')
  expect(catalog + checkout + payment).not.toContain('订单与支付暂未接入联动')
  vi.doUnmock('../linked/RestoredClientProvider')
})
