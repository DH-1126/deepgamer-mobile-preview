import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { RestoredImConversation, RestoredImMessage } from '../linked/restoredImApi'
import { RestoredConversationView, RestoredMessageListView, canSubmitRestoredMessage, restoredMessageScrollAction, restoredMessageTabFromSearch, senderLabel, shouldSubmitRestoredMessageKey } from './RestoredMessagePages'

const trade: RestoredImConversation = {
  id: 'trade-1', type: 'TRADE_GROUP', status: 'ACTIVE', title: '王者荣耀交易群', myRole: 'BUYER', unreadCount: 2, lastReadSequence: 1, lastSequence: 3,
  canSend: true, sendDisabledReason: null,
  association: { kind: 'TRADE', orderId: 'order-1', orderNo: 'NO-20260924', fulfillment: { id: 'fulfill-1', status: 'RUNNING' } },
  lastMessage: { sequence: 3, type: 'TEXT', summary: '客服正在核对', createdAt: '2026-09-24T01:00:00.000Z' }, updatedAt: '2026-09-24T01:00:00.000Z',
}
const recycle: RestoredImConversation = {
  ...trade, id: 'recycle-1', type: 'RECYCLE_CONSULTATION', title: '回收咨询', unreadCount: 0,
  association: { kind: 'RECYCLE', consultationId: 'consultation-1', recyclerId: 'recycler-1', recycleOrderId: 'recycle-order-1', recycleOrderStatus: 'QUOTED' },
}
const message = (sequence: number, overrides: Partial<RestoredImMessage> = {}): RestoredImMessage => ({
  id: `message-${sequence}`, conversationId: 'trade-1', sequence, type: 'TEXT', senderRole: 'BUYER', senderName: '合成买家', isMine: true,
  content: '请更新进度', unsupportedReason: null, createdAt: '2026-09-24T01:00:00.000Z', clientMessageId: `client-message-${sequence}`, ...overrides,
})
const list = (props: Partial<Parameters<typeof RestoredMessageListView>[0]> = {}) => renderToStaticMarkup(<StaticRouter location="/message"><RestoredMessageListView conversations={[trade, recycle]} loading={false} error={null} query="" tab="all" onQueryChange={vi.fn()} onTabChange={vi.fn()} onRefresh={vi.fn()} {...props} /></StaticRouter>)

