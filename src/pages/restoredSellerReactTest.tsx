import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { RestoredClientProvider, RestoredConnectionBoundary } from '../linked/RestoredClientProvider'
import { SellerCenterPage } from './SellerContractPages'
import type { RestoredSeller } from '../linked/restoredSellerApi'

const runtime = { status: 'ready', service: 'restoration-admin-api', runtimeId: 'restoration-0123456789abcdef', sourceSha256: 'a'.repeat(64), contract: { version: 'test', sourceSha256: 'b'.repeat(64) }, builtAt: '2026-09-23T10:00:00.000Z' }
const actor = { managementId: 'synthetic-seller', displayName: '合成卖家', sellerRef: 'seller-ref-1', recyclerId: null }
const application = {
  subject: 'personal' as const, applicationName: '合成卖家', idNumber: '110101199001011234', contactName: '合成联系人', contactPhone: '13800138000',
  takeoutOrderMediaId: 'media-takeout', emergencyName: '合成紧急联系人', emergencyPhone: '13900139000', idFrontMediaId: 'media-front', idBackMediaId: 'media-back',
}

function approvedSeller(): RestoredSeller {
  return { id: actor.managementId, sellerRef: actor.sellerRef, displayName: actor.displayName, status: 'APPROVED', contractStatus: 'UNSIGNED', rowVersion: 3, application, applicationId: 'application-1', reviewReason: null, submittedAt: '2026-09-23T00:00:00.000Z', reviewedAt: '2026-09-23T00:01:00.000Z', provenance: 'LOCAL_DEMO', signature: null, canPublish: false }
}

function button(root: HTMLElement, label: string) {
  const match = [...root.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!match) throw new Error(`未找到交互按钮：${label}`)
  return match
}

async function flush() {
  await act(async () => { await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); await Promise.resolve() })
}

function requireText(root: HTMLElement, text: string) {
  if (!root.textContent?.includes(text)) throw new Error(`页面未显示：${text}`)
}

/** Browser/Electron runner: mounts the actual Provider + seller page and drives clicks through a synthetic local-only API. */
export async function runRestoredSellerReactTest() {
  const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const previousAct = globals.IS_REACT_ACT_ENVIRONMENT
  const previousFetch = globalThis.fetch
  globals.IS_REACT_ACT_ENVIRONMENT = true
  let seller = approvedSeller()
  let taskSequence = 0
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    if (path.endsWith('/health/runtime')) return Response.json({ data: runtime })
    if (path.endsWith('/client/session')) return Response.json({ data: { mode: 'LOCAL_DEMO', actor, csrfToken: 'test-client-csrf', expiresAt: '2099-01-01T00:00:00.000Z' } })
    if (path.endsWith('/client/session/me')) return Response.json({ data: { mode: 'LOCAL_DEMO', actor } })
    if (path.endsWith('/client/seller/signature') && init?.method === 'POST') {
      taskSequence += 1
      seller = { ...seller, rowVersion: seller.rowVersion + 1, signature: { id: `signature-${taskSequence}`, applicationId: 'application-1', provenance: 'LOCAL_DEMO', status: 'PENDING', rowVersion: 1, createdAt: '2026-09-23T00:02:00.000Z', updatedAt: '2026-09-23T00:02:00.000Z' } }
      return Response.json({ data: seller })
    }
    if (/\/client\/seller\/signature\/signature-\d+\/simulate$/u.test(path) && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { result: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' }
      seller = {
        ...seller,
        rowVersion: seller.rowVersion + 1,
        contractStatus: body.result === 'SUCCEEDED' ? 'SIGNED' : 'UNSIGNED',
        signature: { ...seller.signature!, status: body.result, rowVersion: seller.signature!.rowVersion + 1 },
        canPublish: body.result === 'SUCCEEDED',
      }
      return Response.json({ data: seller })
    }
    if (path.endsWith('/client/seller')) return Response.json({ data: seller })
    return Response.json({ code: 'NOT_FOUND', detail: `Unexpected test path ${path}` }, { status: 404 })
  }
  const mount = document.createElement('div')
  document.body.append(mount)
  const root = createRoot(mount)
  try {
    await act(async () => { root.render(<RestoredClientProvider><RestoredConnectionBoundary><MemoryRouter initialEntries={['/seller/center']}><SellerCenterPage /></MemoryRouter></RestoredConnectionBoundary></RestoredClientProvider>) })
    await flush()
    requireText(mount, '审核已通过')
    await act(async () => button(mount, '去签署协议').click())
    requireText(mount, '本页只创建与回读本地演示签署任务')
    await act(async () => button(mount, '我已阅读说明').click())
    await act(async () => button(mount, '创建本地演示签署任务').click())
    await flush()
    requireText(mount, '待确认模拟结果')
    await act(async () => button(mount, '模拟签署失败').click())
    await flush()
    requireText(mount, '上一次模拟结果为失败')
    await act(async () => button(mount, '创建本地演示签署任务').click())
    await flush()
    requireText(mount, '待确认模拟结果')
    await act(async () => button(mount, '模拟签署失败').click())
    await flush()
    requireText(mount, '上一次模拟结果为失败')
    await act(async () => button(mount, '创建本地演示签署任务').click())
    await flush()
    requireText(mount, '待确认模拟结果')
    await act(async () => button(mount, '模拟签署成功').click())
    await flush()
    requireText(mount, '卖家身份已开通')
    for (const label of ['模拟签署成功', '模拟签署失败', '模拟结果未知']) {
      if ([...mount.querySelectorAll('button')].some(node => node.textContent?.includes(label))) throw new Error(`签署终态仍显示操作：${label}`)
    }
    const links = [...mount.querySelectorAll('a')].map(link => link.getAttribute('href'))
    if (!links.includes('/publish') || !links.includes('/my-goods')) throw new Error('卖家能力链接未指向已挂载路由')
  } finally {
    await act(async () => root.unmount())
    mount.remove()
    globalThis.fetch = previousFetch
    globals.IS_REACT_ACT_ENVIRONMENT = previousAct
  }
}
