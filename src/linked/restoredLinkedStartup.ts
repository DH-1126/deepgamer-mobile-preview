export const RESTORED_RUNTIME_PATH = '/api/v1/health/runtime'
export const CLIENT_SESSION_PATH = '/api/v1/client/session'
export const CLIENT_SESSION_ME_PATH = '/api/v1/client/session/me'

export interface RestoredRuntimeIdentity {
  status: 'ready'
  service: 'restoration-admin-api'
  runtimeId: string
  sourceSha256: string
  contract: { version: string; sourceSha256: string }
  builtAt: string
}

export interface RestoredLinkedActor {
  managementId: string
  displayName: string
  sellerRef: string | null
  recyclerId: string | null
}

export interface RestoredLinkedConnection {
  runtime: RestoredRuntimeIdentity
  actor: RestoredLinkedActor
  csrfToken: string
  expiresAt: string
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function isoDate(value: unknown): string | null {
  const text = nonEmptyString(value)
  if (text === null || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(text)) return null
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === text ? text : null
}

function sha256(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) ? value : null
}

function runtimeError(): Error {
  return new Error('Unrecognized restoration runtime identity')
}

export function parseRestoredRuntimeEnvelope(payload: unknown): RestoredRuntimeIdentity {
  const data = object(object(payload)?.data)
  const contract = object(data?.contract)
  const runtimeId = nonEmptyString(data?.runtimeId)
  const sourceHash = sha256(data?.sourceSha256)
  const contractVersion = nonEmptyString(contract?.version)
  const contractHash = sha256(contract?.sourceSha256)
  const builtAt = isoDate(data?.builtAt)
  if (data?.status !== 'ready'
    || data.service !== 'restoration-admin-api'
    || runtimeId === null
    || !/^restoration-[a-f0-9]{16}$/u.test(runtimeId)
    || sourceHash === null
    || contractVersion === null
    || contractHash === null
    || builtAt === null) {
    throw runtimeError()
  }
  return {
    status: 'ready',
    service: 'restoration-admin-api',
    runtimeId,
    sourceSha256: sourceHash,
    contract: { version: contractVersion, sourceSha256: contractHash },
    builtAt,
  }
}

function parseActor(value: unknown): RestoredLinkedActor {
  const actor = object(value)
  const managementId = nonEmptyString(actor?.managementId)
  const displayName = nonEmptyString(actor?.displayName)
  const sellerRef = actor?.sellerRef
  const recyclerId = actor?.recyclerId
  if (managementId === null
    || displayName === null
    || !(sellerRef === null || nonEmptyString(sellerRef) !== null)
    || !(recyclerId === null || nonEmptyString(recyclerId) !== null)) {
    throw new Error('Missing explicit client actor in restored-linked session')
  }
  return {
    managementId,
    displayName,
    sellerRef: sellerRef as string | null,
    recyclerId: recyclerId as string | null,
  }
}

async function json(response: Response, label: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`)
  try {
    return await response.json()
  } catch {
    throw new Error(`${label} returned invalid JSON`)
  }
}

export async function readRestoredRuntime(fetcher: Fetcher = globalThis.fetch): Promise<RestoredRuntimeIdentity> {
  const response = await fetcher(RESTORED_RUNTIME_PATH, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
  return parseRestoredRuntimeEnvelope(await json(response, 'restoration runtime probe'))
}

export async function connectRestoredLinkedRuntime(fetcher: Fetcher = globalThis.fetch): Promise<RestoredLinkedConnection> {
  const runtime = await readRestoredRuntime(fetcher)
  const sessionResponse = await fetcher(CLIENT_SESSION_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: '{}',
  })
  const sessionData = object(object(await json(sessionResponse, 'client session'))?.data)
  const sessionActor = parseActor(sessionData?.actor)
  const csrfToken = nonEmptyString(sessionData?.csrfToken)
  const expiresAt = isoDate(sessionData?.expiresAt)
  if (sessionData?.mode !== 'LOCAL_DEMO' || csrfToken === null || expiresAt === null) {
    throw new Error('Invalid restored-linked client session')
  }

  const meResponse = await fetcher(CLIENT_SESSION_ME_PATH, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
  const meData = object(object(await json(meResponse, 'client session actor'))?.data)
  if (meData?.mode !== 'LOCAL_DEMO') throw new Error('Missing explicit client actor in restored-linked session')
  const actor = parseActor(meData.actor)
  if (JSON.stringify(actor) !== JSON.stringify(sessionActor)) {
    throw new Error('Explicit client actor changed during restored-linked startup')
  }
  return { runtime, actor, csrfToken, expiresAt }
}
