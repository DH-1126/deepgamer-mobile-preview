import { describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'
import { createRestoredRecycleRevisionApi } from './restoredRecycleRevisionApi'

const hash = 'a'.repeat(64)
const media = (revisionId = 'revision-2') => ({
  mediaId: 'media-2', mimeType: 'image/png', sizeBytes: 100, width: 10, height: 20,
  contentUrl: `/api/v1/client/recycle/consultations/consult-1/revisions/${revisionId}/media/media-2/content`,
  createdAt: '2026-09-28T02:00:00.000Z',
})
const revision = (revisionId = 'revision-2') => ({
  revisionId, requestId: 'request-1', revisionNumber: 2, profileVersion: 2, gameCode: 'wzry',
  fieldTemplateVersion: 3, fieldSchemaHash: hash,
  profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }],
  attachments: [media(revisionId)], createdAt: '2026-09-28T02:00:00.000Z',
})
const list = { consultationId: 'consult-1', requestId: 'request-1', canEdit: true, revisions: [{ ...revision(), deliveredAt: null }] }
const context = {
  requestId: 'request-1', clientSubmissionId: 'submission-1', gameCode: 'wzry', canEdit: true as const,
  baseRevisionId: 'revision-2', fieldTemplateVersion: 3, fieldSchemaHash: hash,
  fields: [
    { sourceRefType: 'attr' as const, sourceRefKey: 'account_note', fieldKey: 'attr:account_note', label: '账号说明', valueType: 'STRING', uiType: 'input', order: 0, required: true, options: [], multiValues: [] },
    { sourceRefType: 'attr' as const, sourceRefKey: 'account_level', fieldKey: 'attr:account_level', label: '账号等级', valueType: 'NUMBER', uiType: 'number', order: 1, required: true, options: [], multiValues: [] },
    { sourceRefType: 'attr' as const, sourceRefKey: 'account_region', fieldKey: 'attr:account_region', label: '账号大区', valueType: 'ENUM', uiType: 'select', order: 2, required: true, options: [{ label: '北区', value: 'north' }, { label: '南区', value: 'south' }], multiValues: [] },
    { sourceRefType: 'attr_group' as const, sourceRefKey: 'rare_items', fieldKey: 'attr_group:rare_items', label: '稀有物品', valueType: 'ENUM', uiType: 'checkbox', order: 3, required: false, options: [{ label: '限定', value: 'limited' }, { label: '稀世', value: 'rare' }], multiValues: [] },
  ],
  values: { 'attr:account_note': '合成初版资料', 'attr:account_level': 12, 'attr:account_region': 'north', 'attr_group:rare_items': ['limited'] }, attachments: [media()],
  consultations: [{ consultationId: 'consult-1', recyclerId: 'shop-1', recyclerName: '店铺一', conversationId: 'conversation-1', deliveredRevisionId: 'revision-1', deliveredAt: '2026-09-27T02:00:00.000Z' }],
}
const normalizedContext = {
  ...context,
  fields: context.fields.map((field, index) => ({ ...field, valueType: ['text', 'number', 'single', 'multiple'][index] })),
}

function transport(responses: Record<string, unknown>) {
  const read = vi.fn(async (path: string, parse: (value: unknown) => unknown) => ({ data: parse(responses[`GET ${path}`]) }))
  const write = vi.fn(async (path: string, body: unknown, key: string, parse: (value: unknown) => unknown) => ({ data: parse(responses[`POST ${path}`]) }))
  return { read, write }
}

