import { describe, expect, it } from 'vitest'
import { isNetworkPreviewOffline, removeNetworkPreview, shouldShowNetworkOverlay } from './NetworkStatusBoundary'

describe('NetworkStatusBoundary query preview', () => {
  it('only treats the explicit offline value as a forced offline state', () => {
    expect(isNetworkPreviewOffline('?network=offline')).toBe(true)
    expect(isNetworkPreviewOffline('?tab=orders&network=offline')).toBe(true)
    expect(isNetworkPreviewOffline('?network=online')).toBe(false)
    expect(isNetworkPreviewOffline('')).toBe(false)
  })

  it('removes only the network preview parameter on retry', () => {
    expect(removeNetworkPreview('?network=offline')).toBe('')
    expect(removeNetworkPreview('?network=offline&tab=orders')).toBe('?tab=orders')
    expect(removeNetworkPreview('?tab=orders&network=offline&sort=recent')).toBe('?tab=orders&sort=recent')
  })

  it('shows for either a real offline signal or the explicit preview', () => {
    expect(shouldShowNetworkOverlay('', false)).toBe(true)
    expect(shouldShowNetworkOverlay('?network=offline', true)).toBe(true)
    expect(shouldShowNetworkOverlay('?tab=orders', true)).toBe(false)
  })
})
