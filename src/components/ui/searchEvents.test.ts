import { describe, expect, it, vi } from 'vitest'
import { submitSearchOnEnter } from './searchEvents'

describe('explicit search submission', () => {
  const keyEvent = (key = 'Enter') => ({ key, defaultPrevented: false, nativeEvent: { isComposing: false, keyCode: 13 }, preventDefault: vi.fn() })

  it('submits Enter once and prevents the enclosing form from submitting again', () => {
    const event = keyEvent(); const search = vi.fn()
    submitSearchOnEnter(event, false, search)
    expect(search).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it.each(['composition-ref', 'native-composing', 'ime-keycode'])('never submits IME confirmation (%s)', mode => {
    const event = keyEvent(); const search = vi.fn()
    event.nativeEvent.isComposing = mode === 'native-composing'
    if (mode === 'ime-keycode') event.nativeEvent.keyCode = 229
    submitSearchOnEnter(event, mode === 'composition-ref', search)
    expect(search).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('does not submit while typing or clearing, or override a caller-prevented event', () => {
    const search = vi.fn()
    for (const key of ['a', 'Backspace', 'Delete', 'Escape']) submitSearchOnEnter(keyEvent(key), false, search)
    submitSearchOnEnter({ ...keyEvent(), defaultPrevented: true }, false, search)
    expect(search).not.toHaveBeenCalled()
  })

  it('leaves keyboard handling alone when no search action exists', () => {
    const event = keyEvent()
    submitSearchOnEnter(event, false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
