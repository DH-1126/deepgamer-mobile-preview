export * from "../../../运营平台/packages/contracts/src/order-local-fulfillment-controller";
import { parseLocalFulfillment } from "../../../运营平台/packages/contracts/src/order-local-fulfillment-controller";
import type { createRestoredLinkedTransport } from "./restoredLinkedTransport";
export function createRestoredLocalFulfillmentApi(
  transport: ReturnType<typeof createRestoredLinkedTransport>,
  orderId: string,
) {
  return {
    read: async () =>
      (
        await transport.read(
          `/client/orders/${encodeURIComponent(orderId)}/local-fulfillment`,
          (value) => parseLocalFulfillment(value, orderId),
        )
      ).data,
  };
}
