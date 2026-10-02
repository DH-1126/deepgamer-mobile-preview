import { afterEach, describe, expect, it, vi } from 'vitest'
import type { createRestoredLinkedTransport } from './restoredLinkedTransport'
import { createRestoredSellerController } from './useRestoredSeller'
import type { RestoredSeller } from './restoredSellerApi'

type Transport = ReturnType<typeof createRestoredLinkedTransport>

const seller = (rowVersion: number): RestoredSeller => ({
  id: 'seller-1', sellerRef: 'seller-ref-1', displayName: '演示卖家', status: 'PENDING', contractStatus: 'UNSIGNED', rowVersion,
  application: null, applicationId: null, reviewReason: null, submittedAt: null, reviewedAt: null, provenance: null, signature: null, canPublish: false,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((next, fail) => { resolve = next; reject = fail })
  return { promise, resolve, reject }
}

afterEach(() => vi.useRealTimers())

describe('restored seller polling controller', () => {
  it('polls visible pages at five seconds, retains stale data and backs off failures at 5/10/20/30 seconds', async () => {
    vi.useFakeTimers()
    const reads = [
      () => Promise.resolve(seller(1)),
      () => Promise.reject(new Error('暂时断网 1')),
      () => Promise.reject(new Error('暂时断网 2')),
      () => Promise.reject(new Error('暂时断网 3')),
      () => Promise.reject(new Error('暂时断网 4')),
      () => Promise.resolve(seller(2)),
    ]
    const read = vi.fn(() => reads.shift()!())
    const controller = createRestoredSellerController({} as Transport, { read })

    await controller.start()
    expect(controller.getSnapshot()).toEqual({ seller: seller(1), loading: false, error: null })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(controller.getSnapshot().seller).toEqual(seller(1))
    expect(controller.getSnapshot().error).toMatch(/上次数据.*已过期.*暂时断网/)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(read).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(read).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(read).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(read).toHaveBeenCalledTimes(5)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(read).toHaveBeenCalledTimes(6)
    expect(controller.getSnapshot()).toEqual({ seller: seller(2), loading: false, error: null })
    controller.stop()
  })

  it('keeps the stale error visible while an explicit refresh is still unresolved', async () => {
    const next = deferred<RestoredSeller>()
    const read = vi.fn().mockResolvedValueOnce(seller(1)).mockRejectedValueOnce(new Error('暂时断网')).mockImplementationOnce(() => next.promise)
    const controller = createRestoredSellerController({} as Transport, { read })
    await controller.start()
    await controller.refresh()
    const refreshing = controller.refresh()
    expect(controller.getSnapshot().error).toMatch(/已过期/)
    expect(controller.getSnapshot().seller).toEqual(seller(1))
    next.resolve(seller(2))
    await refreshing
    expect(controller.getSnapshot()).toEqual({ seller: seller(2), loading: false, error: null })
    controller.stop()
  })

  it('does not let a late request replace a newer explicit refresh', async () => {
    const old = deferred<RestoredSeller>()
    const read = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValueOnce(seller(2))
    const controller = createRestoredSellerController({} as Transport, { read })

    const starting = controller.start()
    await controller.refresh()
    expect(controller.getSnapshot().seller).toEqual(seller(2))
    old.resolve(seller(1))
    await starting
    expect(controller.getSnapshot().seller).toEqual(seller(2))
    controller.stop()
  })

  it('pauses polling while hidden and refreshes immediately when visible again', async () => {
    vi.useFakeTimers()
    const read = vi.fn().mockResolvedValue(seller(1))
    const controller = createRestoredSellerController({} as Transport, { read })
    await controller.start()
    controller.setVisible(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).toHaveBeenCalledTimes(1)
    await controller.setVisible(true)
    expect(read).toHaveBeenCalledTimes(2)
    controller.stop()
  })
})
