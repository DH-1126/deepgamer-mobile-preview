import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { RestoredPublishDynamicFields } from '../linked/RestoredPublishDynamicFields'
import type { RestoredOwnedGoods } from '../linked/restoredGoodsApi'
import type { RestoredPublishFieldValue, RestoredPublishForm } from '../linked/restoredPublish'
import { RestoredGoodsListView } from './RestoredGoodsPages'

const rank = { fieldId: 'rank', sourceType: 'ATTRIBUTE', sourceKey: 'rank', label: '段位', valueType: 'ENUM', uiType: 'SELECT', cardinality: 'ONE', required: true, validation: {}, options: [{ key: 'rank:king', label: '王者' }] } as const
const transferable = { fieldId: 'transferable', sourceType: 'ATTRIBUTE', sourceKey: 'transferable', label: '可换绑', valueType: 'BOOLEAN', uiType: 'SWITCH', cardinality: 'ONE', required: true, validation: {}, options: [] } as const
const form: RestoredPublishForm = {
  gameCode: 'wzry', gameName: '王者荣耀', publishRevisionId: 'revision-1', publishSnapshotId: 'snapshot-1', configVersionId: 'config-1', schemaHash: 'schema-1',
  fields: { rank, transferable },
  steps: [{ stepId: 'rank', name: '账号段位', fields: [rank] }, { stepId: 'transfer', name: '换绑能力', fields: [transferable] }],
}

const onSale: RestoredOwnedGoods = {
  id: 'goods-1', goodsNo: 'DG-1', game: { id: 'game-1', code: 'wzry', name: '王者荣耀' }, sellerRef: 'seller-1',
  title: '合成在售商品', description: '合成详情', priceFen: 12_000, currency: 'CNY', productStatus: 'ON_SALE', auditStatus: 'APPROVED',
  currentAudit: { auditId: 'audit-1', submittedContentRevision: 1, status: 'APPROVED', rowVersion: 2, reviewReason: null, submittedAt: '2026-09-23T10:00:00.000Z', decidedAt: '2026-09-23T11:00:00.000Z', snapshotId: 'snapshot-1' },
  cover: null, images: [], highlightTags: [], servicePromiseTags: [], publishRevisionId: 'revision-1', configVersionId: 'config-1', fields: [],
  rowVersion: 2, contentRevision: 1, capabilities: { canEdit: false, canSubmit: false, canOffShelf: true, disabledReason: '商品必须先下架才能编辑' },
  createdAt: '2026-09-23T10:00:00.000Z', updatedAt: '2026-09-23T11:00:00.000Z',
}

function DynamicHarness() {
  const [values, setValues] = useState<Record<string, RestoredPublishFieldValue>>({})
  const [step, setStep] = useState(0)
  return <><RestoredPublishDynamicFields form={form} values={values} disabled={false} activeStep={step} onActiveStepChange={setStep} onChange={setValues} /><output>{JSON.stringify(values)}</output></>
}

function ListHarness() {
  const [confirmId, setConfirmId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [goods, setGoods] = useState([onSale])
  const [focusGoodsId, setFocusGoodsId] = useState('')
  return <><RestoredGoodsListView goods={goods} loading={false} staleError={null} busyId="" confirmId={confirmId} focusGoodsId={focusGoodsId}
    onConfirm={item => {
      if (confirmId !== item.id) return setConfirmId(item.id)
      setGoods([{ ...item, productStatus: 'OFF_SHELF', capabilities: { ...item.capabilities, canEdit: true, canOffShelf: false, disabledReason: null } }])
      setConfirmId(''); setFocusGoodsId(item.id); setConfirmed(true)
    }}
    onCancelConfirm={() => setConfirmId('')} onFocusRestored={() => setFocusGoodsId('')} /><output>{confirmed ? 'off-shelf-confirmed' : ''}</output></>
}

function button(root: HTMLElement, label: string) {
  const match = [...root.querySelectorAll('button')].find(node => node.textContent?.trim() === label)
  if (!match) throw new Error(`未找到交互按钮：${label}`)
  return match
}

function requireText(root: HTMLElement, expected: string) {
  if (!root.textContent?.includes(expected)) throw new Error(`页面未显示：${expected}`)
}

/** Browser/Electron runner: mounts real goods components and drives native change/click events. */
export async function runRestoredGoodsPagesReactTest() {
  const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const previousAct = globals.IS_REACT_ACT_ENVIRONMENT
  globals.IS_REACT_ACT_ENVIRONMENT = true
  const mount = document.createElement('div')
  document.body.append(mount)
  const root = createRoot(mount)
  try {
    await act(async () => root.render(<MemoryRouter><DynamicHarness /></MemoryRouter>))
    const select = mount.querySelector('select')
    if (!select) throw new Error('未渲染冻结枚举控件')
    await act(async () => {
      select.value = 'rank:king'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    requireText(mount, '"rank":"rank:king"')
    await act(async () => button(mount, '下一步').click())
    requireText(mount, '换绑能力')
    const falseRadio = [...mount.querySelectorAll('label')].find(label => label.textContent?.trim() === '否')?.querySelector('input')
    if (!falseRadio) throw new Error('未渲染 BOOLEAN 否选项')
    await act(async () => falseRadio.click())
    requireText(mount, '"transferable":false')

    await act(async () => root.render(<MemoryRouter><ListHarness /></MemoryRouter>))
    const initialTrigger = button(mount, '下架')
    initialTrigger.focus()
    await act(async () => initialTrigger.click())
    requireText(mount, '确认下架')
    if (document.activeElement !== button(mount, '取消')) throw new Error('进入下架确认后没有聚焦安全取消动作')
    await act(async () => button(mount, '取消').click())
    if (document.activeElement !== button(mount, '下架')) throw new Error('取消确认后没有回到原下架按钮')
    await act(async () => button(mount, '下架').click())
    await act(async () => button(mount, '确认下架').click())
    requireText(mount, 'off-shelf-confirmed')
    const edit = mount.querySelector<HTMLAnchorElement>('a[data-restored-goods-primary-action="true"]')
    if (!edit || document.activeElement !== edit) throw new Error('下架成功后没有聚焦新的编辑入口')
  } finally {
    await act(async () => root.unmount())
    mount.remove()
    globals.IS_REACT_ACT_ENVIRONMENT = previousAct
  }
}
