import { AUTH_DESIGN_FILE_KEY, getAuthDesignPrompt } from './authDesignPrompts'
import { getAuthPageSpec } from './authPageSpecs'
import { HOME_REVIEW_PAGES } from './homePageReview'
import { STARTUP_REVIEW_PAGES } from './startupPageReview'
import { AUTH_LOCAL_REVIEW_PAGES } from './authLocalPageReview'
import { REVIEW_STATUS_ELEMENT } from './pageElementSpec'
import { getAuthElementSpecs } from './authElementSpecs'
import { getHomeStartupElementSpecs } from './homeStartupElementSpecs'
import { ORDER_PAGE_SPECS, getOrderPageSpec } from './orderPageSpecs'
import { AFTERSALES_PAGE_SPECS, getAftersalesPageSpec } from './aftersalesPageSpecs'
import { MESSAGE_PAGE_SPECS, getMessagePageSpec } from './messagePageSpecs'
import { RECYCLE_PAGE_SPECS, getRecyclePageSpec } from './recyclePageSpecs'
import { CATALOG_PAGE_SPECS, getCatalogPageSpec } from './catalogPageSpecs'
import { PROFILE_PAGE_SPECS, getProfilePageSpec } from './profilePageSpecs'
import { DRAFT3_PAGE_NAME, type BusinessPageSpec } from './businessPageSpec'
import { getOrderElementSpecs } from './orderElementSpecs'
import { getAftersalesElementSpecs } from './aftersalesElementSpecs'
import { getMessageElementSpecs } from './messageElementSpecs'
import { getRecycleElementSpecs } from './recycleElementSpecs'
import { getCatalogElementSpecs } from './catalogElementSpecs'
import { getProfileElementSpecs } from './profileElementSpecs'

export type PageReviewReference = {
  nodeId: string
  pageName: string
  screenName: string
  figmaUrl?: string
  prompt?: string
  referenceNote?: string
}

/** 业务页面 spec 总表：订单、售后、消息、回收、目录与我的。nodeId 全局唯一。 */
export const BUSINESS_PAGE_SPECS: readonly BusinessPageSpec[] = [
  ...ORDER_PAGE_SPECS,
  ...AFTERSALES_PAGE_SPECS,
  ...MESSAGE_PAGE_SPECS,
  ...RECYCLE_PAGE_SPECS,
  ...CATALOG_PAGE_SPECS,
  ...PROFILE_PAGE_SPECS,
]

const businessSpecByNodeId = new Map(BUSINESS_PAGE_SPECS.map((entry) => [entry.nodeId, entry]))

export function getBusinessPageSpec(nodeId: string): BusinessPageSpec | undefined {
  return businessSpecByNodeId.get(nodeId)
}

export function getPageReviewReference(nodeId: string): PageReviewReference | undefined {
  const auth = getAuthDesignPrompt(nodeId)
  if (auth) return auth
  const home = HOME_REVIEW_PAGES.find(page => page.nodeId === nodeId)
  if (home) {
    const figmaUrl = `https://www.figma.com/design/${AUTH_DESIGN_FILE_KEY}/?node-id=${nodeId.replace(':', '-')}&m=dev`
    return { nodeId, screenName: home.screenName, pageName: 'Page7', figmaUrl, prompt: `Implement this design from Figma.\n@${figmaUrl}` }
  }
  const business = businessSpecByNodeId.get(nodeId)
  if (business?.figmaFileKey) {
    const figmaUrl = `https://www.figma.com/design/${business.figmaFileKey}/?node-id=${nodeId.replace(':', '-')}&m=dev`
    return { nodeId, screenName: business.screenName, pageName: business.figmaPageName ?? DRAFT3_PAGE_NAME, figmaUrl, prompt: `Implement this design from Figma.\n@${figmaUrl}` }
  }
  if (business) return { nodeId, screenName: business.screenName, pageName: '本地原型', referenceNote: business.referenceNote ?? '本页暂无独立设计稿画板；以本地原型实现为准。' }
  const startup = [...STARTUP_REVIEW_PAGES, ...AUTH_LOCAL_REVIEW_PAGES].find(page => page.nodeId === nodeId)
  return startup ? { nodeId, screenName: startup.screenName, pageName: '本地原型', referenceNote: startup.referenceNote } : undefined
}

export function getPageReviewSpec(nodeId: string) {
  const spec = getAuthPageSpec(nodeId)
    ?? HOME_REVIEW_PAGES.find(page => page.nodeId === nodeId)
    ?? [...STARTUP_REVIEW_PAGES, ...AUTH_LOCAL_REVIEW_PAGES].find(page => page.nodeId === nodeId)
    ?? getOrderPageSpec(nodeId)
    ?? getAftersalesPageSpec(nodeId)
    ?? getMessagePageSpec(nodeId)
    ?? getRecyclePageSpec(nodeId)
    ?? getCatalogPageSpec(nodeId)
    ?? getProfilePageSpec(nodeId)
  if (!spec) return undefined
  const elements = getAuthElementSpecs(nodeId)
    ?? getHomeStartupElementSpecs(nodeId)
    ?? getOrderElementSpecs(nodeId)
    ?? getAftersalesElementSpecs(nodeId)
    ?? getMessageElementSpecs(nodeId)
    ?? getRecycleElementSpecs(nodeId)
    ?? getCatalogElementSpecs(nodeId)
    ?? getProfileElementSpecs(nodeId)
    ?? []
  return { ...spec, elements: [REVIEW_STATUS_ELEMENT, ...elements] }
}
