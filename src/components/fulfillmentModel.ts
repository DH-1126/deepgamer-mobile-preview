export function getContractSubmitIssue(signature: string, agreed: boolean) {
  if (!signature.trim()) return '请先完成签名'
  if (!agreed) return '请先阅读并同意协议'
  return ''
}
