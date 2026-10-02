import { describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'

const hash = 'a'.repeat(64)
const ownerMedia = {
  mediaId: 'media-1', mimeType: 'image/png', sizeBytes: 100, width: 10, height: 20,
  contentUrl: '/api/v1/client/recycle/media/media-1/content', createdAt: '2026-09-28T02:00:00.000Z',
}
const revision = {
  revisionId: 'revision-1', requestId: 'request-1', revisionNumber: 1, profileVersion: 1, gameCode: 'wzry',
  fieldTemplateVersion: 3, fieldSchemaHash: hash,
  profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }],
  attachments: [ownerMedia], createdAt: '2026-09-28T02:00:00.000Z',
}
const summary = {
  requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', latestRevisionId: 'revision-1',
  latestProfileVersion: 1, createdAt: '2026-09-28T02:00:00.000Z',
}
const context = {
  requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', canEdit: true as const,
  baseRevisionId: 'revision-1', fieldTemplateVersion: 3, fieldSchemaHash: hash,
  fields: [
    { sourceRefType: 'attr' as const, sourceRefKey: 'note', fieldKey: 'note', label: '备注', valueType: 'STRING', uiType: 'input', order: 0, required: true, options: [], multiValues: [] },
    { sourceRefType: 'attr' as const, sourceRefKey: 'level', fieldKey: 'level', label: '等级', valueType: 'NUMBER', uiType: 'number', order: 1, required: true, options: [], multiValues: [] },
    { sourceRefType: 'attr' as const, sourceRefKey: 'rank', fieldKey: 'rank', label: '段位', valueType: 'ENUM', uiType: 'select', order: 2, required: true, options: [{ label: '王者', value: 'king' }], multiValues: [] },
  ],
  values: { note: '无敏感信息', level: 12, rank: 'king' }, attachments: [ownerMedia], consultations: [],
}
const target = {
  recyclerId: 'shop-1', recyclerName: '回收商甲', status: 'SUCCESS', consultationId: 'consult-1', conversationId: 'conversation-1',
  deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z', errorCode: null, errorMessage: null,
}
const distribution = {
  clientDistributionId: 'distribution-0001', requestId: 'request-1', revisionId: 'revision-1', selectedRecyclerIds: ['shop-1'],
  targets: [target], createdAt: '2026-09-28T02:30:00.000Z',
}

function transport(responses: Record<string, unknown>) {
  const read = vi.fn(async (path: string, parse: (value: unknown) => unknown) => ({ data: parse(responses[`GET ${path}`]) }))
  const write = vi.fn(async (path: string, body: unknown, key: string, parse: (value: unknown) => unknown) => ({ data: parse(responses[`POST ${path}`]) }))
  return { read, write }
}

describe('restored recycle distribution API', () => {
  it('creates and recovers a saved request without selecting or sending to a recycler', async () => {
    const module = await import('./restoredRecycleDistributionApi').catch(() => ({} as Record<string, unknown>))
    expect(typeof module.createRestoredRecycleDistributionApi).toBe('function')
    if (typeof module.createRestoredRecycleDistributionApi !== 'function') return
    const result = { clientRequestId: 'request-command-0001', created: true, request: summary, revision }
    const fake = transport({
      'POST /client/recycle/profile-requests': result,
      'GET /client/recycle/profile-request-operations/request-command-0001': result,
      'GET /client/recycle/profile-requests': { requests: [summary] },
      'GET /client/recycle/profile-requests/request-1/edit-context': context,
      'GET /client/recycle/profile-requests/request-1/revisions': { requestId: 'request-1', canEdit: true, revisions: [revision] },
    })
    const api = module.createRestoredRecycleDistributionApi(fake as never)
    const body = { clientRequestId: 'request-command-0001', gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, values: { rank: 'king' }, attachmentMediaIds: ['media-1'] }
    await expect(api.createRequest(body, 'request-key-0001')).resolves.toEqual(result)
    await expect(api.findRequestOperation('request-command-0001')).resolves.toEqual(result)
    await expect(api.listRequests()).resolves.toEqual([summary])
    await expect(api.readRequestContext('request-1')).resolves.toMatchObject({
      fields: [{ valueType: 'text' }, { valueType: 'number' }, { valueType: 'single' }],
      values: { note: '无敏感信息', level: 12, rank: 'king' }, attachments: [ownerMedia],
    })
    await expect(api.listRequestRevisions('request-1')).resolves.toEqual([revision])
    expect(fake.write.mock.calls[0].slice(0, 3)).toEqual(['/client/recycle/profile-requests', body, 'request-key-0001'])
  })

  it('freezes a distribution, then posts an empty target body and reads the same persisted target', async () => {
    const { createRestoredRecycleDistributionApi } = await import('./restoredRecycleDistributionApi')
    const fake = transport({
      'POST /client/recycle/revisions/revision-1/distributions': distribution,
      'GET /client/recycle/revisions/revision-1/distributions/distribution-0001': distribution,
      'POST /client/recycle/revisions/revision-1/distributions/distribution-0001/targets/shop-1': target,
      'GET /client/recycle/revisions/revision-1/distributions/distribution-0001/targets/shop-1': target,
    })
    const api = createRestoredRecycleDistributionApi(fake as never)
    const confirmation = { clientDistributionId: 'distribution-0001', selectedRecyclerIds: ['shop-1'] }
    await api.confirmDistribution('revision-1', confirmation, 'distribution-key-0001')
    await api.findDistribution('revision-1', 'distribution-0001')
    await api.executeTarget('revision-1', 'distribution-0001', 'shop-1', 'target-key-0001')
    await api.findTarget('revision-1', 'distribution-0001', 'shop-1')
    expect(fake.write.mock.calls.map(call => [call[0], call[1], call[2]])).toEqual([
      ['/client/recycle/revisions/revision-1/distributions', confirmation, 'distribution-key-0001'],
      ['/client/recycle/revisions/revision-1/distributions/distribution-0001/targets/shop-1', {}, 'target-key-0001'],
    ])
  })

  it('reads a generic initial profile with real request and revision identity and strict consultation media URLs', async () => {
    const { createRestoredRecycleDistributionApi } = await import('./restoredRecycleDistributionApi')
    const initial = {
      consultationId: 'consult-1', clientSubmissionId: 'submission-1', requestId: 'request-1', revisionId: 'revision-1', profileVersion: 1,
      gameCode: 'wzry', profileFields: revision.profileFields, fieldTemplateVersion: 3, fieldSchemaHash: hash, recyclerId: 'shop-1',
      conversationId: 'conversation-1', attachments: [{ ...ownerMedia, contentUrl: '/api/v1/client/recycle/consultations/consult-1/revisions/revision-1/media/media-1/content' }],
      status: 'SENT', createdAt: '2026-09-28T02:00:00.000Z', deliveredAt: '2026-09-28T03:00:00.000Z',
    }
    const fake = transport({ 'GET /client/recycle/consultations/consult-1/initial-profile': initial })
    await expect(createRestoredRecycleDistributionApi(fake as never).readInitialProfile('consult-1')).resolves.toEqual(initial)

    const bad = transport({ 'GET /client/recycle/consultations/consult-1/initial-profile': { ...initial, attachments: [{ ...initial.attachments[0], contentUrl: ownerMedia.contentUrl }] } })
    await expect(createRestoredRecycleDistributionApi(bad as never).readInitialProfile('consult-1'))
      .rejects.toBeInstanceOf(RestoredHttpError)
  })
})
