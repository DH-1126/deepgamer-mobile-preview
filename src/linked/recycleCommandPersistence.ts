// W02：回收未决命令的最小标识持久化（交接 §9）。
// 只存命令标识（类型/请求号/幂等键/范围 ID/时间戳），绝不存资料内容与令牌；
// 键含主体隔离；成功或确认未执行后清除；留存 24 小时后过期丢弃。
export type RecycleCommandKind = "save" | "target" | "merchant-apply" | "merchant-execute"

export type RecycleCommandRecord = {
  kind: RecycleCommandKind
  identity: string
  requestId: string
  idempotencyKey: string
  clientSaveId?: string
  clientConfirmationId?: string
  revisionId?: string
  consultationId?: string
  recyclerId?: string
  savedAt: string
  /** 定向投递的逐商待确认条目（仅 ID 与展示名，无资料内容）。 */
  entries?: Array<{
    consultationId: string
    recyclerName: string
    conversationId: string
    revisionId: string
    clientConfirmationId: string
    key: string
    selectedConsultationIds: string[]
  }>
}

export type RecycleCommandStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const PREFIX = "deepgamer:recycle-command:v1"
const RETENTION_MS = 24 * 60 * 60 * 1000

export function recycleCommandKey(identity: string, slot: string): string {
  return `${PREFIX}:${identity}:${slot}`
}

export function loadRecycleCommand(
  storage: RecycleCommandStorage | undefined,
  identity: string | undefined,
  slot: string,
): RecycleCommandRecord | null {
  if (!storage || !identity) return null
  try {
    const raw = storage.getItem(recycleCommandKey(identity, slot))
    if (!raw) return null
    const parsed = JSON.parse(raw) as RecycleCommandRecord
    if (!parsed || parsed.identity !== identity || typeof parsed.savedAt !== "string") {
      storage.removeItem(recycleCommandKey(identity, slot))
      return null
    }
    if (Date.now() - Date.parse(parsed.savedAt) > RETENTION_MS) {
      storage.removeItem(recycleCommandKey(identity, slot))
      return null
    }
    return parsed
  } catch {
    try { storage.removeItem(recycleCommandKey(identity, slot)) } catch { /* 损坏记录按不存在处理 */ }
    return null
  }
}

export function storeRecycleCommand(
  storage: RecycleCommandStorage | undefined,
  identity: string | undefined,
  slot: string,
  record: RecycleCommandRecord,
): void {
  if (!storage || !identity) return
  try { storage.setItem(recycleCommandKey(identity, slot), JSON.stringify({ ...record, identity, savedAt: new Date().toISOString() })) } catch { /* 存储不可用时命令退化为会话内重试 */ }
}

export function clearRecycleCommand(
  storage: RecycleCommandStorage | undefined,
  identity: string | undefined,
  slot: string,
): void {
  if (!storage || !identity) return
  try { storage.removeItem(recycleCommandKey(identity, slot)) } catch { /* 忽略 */ }
}
