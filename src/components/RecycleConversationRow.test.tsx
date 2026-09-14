import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRecycleOrder } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { RecycleConversationRow } from './RecycleConversationRow'

afterEach(() => vi.restoreAllMocks())

describe('RecycleConversationRow', () => {
  const base = createRecycleOrder(recyclerFixtures[0], 2_000_000_000_000)
  it('shows the contact nickname, conversation status and shared unread badge', () => {
    const html = renderToStaticMarkup(<RecycleConversationRow item={{ ...base, contactName: '买家1', unreadCount: 3 }} onOpen={vi.fn()} />)
    expect(html).toContain('<b>买家1</b>')
    expect(html).toContain('>沟通中</em>')
    expect(html).toContain('class="message-d3-badge communicating"')
    expect(html).toContain('3条未读')
    expect(html).toMatch(/message-d3-meta"><span data-ui="CountBadge"/)
  })
  it('keeps the placed status visible after completion and hides only a read badge', () => {
    const html = renderToStaticMarkup(<RecycleConversationRow item={{ ...base, stage: 'completed', contactName: '回收商4', unreadCount: 0 }} onOpen={vi.fn()} />)
    expect(html).toContain('<b>回收商4</b>')
    expect(html).toContain('class="message-d3-badge">已下单</em>')
    expect(html).not.toContain('message-d3-badge communicating')
    expect(html).toContain('>已下单</em>')
    expect(html).not.toContain('data-ui="CountBadge"')
    expect(html).not.toContain('stage-closed')
  })
  it.each([false, true])('only shows the avatar type badge when requested: %s', showTypeBadge => {
    const html = renderToStaticMarkup(<RecycleConversationRow item={base} showTypeBadge={showTypeBadge} onOpen={vi.fn()} />)
    expect(html.includes('<em data-kind="recycle">回收</em>')).toBe(showTypeBadge)
  })
  it.each([
    [new Date(2026, 8, 14, 9, 5).getTime(), '09:05'],
    [new Date(2026, 8, 13, 10).getTime(), '昨天'],
    [new Date(2026, 8, 12, 10).getTime(), '09-12'],
    [new Date(2025, 8, 12, 10).getTime(), '2025'],
  ])('uses the shared message time format for %s', (updatedAt, label) => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 14, 12).getTime())
    const html = renderToStaticMarkup(<RecycleConversationRow item={{ ...base, updatedAt }} onOpen={vi.fn()} />)
    expect(html).toContain(`<time>${label}</time>`)
  })
})
