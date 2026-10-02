import { describe, expect, it, vi } from 'vitest'
import { createRestoredRecycleApi } from './restoredRecycleApi'

const hash = 'a'.repeat(64)
const detail = { gameCode: 'wzry', gameName: '王者荣耀', fieldTemplateVersion: 3, fieldSchemaHash: hash, available: true, blockedReason: null, attachmentsAvailable: true, fields: [{ fieldKey: 'rank', label: '段位', valueType: 'single', required: true, options: [{ label: '王者', value: 'king' }] }], recyclers: [{ recyclerId: 'shop-1', displayName: '店铺一', eligible: true, blockedReason: null }] }
const attachment = { mediaId: 'recycle-media-1', mimeType: 'image/png', sizeBytes: 100, width: 10, height: 20, contentUrl: '/api/v1/client/recycle/consultations/consult-1/media/recycle-media-1/content', createdAt: '2026-09-24T00:59:00.000Z' }
const consultation = { id: 'consult-1', clientSubmissionId: 'submission-123', gameCode: 'wzry', profileVersion: 1, profileFields: [{ fieldKey: 'rank', label: '段位', value: 'king', displayValue: '王者' }], fieldTemplateVersion: 3, fieldSchemaHash: hash, recyclerId: 'shop-1', conversationId: 'conversation-1', status: 'SENT', attachments: [attachment], createdAt: '2026-09-24T01:00:00.000Z' }

describe('restored recycle client API', () => {
  it('reads only the client catalog and rejects malformed game configuration', async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: [ { gameCode: 'wzry', gameName: '王者荣耀', available: true, blockedReason: null, eligibleRecyclerCount: 1 } ] }).mockResolvedValueOnce({ data: { ...detail, attachmentsAvailable: 'yes' } })
    const api = createRestoredRecycleApi({ read, write: vi.fn() } as never)
    expect(await api.listCatalog()).toHaveLength(1)
    await expect(api.readGame('wzry')).rejects.toThrow('契约')
    expect(read.mock.calls.map(call => call[0])).toEqual(['/client/recycle/catalog', '/client/recycle/games/wzry'])
  })

  it('accepts the explicit attachment capability and rejects a consultation media URL for another subject', async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: detail }).mockResolvedValueOnce({ data: { ...consultation, attachments: [{ ...attachment, contentUrl: '/api/v1/client/recycle/consultations/consult-2/media/recycle-media-1/content' }] } })
    const api = createRestoredRecycleApi({ read, write: vi.fn() } as never)
    await expect(api.readGame('wzry')).resolves.toMatchObject({ attachmentsAvailable: true })
    await expect(api.readConsultation('consult-1')).rejects.toThrow('契约')
  })

  it('sends frozen payload with fixed key and rejects a mismatched server result', async () => {
    const write = vi.fn().mockResolvedValue({ data: { ...consultation, recyclerId: 'shop-2' } })
    const api = createRestoredRecycleApi({ read: vi.fn(), write } as never)
    const body = { clientSubmissionId: 'submission-123', gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, selectedRecyclerIds: ['shop-1'], recyclerId: 'shop-1', values: { rank: 'king' }, attachmentMediaIds: ['recycle-media-1'] }
    await expect(api.createConsultation(body, 'recycle-key-123')).rejects.toThrow('契约')
    expect(write.mock.calls[0].slice(0, 3)).toEqual(['/client/recycle/consultations', body, 'recycle-key-123'])
  })

  it('freezes ordered unique attachment ids and rejects a response with different attachments', async () => {
    const write = vi.fn().mockResolvedValue({ data: { ...consultation, attachments: [] } })
    const api = createRestoredRecycleApi({ read: vi.fn(), write } as never)
    const body = { clientSubmissionId: 'submission-123', gameCode: 'wzry', fieldTemplateVersion: 3, fieldSchemaHash: hash, selectedRecyclerIds: ['shop-1'], recyclerId: 'shop-1', values: { rank: 'king' }, attachmentMediaIds: ['recycle-media-1'] }
    await expect(api.createConsultation(body, 'recycle-key-123')).rejects.toThrow('契约')
    await expect(api.createConsultation({ ...body, attachmentMediaIds: Array.from({ length: 16 }, (_, index) => `media-${index}`) }, 'recycle-key-456')).rejects.toThrow('契约')
  })

  it('checks both original lookup IDs and detail ID', async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: { ...consultation, clientSubmissionId: 'other' } }).mockResolvedValueOnce({ data: { ...consultation, id: 'other' } })
    const api = createRestoredRecycleApi({ read, write: vi.fn() } as never)
    await expect(api.findTarget('submission-123', 'shop-1')).rejects.toThrow('契约')
    await expect(api.readConsultation('consult-1')).rejects.toThrow('契约')
  })

  it('accepts backend attribute keys and preserves an unavailable template reason', async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: { ...detail, fields: [{ fieldKey: 'attr:account_note', label: '账号备注', valueType: 'text', required: true, options: [] }] } }).mockResolvedValueOnce({ data: { ...detail, available: false, blockedReason: '字段配置暂不可用', fields: [], fieldSchemaHash: '', fieldTemplateVersion: 0 } })
    const api = createRestoredRecycleApi({ read, write: vi.fn() } as never)
    expect((await api.readGame('wzry')).fields[0].fieldKey).toBe('attr:account_note')
    expect((await api.readGame('wzry')).blockedReason).toBe('字段配置暂不可用')
  })
})
