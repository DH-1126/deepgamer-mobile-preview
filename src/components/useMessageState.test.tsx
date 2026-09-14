import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMessageUnreadCount } from './useMessageState'
import { messageRepository } from '../repository/messageRepository'
import { recycleRepository } from '../repository/recycleRepository'

const state = vi.hoisted(() => ({ authenticated: true, linked: false }))
vi.mock('./AuthAccess', () => ({ useAuthStatus: () => state.authenticated }))
vi.mock('../runtime/dataMode', () => ({ get isLinkedDataMode() { return state.linked }, getRuntimeStorage: () => ({ getItem: () => null, setItem: () => undefined }) }))

function Count() { return <span>{useMessageUnreadCount()}</span> }

describe('shared navigation message state', () => {
  beforeEach(() => { state.authenticated = true; state.linked = false })

  it.each(['guest', 'linked'])('does not read or seed demo messages in %s state', mode => {
    state.authenticated = mode !== 'guest'
    state.linked = mode === 'linked'
    const read = vi.spyOn(messageRepository, 'getSnapshot')
    const readRecycle = vi.spyOn(recycleRepository, 'getUnreadCount')
    expect(renderToStaticMarkup(<Count />)).toBe('<span>0</span>')
    expect(read).not.toHaveBeenCalled()
    expect(readRecycle).not.toHaveBeenCalled()
    read.mockRestore()
    readRecycle.mockRestore()
  })
})
