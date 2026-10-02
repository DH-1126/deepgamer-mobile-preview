import assert from 'node:assert/strict'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { RestoredRecycleConsultationView } from '../src/pages/RestoredRecyclePages'
import type { RecycleConsultation } from '../src/linked/restoredRecycleApi'

const hash = 'a'.repeat(64)

function consultation(mediaId: string): RecycleConsultation {
  return {
    id: 'consult-1',
    clientSubmissionId: 'submission-123',
    gameCode: 'wzry',
    profileVersion: 1,
    profileFields: [],
    fieldTemplateVersion: 3,
    fieldSchemaHash: hash,
    recyclerId: 'shop-1',
    conversationId: 'conversation-1',
    status: 'SENT',
    attachments: [{
      mediaId,
      mimeType: 'image/png',
      sizeBytes: 100,
      width: 10,
      height: 20,
      contentUrl: `/api/v1/client/recycle/consultations/consult-1/media/${mediaId}/content`,
      createdAt: '2026-09-24T00:59:00.000Z',
    }],
    createdAt: '2026-09-24T01:00:00.000Z',
  }
}

function queryButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === label || button.textContent?.trim() === label)
}

async function settle() {
  await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 0)) })
}

async function openPreview() {
  const trigger = queryButton('放大查看回收资料图片 1')
  assert.ok(trigger, 'protected image trigger is rendered')
  trigger.focus()
  await act(async () => trigger.click())
  await settle()
  return trigger
}

function dispatchTab(shiftKey = false) {
  const event = new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
  window.dispatchEvent(event)
  return event
}

export async function runRestoredRecycleImageDialogCases() {
  const originalOverflow = document.body.style.overflow
  const host = document.createElement('div')
  document.body.append(host)
  const root: Root = createRoot(host)
  const render = async (mediaId: string) => act(async () => {
    root.render(<MemoryRouter><button type="button">页面后方操作</button><RestoredRecycleConsultationView consultation={consultation(mediaId)} loading={false} error={null} onRefresh={() => undefined} /></MemoryRouter>)
  })

  try {
    await render('media-1')
    const firstTrigger = await openPreview()
    const firstDialog = document.querySelector<HTMLElement>('[role="dialog"]')
    assert.ok(firstDialog, 'image preview opens a real dialog')
    assert.equal(firstDialog.getAttribute('aria-modal'), 'true', 'preview declares modal semantics')
    assert.equal(firstDialog.closest('[data-ui="Dialog"]')?.parentElement, document.body, 'dialog is portaled above page content')
    assert.equal(document.body.style.overflow, 'hidden', 'dialog locks background scrolling')
    const close = queryButton('关闭')
    assert.ok(close, 'dialog renders an accessible close button')
    assert.equal(document.activeElement, close, 'dialog moves focus inside')
    assert.equal(dispatchTab().defaultPrevented, true, 'Tab cannot escape the dialog')
    assert.equal(dispatchTab(true).defaultPrevented, true, 'Shift+Tab cannot escape the dialog')

    await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    assert.equal(document.querySelector('[role="dialog"]'), null, 'Escape closes the dialog')
    assert.equal(document.activeElement, firstTrigger, 'Escape restores focus to the image trigger')
    assert.equal(document.body.style.overflow, originalOverflow, 'Escape restores background scrolling')

    const secondTrigger = await openPreview()
    const closeAgain = queryButton('关闭')
    assert.ok(closeAgain)
    await act(async () => closeAgain.click())
    assert.equal(document.querySelector('[role="dialog"]'), null, 'close button closes the dialog')
    assert.equal(document.activeElement, secondTrigger, 'close button restores focus to the image trigger')

    await openPreview()
    await render('media-2')
    assert.equal(document.querySelector('[role="dialog"]'), null, 'switching the protected image closes the old preview')
    assert.equal(document.querySelector(`img[src*="media-1"]`), null, 'old protected image is removed')
    assert.ok(document.querySelector(`img[src*="media-2"]`), 'new protected image is rendered')
    assert.equal(document.body.style.overflow, originalOverflow, 'image switching restores background scrolling')

    return { cases: 3, assertions: 18 }
  } finally {
    await act(async () => root.unmount())
    host.remove()
    document.body.style.overflow = originalOverflow
  }
}
