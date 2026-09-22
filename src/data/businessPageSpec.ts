/**
 * 业务页面 Spec 的共享类型。
 *
 * 规则与登录/首页既有 Spec 一致：
 * - nodeId 是注册表主键；带 figmaFileKey 时 nodeId 必须是该文件内可核实的 Figma 节点；
 * - 没有 Figma 画板的页面不得伪造链接，必须给 referenceNote 说明依据（新版设计图路径或本地实现）；
 * - sections 描述页面流程与异常，元素级实现说明由同目录 *ElementSpecs.ts 提供；
 * - 说明为静态实现备注，不得把实时表单值或真实用户数据写入文档。
 */
export const DRAFT3_FILE_KEY = 'Ai4LTD0KcInZyiTfXrvlvn'
export const DRAFT3_PAGE_NAME = 'Design-Draft3-Pre'

export type BusinessPageSpecSection = {
  title: string
  items: string[]
}

export type BusinessPageSpec = {
  nodeId: string
  screenName: string
  summary: string
  sections: BusinessPageSpecSection[]
  /** 存在时 nodeId 视为该 Figma 文件内的真实节点，可生成复刻链接。 */
  figmaFileKey?: string
  figmaPageName?: string
  /** 无 Figma 画板时必填：注明设计稿来源或本地实现依据。 */
  referenceNote?: string
}

export const NEW_DESIGN_IMAGE_DIR = '/Users/ttcc/工程文件/深度玩家/素材/业务流程改版/新版设计图'

export function designImageNote(fileName: string, description: string): string {
  return `设计依据：${NEW_DESIGN_IMAGE_DIR}/${fileName}（2026-09-07 新版设计图）。${description}`
}
