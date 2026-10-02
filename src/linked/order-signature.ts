import { parseSignature, parseSignatureOperation, type SignatureApi } from "../../../运营平台/packages/contracts/src/order-signature-controller";
export { createOrderSignatureController, parseSignature, parseSignatureOperation } from "../../../运营平台/packages/contracts/src/order-signature-controller";
export type { SignatureStatus, SignatureDto, SignatureCommand, SignatureOperation, SignatureApi, SignatureSnapshot } from "../../../运营平台/packages/contracts/src/order-signature-controller";

import type { createRestoredLinkedTransport } from "./restoredLinkedTransport";

export function createRestoredSignatureApi(transport: ReturnType<typeof createRestoredLinkedTransport>, orderId: string): SignatureApi {
  const path = `/client/orders/${encodeURIComponent(orderId)}/signature`;
  return {
    read: async () => (await transport.read(path, value => parseSignature(value, orderId))).data,
    simulate: async command => (await transport.write(`${path}/operations`, command, command.operationId, value => parseSignatureOperation(value, orderId, command.operationId, "SELLER"))).data,
    operation: async operationId => (await transport.read(`${path}/operations/${encodeURIComponent(operationId)}`, value => parseSignatureOperation(value, orderId, operationId, "SELLER"))).data,
  };
}
