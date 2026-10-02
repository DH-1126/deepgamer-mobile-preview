import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const transport = vi.hoisted(() => ({
  read: vi.fn(async (path: string, parse: (value: unknown) => unknown) => {
    const value = path === '/client/recycle/profile-requests' ? { requests: [] } : path === '/client/recycle/catalog' ? [] : null
    return { data: parse(value) }
  }),
  write: vi.fn(),
}))

vi.mock('../linked/RestoredClientProvider', () => ({ useRestoredClient: () => ({ transport }) }))

import { RestoredRecycleNewMerchantView, RestoredRecycleRequestPage } from './RestoredRecycleRequestPages'
import type { RestoredRecycleNewMerchantSnapshot } from '../linked/restoredRecycleDistributionController'

class TestNode {
  parentNode: TestNode | null = null
  childNodes: TestNode[] = []
  ownerDocument: TestDocument
  private readonly listeners = new Map<string, { listener: EventListener; capture: boolean }[]>()
  constructor(readonly nodeType: number, ownerDocument: TestDocument) { this.ownerDocument = ownerDocument }
  appendChild<T extends TestNode>(child: T): T { child.parentNode = this; this.childNodes.push(child); return child }
  insertBefore<T extends TestNode>(child: T, before: TestNode | null): T {
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : -1
    if (index < 0) this.childNodes.push(child); else this.childNodes.splice(index, 0, child)
    return child
  }
  removeChild<T extends TestNode>(child: T): T { this.childNodes = this.childNodes.filter(item => item !== child); child.parentNode = null; return child }
  get firstChild() { return this.childNodes[0] ?? null }
  get textContent(): string { return this.childNodes.map(child => child.textContent).join('') }
  set textContent(value: string) { this.childNodes = value ? [new TestText(value, this.ownerDocument)] : [] }
  addEventListener(type: string, listener: EventListener, options?: boolean | AddEventListenerOptions) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture)
    this.listeners.set(type, [...this.listeners.get(type) ?? [], { listener, capture }])
  }
  removeEventListener(type: string, listener: EventListener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item.listener !== listener)) }
  dispatchEvent(event: TestEvent) {
    if (!event.target) event.target = this
    const path: TestNode[] = []; for (let node: TestNode | null = this; node; node = node.parentNode) path.push(node)
    for (const node of [...path].reverse()) for (const item of node.listeners.get(event.type) ?? []) if (item.capture) item.listener.call(node, event as unknown as Event)
    for (const node of path) for (const item of node.listeners.get(event.type) ?? []) if (!item.capture) item.listener.call(node, event as unknown as Event)
    return !event.defaultPrevented
  }
}

class TestEvent {
  target: TestNode | null = null
  currentTarget: TestNode | null = null
  defaultPrevented = false
  cancelBubble = false
  returnValue = true
  readonly bubbles = true
  readonly cancelable = true
  readonly button = 0
  readonly timeStamp = Date.now()
  constructor(readonly type: string) {}
  preventDefault() { this.defaultPrevented = true; this.returnValue = false }
  stopPropagation() { this.cancelBubble = true }
}

class TestText extends TestNode {
  constructor(public nodeValue: string, ownerDocument: TestDocument) { super(3, ownerDocument) }
  override get textContent() { return this.nodeValue }
  override set textContent(value: string) { this.nodeValue = value }
}

class TestElement extends TestNode {
  readonly nodeName: string
  readonly tagName: string
  readonly namespaceURI: string
  readonly style: Record<string, string> = {}
  private readonly attributes = new Map<string, string>()
  constructor(tagName: string, ownerDocument: TestDocument, namespaceURI = 'http://www.w3.org/1999/xhtml') {
    super(1, ownerDocument); this.tagName = tagName.toUpperCase(); this.nodeName = this.tagName; this.namespaceURI = namespaceURI
  }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)) }
  removeAttribute(name: string) { this.attributes.delete(name) }
  hasAttribute(name: string) { return this.attributes.has(name) }
  get options(): TestElement[] {
    const rows: TestElement[] = []
    const visit = (node: TestNode) => { if (node instanceof TestElement && node.tagName === 'OPTION') rows.push(node); node.childNodes.forEach(visit) }
    this.childNodes.forEach(visit); return rows
  }
  focus() { this.ownerDocument.activeElement = this }
  click() { this.dispatchEvent(new TestEvent('click')) }
}