describe('restored member message pages', () => {
  it('opens the recycle tab from the query and ignores unsupported tab values', () => {
    expect(restoredMessageTabFromSearch('?tab=recycle')).toBe('recycle')
    expect(restoredMessageTabFromSearch('?tab=trade')).toBe('trade')
    expect(restoredMessageTabFromSearch('?tab=admin')).toBe('all')
  })
  it('keeps initial failure, empty success, and stale data visually distinct', () => {
    const failed = list({ conversations: [], error: '网络不可用' })
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('网络不可用')
    expect(list({ conversations: [], error: null })).toContain('暂无会话')
    const stale = list({ error: '刷新失败，当前显示上次数据（可能已过期）' })
    expect(stale).toContain('可能已过期')
    expect(stale).toContain('王者荣耀交易群')
  })

  it('filters real trade/recycle types without downgrading recycle conversations', () => {
    expect(list({ tab: 'trade' })).toContain('王者荣耀交易群')
    expect(list({ tab: 'trade' })).not.toContain('回收咨询')
    const html = list({ tab: 'recycle' })
    expect(html).toContain('回收咨询')
    expect(html).toContain('回收')
    expect(html).toContain('consultation-1')
    expect(html).toContain('recycle-order-1')
  })

  it('uses server roles/isMine, never labels service as me, and shows safe unsupported summaries only', () => {
    expect(senderLabel(message(1))).toBe('我 · 买家')
    expect(senderLabel(message(2, { senderRole: 'SELLER', senderName: '卖家', isMine: false, clientMessageId: null }))).toBe('卖家 · 卖家')
    expect(senderLabel(message(3, { senderRole: 'SERVICE', senderName: '客服萌萌', isMine: true, clientMessageId: null }))).toBe('客服萌萌 · 平台客服')
    const html = renderToStaticMarkup(<StaticRouter location="/message/trade-1"><RestoredConversationView conversation={trade} messages={[
      message(1),
      message(2, { type: 'IMAGE', senderRole: 'SERVICE', senderName: '客服', isMine: false, content: '图片消息', unsupportedReason: 'MEDIA_NOT_AVAILABLE', clientMessageId: null }),
      message(3, { type: 'CARD', senderRole: 'SYSTEM', senderName: '系统', isMine: false, content: '交易状态卡片', unsupportedReason: 'CARD_CONTENT_NOT_AVAILABLE', clientMessageId: null }),
    ]} loading={false} error={null} hasMore={false} loadingEarlier={false} sending={false} sendState="idle" sendError={null} onLoadEarlier={vi.fn()} onRefresh={vi.fn()} onSend={vi.fn()} onRetryUnknown={vi.fn()} /></StaticRouter>)
    expect(html).toContain('图片消息')
    expect(html).toContain('附件内容暂不支持查看')
    expect(html).toContain('卡片内容暂不支持查看')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('rawPayload')
    expect(html).toContain('NO-20260924')
    expect(html).toContain('RUNNING')
    expect(html).toContain('restored-message-bubble--service')
    expect([...html.matchAll(/class="([^"]*)"/g)].flatMap(match => match[1].split(/\s+/))).not.toContain('service')
  })

  it('disables writes for stale or server-disabled conversations and exposes an accessible composer label/status', () => {
    const closed = { ...trade, status: 'CLOSED' as const, canSend: false, sendDisabledReason: 'CONVERSATION_CLOSED' as const }
    const html = renderToStaticMarkup(<StaticRouter location="/message/trade-1"><RestoredConversationView conversation={closed} messages={[message(1)]} loading={false} error="刷新失败，当前数据可能已过期" hasMore={false} loadingEarlier={false} sending={false} sendState="idle" sendError={null} onLoadEarlier={vi.fn()} onRefresh={vi.fn()} onSend={vi.fn()} onRetryUnknown={vi.fn()} /></StaticRouter>)
    expect(html).toContain('会话已关闭')
    expect(html).toMatch(/<textarea[^>]*aria-label="消息内容"[^>]*disabled=""/)
    expect(html).toContain('aria-live="polite"')
    const suspended = { ...trade, canSend: false, sendDisabledReason: 'FULFILLMENT_NOT_RUNNING' as const, association: { kind: 'TRADE' as const, orderId: 'order-1', orderNo: 'NO-20260924', fulfillment: { id: 'fulfill-1', status: 'SUSPENDED' as const } } }
    const suspendedHtml = renderToStaticMarkup(<StaticRouter location="/message/trade-1"><RestoredConversationView conversation={suspended} messages={[message(1)]} loading={false} error={null} hasMore={false} loadingEarlier={false} sending={false} sendState="idle" sendError={null} onLoadEarlier={vi.fn()} onRefresh={vi.fn()} onSend={vi.fn()} onRetryUnknown={vi.fn()} /></StaticRouter>)
    expect(suspendedHtml).toContain('履约未处于进行中')
    expect(suspendedHtml).toContain('SUSPENDED')
  })

  it('keeps unknown delivery explicit and offers only same-operation retry', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/message/trade-1"><RestoredConversationView conversation={trade} messages={[message(1)]} loading={false} error={null} hasMore={false} loadingEarlier={false} sending={false} sendState="unknown" sendError="发送结果未知，已查询原操作但暂未找到" onLoadEarlier={vi.fn()} onRefresh={vi.fn()} onSend={vi.fn()} onRetryUnknown={vi.fn()} /></StaticRouter>)
    expect(html).toContain('发送结果未知')
    expect(html).toContain('重试原操作')
    expect(html).not.toContain('自动重发')
    expect(html.match(/<textarea[^>]*aria-label="消息内容"[^>]*>/)?.[0]).not.toContain('disabled')
  })

  it('links a recycle conversation to its server consultation ID', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/im/recycle-1"><RestoredConversationView conversation={recycle} messages={[]} loading={false} error={null} hasMore={false} loadingEarlier={false} sending={false} sendState="idle" sendError={null} onLoadEarlier={vi.fn()} onRefresh={vi.fn()} onSend={vi.fn()} onRetryUnknown={vi.fn()} /></StaticRouter>)
    expect(html).toContain('href="/recycle/consultations/consultation-1"')
    expect(html).toContain('查看咨询资料')
  })

  it('scrolls to latest initially and after own send, but preserves reading position for history and background polling', () => {
    expect(restoredMessageScrollAction({ hadMessages: false, latestChanged: true, nearBottom: false, prepending: false, sentCompleted: false })).toBe('latest')
    expect(restoredMessageScrollAction({ hadMessages: true, latestChanged: true, nearBottom: false, prepending: false, sentCompleted: false })).toBe('none')
    expect(restoredMessageScrollAction({ hadMessages: true, latestChanged: true, nearBottom: true, prepending: false, sentCompleted: false })).toBe('latest')
    expect(restoredMessageScrollAction({ hadMessages: true, latestChanged: false, nearBottom: false, prepending: true, loadingEarlier: true, sentCompleted: false })).toBe('defer')
    expect(restoredMessageScrollAction({ hadMessages: true, latestChanged: false, nearBottom: false, prepending: true, sentCompleted: false })).toBe('preserve')
    expect(restoredMessageScrollAction({ hadMessages: true, latestChanged: true, nearBottom: false, prepending: false, sentCompleted: true })).toBe('latest')
  })

  it('submits plain Enter but not Chinese composition or Shift+Enter', () => {
    expect(shouldSubmitRestoredMessageKey({ key: 'Enter', shiftKey: false, isComposing: false })).toBe(true)
    expect(shouldSubmitRestoredMessageKey({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(false)
    expect(shouldSubmitRestoredMessageKey({ key: 'Enter', shiftKey: true, isComposing: false })).toBe(false)
    expect(canSubmitRestoredMessage({ draft: '新稿', sending: false, composerDisabled: false, sendState: 'unknown' })).toBe(false)
    expect(canSubmitRestoredMessage({ draft: '新稿', sending: false, composerDisabled: false, sendState: 'idle' })).toBe(true)
  })
})
