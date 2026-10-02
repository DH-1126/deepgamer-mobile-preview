import {
  parseOrderConfirmation,
  parseOrderConfirmationOperation,
  type ConfirmationApi,
} from "../../../运营平台/packages/contracts/src/order-confirmation-controller";
export {
  createOrderConfirmationController,
  parseOrderConfirmation,
  parseOrderConfirmationOperation,
  confirmationBlockedReasons,
} from "../../../运营平台/packages/contracts/src/order-confirmation-controller";
export type {
  ConfirmationApi,
  ConfirmationSnapshot,
} from "../../../运营平台/packages/contracts/src/order-confirmation-controller";
import type { createRestoredLinkedTransport } from "./restoredLinkedTransport";

export function createRestoredConfirmationApi(
  transport: ReturnType<typeof createRestoredLinkedTransport>,
  orderId: string,
): ConfirmationApi {
  const path = `/client/orders/${encodeURIComponent(orderId)}/local-confirmation`;
  return {
    read: async () =>
      (
        await transport.read(path, (value) =>
          parseOrderConfirmation(value, orderId),
        )
      ).data,
    operate: async (command) =>
      (
        await transport.write(
          `${path}/operations`,
          command,
          command.operationId,
          (value) =>
            parseOrderConfirmationOperation(
              value,
              orderId,
              command.operationId,
            ),
        )
      ).data,
    operation: async (operationId) =>
      (
        await transport.read(
          `${path}/operations/${encodeURIComponent(operationId)}`,
          (value) =>
            parseOrderConfirmationOperation(value, orderId, operationId),
        )
      ).data,
  };
}
