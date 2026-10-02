import assert from 'node:assert/strict'
import React, { act, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { RestoredHttpError } from '../src/linked/restoredLinkedTransport'
import { createRestoredRecycleController } from '../src/linked/restoredRecycleController'
import type { RecycleCreate, RecycleGameDetail, RestoredRecycleApi } from '../src/linked/restoredRecycleApi'
import type { RestoredRecycleMedia } from '../src/linked/restoredRecycleMedia'
import { RestoredRecycleView } from '../src/pages/RestoredRecyclePages'

const hash = 'a'.repeat(64)
const detail: RecycleGameDetail = {
  gameCode: 'wzry',
  gameName: '王者荣耀',
  fieldTemplateVersion: 3,
  fieldSchemaHash: hash,
  available: true,
  blockedReason: null,
  attachmentsAvailable: true,
  fields: [{ fieldKey: 'rank', label: '段位', valueType: 'single', required: true, options: [{ label: '王者', value: 'king' }] }],
  recyclers: [{ recyclerId: 'shop-1', displayName: '回收商一', eligible: true, blockedReason: null }],
}

type UploadCall = { file: File; key: string; signal: AbortSignal | undefined }
type UploadBehavior = (file: File, key: string, callNumber: number) => Promise<RestoredRecycleMedia>

function defaultMedia(file: File, mediaId: string): RestoredRecycleMedia {
  return {
    mediaId,
    mimeType: file.type as RestoredRecycleMedia['mimeType'],
    sizeBytes: file.size,
    width: 1,
    height: 1,
    contentUrl: `/api/v1/client/recycle/media/${mediaId}/content`,
    createdAt: '2026-09-24T01:00:00.000Z',
  }
}

function createApi(uploadBehavior?: UploadBehavior) {
  const uploadCalls: UploadCall[] = []
  const uploaded = new Map<string, RestoredRecycleMedia>()
  const api: RestoredRecycleApi = {
    listCatalog: async () => [{ gameCode: 'wzry', gameName: '王者荣耀', available: true, blockedReason: null, eligibleRecyclerCount: 1 }],
    readGame: async () => detail,
    uploadMedia: async (file, key, signal) => {
      uploadCalls.push({ file, key, signal })
      const media = uploadBehavior
        ? await uploadBehavior(file, key, uploadCalls.length)
        : defaultMedia(file, `media-${uploadCalls.length}`)
      uploaded.set(media.mediaId, media)
      return media
    },
    createConsultation: async (body: RecycleCreate) => ({
      id: 'consult-shop-1',
      clientSubmissionId: body.clientSubmissionId,
      gameCode: body.gameCode,
      profileVersion: 1,
      profileFields: [{ fieldKey: 'rank', label: '段位', value: body.values.rank, displayValue: '王者' }],
      fieldTemplateVersion: body.fieldTemplateVersion,
      fieldSchemaHash: body.fieldSchemaHash,
      recyclerId: body.recyclerId,
      conversationId: 'conversation-shop-1',
      status: 'SENT',
      attachments: (body.attachmentMediaIds ?? []).map(mediaId => {
        const media = uploaded.get(mediaId)
        assert.ok(media, `uploaded media ${mediaId} exists`)
        return { ...media, contentUrl: `/api/v1/client/recycle/consultations/consult-shop-1/media/${mediaId}/content` }
      }),
      createdAt: '2026-09-24T01:01:00.000Z',
    }),
    findTarget: async () => { throw new RestoredHttpError(404, 'NOT_FOUND', '未找到') },
  }
  return { api, uploadCalls }
}

type Controller = ReturnType<typeof createRestoredRecycleController>

function Harness({ controller }: { controller: Controller }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return <RestoredRecycleView
    snapshot={snapshot}
    onGameChange={gameCode => { void controller.selectGame(gameCode) }}
    onValueChange={controller.setValue}
    onAttachmentsAdd={files => { void controller.addAttachments(files) }}
    onAttachmentRemove={controller.removeAttachment}
    onAttachmentRetry={localId => { void controller.retryAttachment(localId) }}
    onRecyclerToggle={controller.toggleRecycler}
    onRequestConfirmation={() => { controller.requestConfirmation() }}
    onConfirm={() => { void controller.confirmAndSubmit() }}
    onCancelConfirmation={controller.cancelConfirmation}
    onRetry={recyclerId => { void controller.retryTarget(recyclerId) }}
    onCheckUnknown={recyclerId => { void controller.checkUnknownTarget(recyclerId) }}
    onStartNew={controller.startNew}
    onRefresh={() => { void controller.loadCatalog() }}
  />
}

async function settle() {
  for (let index = 0; index < 8; index += 1) await act(async () => { await Promise.resolve() })
}

async function mount(uploadBehavior?: UploadBehavior) {
  const boundary = createApi(uploadBehavior)
  const controller = createRestoredRecycleController(boundary.api, () => 'submission-123')
  await controller.selectGame('wzry')
  const host = document.createElement('div')
  document.body.append(host)
  const root: Root = createRoot(host)
  await act(async () => {
    root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Harness controller={controller} /></MemoryRouter>)
  })
  return {
    ...boundary,
    controller,
    host,
    root,
    input: () => {
      const input = host.querySelector<HTMLInputElement>('input[type="file"]')
      assert.ok(input, 'real recycle file input is rendered')
      return input
    },
    close: async () => {
      await act(async () => root.unmount())
      controller.disconnect()
      host.remove()
    },
  }
}

