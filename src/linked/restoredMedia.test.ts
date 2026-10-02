import { describe, expect, it, vi } from 'vitest'
import type { createRestoredLinkedTransport } from './restoredLinkedTransport'
import { createRestoredMediaKeyRegistry, uploadRestoredMedia } from './restoredMedia'

type Transport = ReturnType<typeof createRestoredLinkedTransport>

function transportReturning(data: unknown) {
  return {
    write: vi.fn(async (_path, _body, _key, parse) => ({ data: parse(data) })),
  } as unknown as Transport
}

const response = {
  mediaId: 'client-media-1', purpose: 'SELLER_IDENTITY' as const, mimeType: 'image/png', sizeBytes: 4,
  width: 1, height: 1, contentUrl: '/api/v1/client/media/client-media-1/content', createdAt: '2026-09-23T00:00:00.000Z',
}

describe('restored media upload', () => {
  it('sends the real file bytes, purpose and fixed operation key', async () => {
    const transport = transportReturning(response)
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'identity.png', { type: 'image/png' })
    await expect(uploadRestoredMedia(transport, file, 'SELLER_IDENTITY', 'seller-media-identity-front-1')).resolves.toEqual(response)
    expect(transport.write).toHaveBeenCalledWith(
      '/client/media',
      { purpose: 'SELLER_IDENTITY', fileName: 'identity.png', mimeType: 'image/png', dataBase64: 'iVBORw==' },
      'seller-media-identity-front-1',
      expect.any(Function),
      undefined,
    )
  })

  it('enforces identity/takeout and goods media constraints before reading bytes', async () => {
    const transport = transportReturning(response)
    const identityWebp = new File([new Uint8Array([1])], 'identity.webp', { type: 'image/webp' })
    const oversizedGoods = { name: 'goods.png', type: 'image/png', size: 5 * 1024 * 1024 + 1, arrayBuffer: vi.fn() } as unknown as File

    await expect(uploadRestoredMedia(transport, identityWebp, 'SELLER_IDENTITY', 'seller-media-invalid-type')).rejects.toThrow('身份与订单截图仅支持 JPG、PNG')
    await expect(uploadRestoredMedia(transport, oversizedGoods, 'GOODS', 'seller-media-oversized-goods')).rejects.toThrow('商品图片不能超过 5MB')
    expect(oversizedGoods.arrayBuffer).not.toHaveBeenCalled()
    expect(transport.write).not.toHaveBeenCalled()
  })

  it('rejects malformed media responses instead of accepting mock fields', async () => {
    const transport = transportReturning({ ...response, localPreview: true })
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'identity.png', { type: 'image/png' })
    await expect(uploadRestoredMedia(transport, file, 'SELLER_IDENTITY', 'seller-media-invalid-response')).rejects.toThrow('媒体接口数据不符合契约')
  })

  it('keeps retry keys stable for one file and changes them when the user replaces the file', () => {
    const registry = createRestoredMediaKeyRegistry('seller-media-front')
    const first = new File([new Uint8Array([1])], 'first.png', { type: 'image/png' })
    const replacement = new File([new Uint8Array([2])], 'replacement.png', { type: 'image/png' })
    expect(registry.keyFor(first)).toBe(registry.keyFor(first))
    expect(registry.keyFor(replacement)).not.toBe(registry.keyFor(first))
  })

  it('rejects a response whose purpose does not match the requested upload', async () => {
    const transport = transportReturning({ ...response, purpose: 'GOODS' })
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'identity.png', { type: 'image/png' })
    await expect(uploadRestoredMedia(transport, file, 'SELLER_IDENTITY', 'seller-media-purpose-mismatch')).rejects.toThrow('媒体用途回读不一致')
  })
})