class TestDocument extends TestNode {
  readonly nodeName = '#document'
  readonly documentElement: TestElement
  readonly body: TestElement
  activeElement: TestElement
  defaultView!: Record<string, unknown>
  constructor() {
    super(9, null as unknown as TestDocument); this.ownerDocument = this
    this.documentElement = new TestElement('html', this); this.body = new TestElement('body', this); this.documentElement.appendChild(this.body); this.activeElement = this.body
  }
  createElement(tagName: string) { return new TestElement(tagName, this) }
  createElementNS(namespaceURI: string, tagName: string) { return new TestElement(tagName, this, namespaceURI) }
  createTextNode(value: string) { return new TestText(value, this) }
  createComment(value: string) { const node = new TestText(value, this); Object.defineProperty(node, 'nodeType', { value: 8 }); return node }
}

const originalGlobals = new Map<string, PropertyDescriptor | undefined>()
function installDom() {
  const document = new TestDocument()
  class TestFrame extends TestElement {}
  const window = { document, HTMLIFrameElement: TestFrame, HTMLElement: TestElement, Node: TestNode, getComputedStyle: () => ({}) }
  document.defaultView = window
  for (const [key, value] of Object.entries({ window, document, Node: TestNode, HTMLElement: TestElement, HTMLIFrameElement: TestFrame, navigator: { userAgent: 'vitest' }, IS_REACT_ACT_ENVIRONMENT: true })) {
    originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  return document
}

afterEach(() => {
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key)
  }
  originalGlobals.clear(); transport.read.mockClear(); transport.write.mockClear()
})

describe('restored recycle request client mount', () => {
  it('mounts the real request page without a useSyncExternalStore snapshot loop', async () => {
    const document = installDom()
    const container = document.createElement('div')
    const root = createRoot(container as unknown as Element)
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/recycle']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><RestoredRecycleRequestPage /></MemoryRouter>)
      await Promise.resolve(); await Promise.resolve()
    })
    expect(container.textContent).toContain('保存回收资料')
    expect(container.textContent).toContain('尚无已保存的回收请求')
    await act(async () => root.unmount())
  })

  it('moves focus into the new-merchant confirmation and restores it when selection resumes', async () => {
    const document = installDom()
    const container = document.createElement('div')
    const root = createRoot(container as unknown as Element)
    const revision = { revisionId: 'revision-2', requestId: 'request-1', revisionNumber: 2, profileVersion: 2, gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: 'a'.repeat(64), profileFields: [], attachments: [], createdAt: '2026-09-28T02:00:00.000Z' }
    const confirmation = { revisionId: 'revision-2', profileVersion: 2, selectedRecyclerIds: ['shop-1'], selectedRecyclerNames: ['新商家甲'] }
    const base: RestoredRecycleNewMerchantSnapshot = { loading: false, error: null, accessLost: false, context: null, revisions: [revision], selectedRevisionId: 'revision-2', availableRecyclers: [{ recyclerId: 'shop-1', displayName: '新商家甲', eligible: true, blockedReason: null }], selectedRecyclerIds: ['shop-1'], confirmation: null, confirmationState: 'idle', confirmationRetryable: false, targets: [], busy: false }
    function FocusHarness() {
      const [review, setReview] = useState(false)
      return <RestoredRecycleNewMerchantView snapshot={{ ...base, confirmation: review ? confirmation : null }} onSelectRevision={() => undefined} onRecyclerToggle={() => undefined} onRequestConfirmation={() => setReview(true)} onCancelConfirmation={() => setReview(false)} onConfirm={() => undefined} onCheckUnknownConfirmation={() => undefined} onRetryConfirmation={() => undefined} onCheckUnknownTarget={() => undefined} onRetryTarget={() => undefined} onFinish={() => undefined} onRefresh={() => undefined} />
    }
    const findButton = (label: string) => {
      const visit = (node: TestNode): TestElement | undefined => node instanceof TestElement && node.tagName === 'BUTTON' && node.textContent === label ? node : node.childNodes.map(visit).find(Boolean)
      return visit(container)
    }
    await act(async () => root.render(<FocusHarness />))
    const reviewButton = findButton('核对版本与新商家名单')
    expect(reviewButton).toBeDefined()
    await act(async () => reviewButton!.click())
    expect(document.activeElement.textContent).toBe('返回选择')
    const cancelButton = findButton('返回选择')
    expect(cancelButton).toBeDefined()
    await act(async () => cancelButton!.click())
    expect(document.activeElement.textContent).toBe('核对版本与新商家名单')
    await act(async () => root.unmount())
  })
})
