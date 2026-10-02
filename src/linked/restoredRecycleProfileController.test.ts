import { afterEach, describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'
import type { RecycleConsultation } from './restoredRecycleApi'
import { createRestoredRecycleProfileController } from './restoredRecycleProfileController'

const revokedText = '该资料已因安全原因停用，请重新填写'
const consultation = (id = 'consult-1'): RecycleConsultation => ({
  id,
  clientSubmissionId: 'submission-123',
  gameCode: 'wzry',
  profileVersion: 1,
  profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }],
  fieldTemplateVersion: 3,
  fieldSchemaHash: 'a'.repeat(64),
  recyclerId: 'shop-1',
  conversationId: 'conversation-1',
  status: 'SENT',
  attachments: [],
  createdAt: '2026-09-24T01:00:00.000Z',
})
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(ok => { resolve = ok }); return { promise, resolve } }
function scheduler() {
  const tasks: Array<{ delay: number; run: () => void; cancelled: boolean }> = []
  return {
    tasks,
    schedule(run: () => void, delay: number) {
      const task = { delay, run, cancelled: false }
      tasks.push(task)
      return () => { task.cancelled = true }
    },
    async runLast() { const task = tasks.at(-1); if (task && !task.cancelled) { task.run(); await Promise.resolve(); await Promise.resolve() } },
  }
}
afterEach(() => vi.restoreAllMocks())

describe('restored recycle profile polling controller', () => {
  it('reads the generic initial profile and falls back to old v1 only for the explicit legacy-only code', async () => {
    const initial = {
      consultationId: 'consult-1', clientSubmissionId: 'submission-123', requestId: 'request-1', revisionId: 'revision-2', profileVersion: 2,
      gameCode: 'wzry', profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], fieldTemplateVersion: 3,
      fieldSchemaHash: 'a'.repeat(64), recyclerId: 'shop-1', conversationId: 'conversation-1', attachments: [], status: 'SENT' as const,
      createdAt: '2026-09-24T01:00:00.000Z', deliveredAt: '2026-09-28T03:00:00.000Z',
    }
    const modernApi = { readInitialProfile: vi.fn().mockResolvedValue(initial), readConsultation: vi.fn() }
    const modern = createRestoredRecycleProfileController('consult-1', modernApi)
    await modern.start()
    expect(modern.getSnapshot().consultation).toMatchObject({ id: 'consult-1', requestId: 'request-1', revisionId: 'revision-2', profileVersion: 2 })
    expect(modernApi.readConsultation).not.toHaveBeenCalled()
    modern.stop()

    const legacyApi = { readInitialProfile: vi.fn().mockRejectedValue(new RestoredHttpError(409, 'RECYCLE_PROFILE_LEGACY_ONLY', '旧资料')), readConsultation: vi.fn().mockResolvedValue(consultation()) }
    const legacy = createRestoredRecycleProfileController('consult-1', legacyApi)
    await legacy.start()
    expect(legacy.getSnapshot().consultation).toMatchObject({ id: 'consult-1', profileVersion: 1 })
    expect(legacyApi.readConsultation).toHaveBeenCalledTimes(1)
    legacy.stop()

    const forbiddenApi = { readInitialProfile: vi.fn().mockRejectedValue(new RestoredHttpError(403, 'FORBIDDEN', '无权查看')), readConsultation: vi.fn() }
    const forbidden = createRestoredRecycleProfileController('consult-1', forbiddenApi)
    await forbidden.start()
    expect(forbidden.getSnapshot()).toMatchObject({ consultation: null, error: '无权查看' })
    expect(forbiddenApi.readConsultation).not.toHaveBeenCalled()
    forbidden.stop()
  })

  it('polls visible pages at five seconds, pauses hidden pages, refreshes on foreground and backs off to thirty seconds', async () => {
    const clock = scheduler()
    const readConsultation = vi.fn()
      .mockResolvedValueOnce(consultation())
      .mockRejectedValueOnce(new Error('断网 1'))
      .mockRejectedValueOnce(new Error('断网 2'))
      .mockRejectedValueOnce(new Error('断网 3'))
      .mockRejectedValueOnce(new Error('断网 4'))
      .mockResolvedValue(consultation('consult-fresh'))
    const controller = createRestoredRecycleProfileController('consult-1', { readConsultation }, { schedule: clock.schedule })
    await controller.start()
    expect(clock.tasks.at(-1)?.delay).toBe(5_000)
    for (const delay of [5_000, 10_000, 20_000, 30_000]) {
      await clock.runLast()
      expect(clock.tasks.at(-1)?.delay).toBe(delay)
      expect(controller.getSnapshot()).toMatchObject({ consultation: { id: 'consult-1' }, stale: true, error: expect.stringContaining('断网') })
    }
    await controller.setVisible(false)
    const hiddenCalls = readConsultation.mock.calls.length
    await clock.runLast()
    expect(readConsultation).toHaveBeenCalledTimes(hiddenCalls)
    await controller.setVisible(true)
    expect(controller.getSnapshot()).toMatchObject({ consultation: { id: 'consult-fresh' }, stale: false, error: null })
    controller.stop()
  })

  it('clears visible values immediately on revocation or lost access, but does not turn a network failure into success', async () => {
    for (const error of [
      new RestoredHttpError(409, 'RECYCLE_PROFILE_REVOKED', revokedText),
      new RestoredHttpError(409, 'RECYCLE_CONSULTATION_RELATION_INVALID', '回收咨询关联异常'),
      new RestoredHttpError(403, 'FORBIDDEN', '无权查看'),
    ]) {
      const clock = scheduler()
      const readConsultation = vi.fn().mockResolvedValueOnce(consultation()).mockRejectedValueOnce(error)
      const controller = createRestoredRecycleProfileController('consult-1', { readConsultation }, { schedule: clock.schedule })
      await controller.start()
      await clock.runLast()
      expect(controller.getSnapshot().consultation).toBeNull()
      expect(controller.getSnapshot().error).toContain(error.code === 'RECYCLE_PROFILE_REVOKED' ? revokedText : error.code === 'RECYCLE_CONSULTATION_RELATION_INVALID' ? '关联异常' : '无权')
      controller.stop()
    }
  })

  it('ignores a late request after identity replacement or unmount', async () => {
    const late = deferred<RecycleConsultation>()
    const first = createRestoredRecycleProfileController('consult-old', { readConsultation: () => late.promise })
    const starting = first.start()
    first.stop()
    const next = createRestoredRecycleProfileController('consult-new', { readConsultation: vi.fn().mockResolvedValue(consultation('consult-new')) })
    await next.start()
    late.resolve(consultation('consult-old'))
    await starting
    expect(first.getSnapshot().consultation).toBeNull()
    expect(next.getSnapshot().consultation?.id).toBe('consult-new')
    next.stop()
  })
})