describe('restored recycle revision API', () => {
  it('uses explicit consultation + revision paths and validates protected media URLs', async () => {
    const fake = transport({
      'GET /client/recycle/consultations/consult-1/revisions': list,
      'GET /client/recycle/consultations/consult-1/revisions/revision-2': revision(),
      'GET /client/recycle/consultations/consult-1/profile-edit-context': context,
    })
    const api = createRestoredRecycleRevisionApi(fake as never)
    await expect(api.listRevisions('consult-1')).resolves.toEqual(list)
    await expect(api.readRevision('consult-1', 'revision-2')).resolves.toEqual(revision())
    await expect(api.readEditContext('consult-1')).resolves.toEqual(normalizedContext)
    expect(fake.read.mock.calls.map(call => call[0])).toEqual([
      '/client/recycle/consultations/consult-1/revisions',
      '/client/recycle/consultations/consult-1/revisions/revision-2',
      '/client/recycle/consultations/consult-1/profile-edit-context',
    ])

    const bad = transport({ 'GET /client/recycle/consultations/consult-1/revisions/revision-2': { ...revision(), attachments: [{ ...media(), contentUrl: '/api/v1/client/recycle/consultations/consult-1/media/media-2/content' }] } })
    await expect(createRestoredRecycleRevisionApi(bad as never).readRevision('consult-1', 'revision-2')).rejects.toMatchObject({ code: 'CLIENT_RECYCLE_REVISION_RESPONSE_INVALID' })
  })

  it.each([
    ['text rendered as checkbox', { ...context.fields[0], uiType: 'checkbox' }],
    ['enum without options', { ...context.fields[2], options: [] }],
    ['unimplemented multi-values semantics', { ...context.fields[3], multiValues: ['limited'] }],
  ])('rejects an unsupported frozen field combination: %s', async (_label, field) => {
    const fake = transport({
      'GET /client/recycle/consultations/consult-1/profile-edit-context': { ...context, fields: [field] },
    })
    await expect(createRestoredRecycleRevisionApi(fake as never).readEditContext('consult-1'))
      .rejects.toMatchObject({ code: 'CLIENT_RECYCLE_REVISION_RESPONSE_INVALID' })
  })

  it('keeps save and delivery writes separate with stable caller-provided keys', async () => {
    const ownerRevision = { ...revision(), attachments: [{ ...media(), contentUrl: '/api/v1/client/recycle/media/media-2/content' }] }
    const saveResult = { clientSaveId: 'client-save-0001', unchanged: false, revision: ownerRevision }
    const delivery = { clientConfirmationId: 'confirm-0001', revisionId: 'revision-2', selectedConsultationIds: ['consult-1'], consultationId: 'consult-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' }
    const fake = transport({
      'POST /client/recycle/requests/request-1/revisions': saveResult,
      'GET /client/recycle/requests/request-1/revision-operations/client-save-0001': saveResult,
      'POST /client/recycle/revisions/revision-2/targets/consult-1': delivery,
      'GET /client/recycle/revisions/revision-2/targets/consult-1?clientConfirmationId=confirm-0001': delivery,
    })
    const api = createRestoredRecycleRevisionApi(fake as never)
    const save = { clientSaveId: 'client-save-0001', baseRevisionId: 'revision-1', values: { rank: 'king' }, attachmentMediaIds: ['media-2'] }
    const target = { clientConfirmationId: 'confirm-0001', selectedConsultationIds: ['consult-1'] }
    await api.saveRevision('request-1', save, 'save-key-0001')
    await api.findSaveOperation('request-1', 'client-save-0001')
    await api.deliverRevision('revision-2', 'consult-1', target, 'target-key-0001')
    await api.findTargetOperation('revision-2', 'consult-1', 'confirm-0001', target.selectedConsultationIds)
    expect(fake.write.mock.calls.map(call => [call[0], call[2]])).toEqual([
      ['/client/recycle/requests/request-1/revisions', 'save-key-0001'],
      ['/client/recycle/revisions/revision-2/targets/consult-1', 'target-key-0001'],
    ])
  })

  it('rejects a target lookup result from another confirmation batch or recipient list', async () => {
    const mismatched = { clientConfirmationId: 'confirm-other', revisionId: 'revision-2', selectedConsultationIds: ['consult-2'], consultationId: 'consult-1', deliveryId: 'delivery-1', messageId: 'message-1', deliveredAt: '2026-09-28T03:00:00.000Z' }
    const fake = transport({ 'GET /client/recycle/revisions/revision-2/targets/consult-1?clientConfirmationId=confirm-0001': mismatched })
    await expect(createRestoredRecycleRevisionApi(fake as never).findTargetOperation('revision-2', 'consult-1', 'confirm-0001', ['consult-1']))
      .rejects.toBeInstanceOf(RestoredHttpError)
  })

  it('rejects response timestamps that are dates but not contract date-times', async () => {
    const fake = transport({ 'GET /client/recycle/consultations/consult-1/revisions/revision-2': { ...revision(), createdAt: '2026-09-28' } })
    await expect(createRestoredRecycleRevisionApi(fake as never).readRevision('consult-1', 'revision-2'))
      .rejects.toMatchObject({ code: 'CLIENT_RECYCLE_REVISION_RESPONSE_INVALID' })
  })

  it('rejects profile values beyond the frozen contract limit', async () => {
    const fake = transport({ 'GET /client/recycle/consultations/consult-1/revisions/revision-2': { ...revision(), profileFields: [{ fieldKey: 'rank', label: '段位', value: 'x'.repeat(5_001), displayValue: '超长' }] } })
    await expect(createRestoredRecycleRevisionApi(fake as never).readRevision('consult-1', 'revision-2'))
      .rejects.toMatchObject({ code: 'CLIENT_RECYCLE_REVISION_RESPONSE_INVALID' })
  })
})
