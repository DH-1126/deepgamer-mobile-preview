import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ status: 'loading', connection: null as object | null, transport: null as object | null }))
vi.mock('../runtime/dataMode', () => ({ isLinkedDataMode: false, isRestoredLinkedMode: true }))
vi.mock('../repository/authRepository', () => ({ authRepository: { subscribe: () => () => {}, isAuthenticated: () => true } }))
vi.mock('../linked/RestoredClientProvider', () => ({ useRestoredClient: () => state, RestoredConnectionBoundary: () => null }))
import { useAuthStatus } from './AuthAccess'
function Status() { return <span>{useAuthStatus() ? 'bound' : 'unbound'}</span> }
beforeEach(() => Object.assign(state, { status: 'loading', connection: null, transport: null }))
describe('restored authentication does not inherit mock login', () => {
  it.each(['loading', 'error'])('keeps %s actor unbound even when the prototype is logged in', status => {
    state.status = status
    expect(renderToStaticMarkup(<Status />)).toBe('<span>unbound</span>')
  })
  it('requires both a ready connection and its isolated transport', () => {
    state.status = 'ready'; state.connection = {}
    expect(renderToStaticMarkup(<Status />)).toBe('<span>unbound</span>')
    state.transport = {}
    expect(renderToStaticMarkup(<Status />)).toBe('<span>bound</span>')
  })
})
