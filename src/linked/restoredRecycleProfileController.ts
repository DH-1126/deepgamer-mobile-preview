import { RestoredHttpError } from './restoredLinkedTransport'
import type { RecycleConsultation, RestoredRecycleApi } from './restoredRecycleApi'
import type { RecycleInitialProfile } from './restoredRecycleDistributionApi'

export type RecycleProfileDisplay = Omit<RecycleConsultation, 'profileVersion'> & { profileVersion: number; requestId?: string; revisionId?: string; deliveredAt?: string }

export type RestoredRecycleProfileSnapshot = {
  consultation: RecycleProfileDisplay | null
  loading: boolean
  error: string | null
  stale: boolean
}

type Schedule = (run: () => void, delay: number) => () => void
const delays = [5_000, 10_000, 20_000, 30_000]
const revokedText = '该资料已因安全原因停用，请重新填写'
const initial = (): RestoredRecycleProfileSnapshot => ({ consultation: null, loading: true, error: null, stale: false })
const defaultSchedule: Schedule = (run, delay) => {
  const timer = setTimeout(run, delay)
  return () => clearTimeout(timer)
}

function accessFailure(error: unknown): string | null {
  if (!(error instanceof RestoredHttpError)) return null
  if (error.status === 409 && error.code === 'RECYCLE_PROFILE_REVOKED') return revokedText
  if (error.status === 409 && error.code === 'RECYCLE_CONSULTATION_RELATION_INVALID') return error.message || '回收咨询关联异常，无法授权查看资料'
  if ([401, 403, 404].includes(error.status)) return error.message || '当前身份无权查看该资料'
  return null
}

export function createRestoredRecycleProfileController(
  consultationId: string,
  api: Pick<RestoredRecycleApi, 'readConsultation'> & { readInitialProfile?: (consultationId: string, signal?: AbortSignal) => Promise<RecycleInitialProfile> },
  options: { schedule?: Schedule } = {},
) {
  const scheduleTask = options.schedule ?? defaultSchedule
  const listeners = new Set<() => void>()
  let snapshot = initial()
  let active = false
  let visible = true
  let generation = 0
  let failures = 0
  let pending: AbortController | undefined
  let cancelTimer: (() => void) | undefined
  const publish = (next: RestoredRecycleProfileSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const clearTimer = () => { cancelTimer?.(); cancelTimer = undefined }
  const schedule = (delay: number) => {
    clearTimer()
    if (active && visible) cancelTimer = scheduleTask(() => { void refresh() }, delay)
  }

  async function refresh() {
    if (!active || !visible) return
    const current = ++generation
    clearTimer()
    pending?.abort()
    const request = new AbortController()
    pending = request
    if (!snapshot.consultation) publish({ ...snapshot, loading: true, error: null, stale: false })
    try {
      let consultation: RecycleProfileDisplay
      if (api.readInitialProfile) {
        try {
          const profile = await api.readInitialProfile(consultationId, request.signal)
          consultation = {
            id: profile.consultationId, clientSubmissionId: profile.clientSubmissionId, requestId: profile.requestId, revisionId: profile.revisionId,
            gameCode: profile.gameCode, profileVersion: profile.profileVersion, profileFields: profile.profileFields, fieldTemplateVersion: profile.fieldTemplateVersion,
            fieldSchemaHash: profile.fieldSchemaHash, recyclerId: profile.recyclerId, conversationId: profile.conversationId, attachments: profile.attachments,
            status: profile.status, createdAt: profile.createdAt, deliveredAt: profile.deliveredAt,
          }
        } catch (error) {
          if (!(error instanceof RestoredHttpError && error.status === 409 && error.code === 'RECYCLE_PROFILE_LEGACY_ONLY')) throw error
          consultation = await api.readConsultation(consultationId, request.signal)
        }
      } else consultation = await api.readConsultation(consultationId, request.signal)
      if (!active || !visible || current !== generation) return
      failures = 0
      publish({ consultation, loading: false, error: null, stale: false })
      schedule(5_000)
    } catch (error) {
      if (!active || !visible || current !== generation) return
      const accessError = accessFailure(error)
      if (accessError) {
        failures = 0
        publish({ consultation: null, loading: false, error: accessError, stale: false })
        return
      }
      const detail = error instanceof Error && error.message ? error.message : '读取咨询资料失败'
      failures += 1
      publish({
        consultation: snapshot.consultation,
        loading: false,
        error: snapshot.consultation ? `刷新失败，当前显示上次资料（可能已过期）：${detail}` : detail,
        stale: Boolean(snapshot.consultation),
      })
      schedule(delays[Math.min(failures - 1, delays.length - 1)])
    } finally {
      if (current === generation) pending = undefined
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
    start() { if (active) return Promise.resolve(); active = true; return visible ? refresh() : Promise.resolve() },
    refresh,
    setVisible(next: boolean) {
      if (visible === next) return Promise.resolve()
      visible = next
      generation += 1
      clearTimer()
      pending?.abort(); pending = undefined
      return active && visible ? refresh() : Promise.resolve()
    },
    stop() {
      active = false; generation += 1; failures = 0; clearTimer(); pending?.abort(); pending = undefined
      publish(initial())
    },
  }
}
