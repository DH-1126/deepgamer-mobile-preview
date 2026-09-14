/** Independent detail panels, in the same order as the visible tabs. */
export const detailSectionIds = ['assets', 'description', 'guarantee'] as const
export type SectionId = typeof detailSectionIds[number]

export function parseDetailSection(value: string | null): SectionId {
  return detailSectionIds.includes(value as SectionId) ? value as SectionId : 'assets'
}

const finite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0

/** Keep the common overview stationary; deep panel switches start at the tab edge. */
export function detailTabScrollTarget(scrollTop: number, panelTop: number, tabHeight: number, scrollHeight: number, clientHeight: number, returnToTop = false) {
  const anchor = Math.max(0, finite(panelTop) - finite(tabHeight))
  return Math.min(returnToTop ? anchor : Math.min(finite(scrollTop), anchor), Math.max(0, finite(scrollHeight) - finite(clientHeight)))
}

export function showAssetBackToTop(section: SectionId, rowCount: number, pastTabTop: boolean) {
  return section === 'assets' && rowCount > 10 && pastTabTop
}