async function chooseFiles(input: HTMLInputElement, files: File[]) {
  let inputValue = files.length > 0 ? `C:\\fakepath\\${files[0].name}` : ''
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  Object.defineProperty(input, 'value', { configurable: true, get: () => inputValue, set: value => { inputValue = String(value) } })
  await act(async () => {
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
    await Promise.resolve()
  })
  await settle()
  return inputValue
}

function button(host: HTMLElement, label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.textContent?.trim() === label)
}

function png(name: string, byte: number) {
  return new window.File([new Uint8Array([byte])], name, { type: 'image/png' })
}

export async function runRestoredRecycleUploadCases() {
  let assertions = 0

  {
    const view = await mount()
    try {
      const file = png('same.png', 1)
      assert.equal(await chooseFiles(view.input(), [file]), '', 'file input value resets after selection'); assertions += 1
      assert.equal(view.uploadCalls.length, 1, 'one selection starts one upload'); assertions += 1
      assert.equal(view.uploadCalls[0].file, file, 'the real selected File reaches the upload boundary'); assertions += 1
      assert.deepEqual({ name: view.uploadCalls[0].file.name, type: view.uploadCalls[0].file.type, size: view.uploadCalls[0].file.size }, { name: 'same.png', type: 'image/png', size: 1 }, 'selected file keeps its complete client contract'); assertions += 1
      const remove = button(view.host, '删除草稿图片')
      assert.ok(remove, 'uploaded draft exposes its real delete action'); assertions += 1
      await act(async () => remove.click())
      assert.equal(view.controller.getSnapshot().attachments.length, 0, 'delete removes the draft attachment'); assertions += 1
      await chooseFiles(view.input(), [file])
      assert.equal(view.uploadCalls.length, 2, 'the same File can be selected again after deletion'); assertions += 1
      assert.equal(view.uploadCalls[1].file, file, 'reselection passes the same File instance'); assertions += 1
      const beforeEmpty = view.controller.getSnapshot().attachments.length
      await chooseFiles(view.input(), [])
      assert.equal(view.uploadCalls.length, 2, 'an empty file selection never uploads'); assertions += 1
      assert.equal(view.controller.getSnapshot().attachments.length, beforeEmpty, 'an empty file selection preserves current drafts'); assertions += 1
    } finally { await view.close() }
  }

  {
    const view = await mount()
    try {
      const files = Array.from({ length: 15 }, (_, index) => png(`limit-${index + 1}.png`, index + 1))
      await chooseFiles(view.input(), files)
      assert.equal(view.uploadCalls.length, 15, 'exactly fifteen valid files upload'); assertions += 1
      assert.equal(view.controller.getSnapshot().attachments.length, 15, 'all fifteen drafts remain visible'); assertions += 1
      assert.ok(view.controller.getSnapshot().attachments.every(item => item.state === 'uploaded'), 'all fifteen drafts reach uploaded state'); assertions += 1
      assert.equal(view.input().disabled, true, 'the file input disables at the limit'); assertions += 1
      assert.equal(button(view.host, '上传资料图片')?.disabled, true, 'the visible upload button disables at the limit'); assertions += 1
    } finally { await view.close() }
  }

  {
    const view = await mount()
    try {
      await chooseFiles(view.input(), Array.from({ length: 14 }, (_, index) => png(`kept-${index + 1}.png`, index + 1)))
      assert.equal(view.uploadCalls.length, 14, 'the initial fourteen valid files upload'); assertions += 1
      const rejected = [png('rejected-1.png', 21), png('rejected-2.png', 22)]
      assert.equal(await chooseFiles(view.input(), rejected), '', 'an over-limit selection still resets the input'); assertions += 1
      assert.equal(view.uploadCalls.length, 14, 'over-limit files are rejected before any new upload'); assertions += 1
      assert.equal(view.controller.getSnapshot().attachments.length, 14, 'over-limit selection preserves all existing drafts'); assertions += 1
      assert.ok(view.controller.getSnapshot().attachments.every(item => item.fileName.startsWith('kept-')), 'no rejected file contaminates the existing batch'); assertions += 1
    } finally { await view.close() }
  }

  {
    const view = await mount(async (file, _key, callNumber) => {
      if (callNumber === 1) throw new RestoredHttpError(400, 'MEDIA_INVALID', '首次上传失败')
      return defaultMedia(file, 'media-retried')
    })
    try {
      const file = png('retry.png', 31)
      await chooseFiles(view.input(), [file])
      assert.equal(view.controller.getSnapshot().attachments[0].state, 'failed', 'a definite boundary failure remains failed'); assertions += 1
      const originalKey = view.uploadCalls[0].key
      const retry = button(view.host, '重试上传原操作')
      assert.ok(retry, 'failed draft exposes the real retry action'); assertions += 1
      await act(async () => { retry.click(); await Promise.resolve() })
      await settle()
      assert.equal(view.uploadCalls.length, 2, 'one retry starts exactly one additional upload'); assertions += 1
      assert.equal(view.uploadCalls[1].key, originalKey, 'retry reuses the original idempotency key'); assertions += 1
      assert.equal(view.uploadCalls[1].file, file, 'retry reuses the original File'); assertions += 1
      assert.equal(view.controller.getSnapshot().attachments[0].state, 'uploaded', 'successful retry updates the real draft state'); assertions += 1
    } finally { await view.close() }
  }

  {
    const view = await mount()
    try {
      await chooseFiles(view.input(), [png('frozen.png', 41)])
      const localId = view.controller.getSnapshot().attachments[0].localId
      await act(async () => {
        view.controller.setValue('rank', 'king')
        view.controller.toggleRecycler('shop-1')
        assert.equal(view.controller.requestConfirmation(), true, 'valid uploaded data reaches confirmation'); assertions += 1
        await view.controller.confirmAndSubmit()
      })
      assert.equal(view.controller.getSnapshot().frozen, true, 'confirming through the real controller freezes the batch'); assertions += 1
      assert.equal(view.input().disabled, true, 'the real file input is disabled after freeze'); assertions += 1
      const callsBeforeGuards = view.uploadCalls.length
      await act(async () => { await view.controller.addAttachments([png('blocked.png', 42)]) })
      await act(async () => { await view.controller.retryAttachment(localId) })
      assert.equal(view.uploadCalls.length, callsBeforeGuards, 'frozen add and retry never reach the upload boundary'); assertions += 1
      assert.equal(view.controller.getSnapshot().attachments.length, 1, 'frozen guards preserve the submitted attachment'); assertions += 1
    } finally { await view.close() }
  }

  return { cases: 5, assertions }
}
