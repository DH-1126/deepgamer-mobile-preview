import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { usePendingOrderSummary } from './usePendingOrderSummary'
import { pendingOrderStore } from '../repository/pendingOrderStore'

const state = vi.hoisted(() => ({ authenticated: false, linked: false }))
vi.mock('./AuthAccess', () => ({ useAuthStatus: () => state.authenticated }))
vi.mock('../runtime/dataMode', () => ({ get isLinkedDataMode() { return state.linked }, getRuntimeStorage: () => ({ getItem: () => null, setItem: () => undefined }) }))

function Summary() { return <span>{usePendingOrderSummary().totalPendingCount}</span> }

describe('pending-order subscription access', () => {
  it.each(['guest', 'linked'])('does not read prototype orders in %s mode', mode => {
    state.authenticated = mode !== 'guest'; state.linked = mode === 'linked'
    const read = vi.spyOn(pendingOrderStore, 'getSnapshot')
    expect(renderToStaticMarkup(<Summary />)).toBe('<span>0</span>')
    expect(read).not.toHaveBeenCalled()
    read.mockRestore()
  })
})
