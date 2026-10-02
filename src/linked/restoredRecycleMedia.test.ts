import { describe, expect, it, vi } from 'vitest'
import type { createRestoredLinkedTransport } from './restoredLinkedTransport'
import { createRecycleMediaKeyRegistry, uploadRestoredRecycleMedia } from './restoredRecycleMedia'

type Transport = ReturnType<typeof createRestoredLinkedTransport>

const response = {
  mediaId: 'recycle-media-1',
  mimeType: 'image/webp',
  sizeBytes: 4,
  width: 1,
  height: 1,
  contentUrl: '/api/v1/client/recycle/media/recycle-media-1/content',
  createdAt: '2026-09-24T01:00:00.000Z',
}

function transportReturning(data: unknown) {
  return {
    write: vi.fn(async (_path, _body, _key, parse) => ({ data: parse(data) })),
  } as unknown as Transport
}

describe('restored recycle media', () => {
  it('uploads real JPEG PNG or WebP bytes with a fixed operation key', async () => {
    const transport = transportReturning(response)
    const file = new File([new Uint8Array([0x52, 0x49, 0x46, 0x46])], 'account.webp', { type: 'image/webp' })

    await expect(uploadRestoredRecycleMedia(transport, file, 'recycle-media-upload-1')).resolves.toEqual(response)
    expect(transport.write).toHaveBeenCalledWith(
      '/client/recycle/media',
      { fileName: 'account.webp', mimeType: 'image/webp', dataBase64: 'UklGRg==' },
      'recycle-media-upload-1',
      expect.any(Function),
      undefined,
    )
  })

  it('rejects empty, unsupported and one-MiB files before reading bytes', async () => {
    const transport = transportReturning(response)
    const empty = new File([], 'empty.png', { type: 'image/png' })
    const gif = new File([new Uint8Array([1])], 'account.gif', { type: 'image/gif' })
    const boundary = { name: 'boundary.jpg', type: 'image/jpeg', size: 1_048_576, arrayBuffer: vi.fn() } as unknown as File

    await expect(uploadRestoredRecycleMedia(transport, empty, 'recycle-media-empty')).rejects.toThrow('不能为空')
    await expect(uploadRestoredRecycleMedia(transport, gif, 'recycle-media-gif')).rejects.toThrow('JPG、PNG、WebP')
    await expect(uploadRestoredRecycleMedia(transport, boundary, 'recycle-media-boundary')).rejects.toThrow('必须小于 1MB')
    expect(boundary.arrayBuffer).not.toHaveBeenCalled()
    expect(transport.write).not.toHaveBeenCalled()
  })

  it('rejects extra fields and owner preview URLs for another media id', async () => {
    const file = new File([new Uint8Array([1])], 'account.png', { type: 'image/png' })
    await expect(uploadRestoredRecycleMedia(transportReturning({ ...response, public: true }), file, 'recycle-media-extra')).rejects.toThrow('契约')
    await expect(uploadRestoredRecycleMedia(transportReturning({ ...response, contentUrl: '/api/v1/client/recycle/media/other/content' }), file, 'recycle-media-cross-id')).rejects.toThrow('契约')
  })

  it('keeps the retry key for one file and uses a new key after replacement', () => {
    const registry = createRecycleMediaKeyRegistry('recycle-media')
    const first = new File([new Uint8Array([1])], 'one.png', { type: 'image/png' })
    const replacement = new File([new Uint8Array([2])], 'two.png', { type: 'image/png' })
    expect(registry.keyFor(first)).toBe(registry.keyFor(first))
    expect(registry.keyFor(replacement)).not.toBe(registry.keyFor(first))
  })
})
