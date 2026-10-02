import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalOrderSettlementDto } from "../../../运营平台/packages/contracts/src/order-settlement";
import {
  createRestoredSettlementApi,
  createRestoredSettlementController,
  parseRestoredSettlement,
  type RestoredSettlementApi,
} from "./order-settlement";

const ready: LocalOrderSettlementDto = {
  orderId: "order-one",
  provenance: "LOCAL_DEMO",
  rowVersion: 7,
  status: "READY",
  canSettle: false,
  blockedReason: null,
  receipt: null,
};

const problem = (status: number) =>
  Object.assign(new Error(`http ${status}`), { status });

const controllers: Array<
  ReturnType<typeof createRestoredSettlementController>
> = [];

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.stop());
  vi.useRealTimers();
});

describe("restored client settlement adapter", () => {
  it("uses the client-only GET and rejects foreign or extra receipt facts", async () => {
    const calls: string[] = [];
    const transport = {
      read: vi.fn(async (path: string, parse: (value: unknown) => unknown) => {
        calls.push(path);
        return { data: parse(ready) };
      }),
    };
    const api = createRestoredSettlementApi(transport as never, "order-one");
    await expect(api.read()).resolves.toEqual(ready);
    expect(calls).toEqual(["/client/orders/order-one/local-settlement"]);
    expect(() =>
      parseRestoredSettlement({ ...ready, orderId: "other" }, "order-one"),
    ).toThrow();
    expect(() =>
      parseRestoredSettlement({ ...ready, extra: true }, "order-one"),
    ).toThrow();
  });
});

describe("restored client settlement polling", () => {
  it("accepts READY with canSettle false, pauses while hidden and clears private facts on 403", async () => {
    vi.useFakeTimers();
    let reads = 0;
    const api: RestoredSettlementApi = {
      read: vi.fn(async () => {
        reads += 1;
        if (reads === 3) throw problem(403);
        return ready;
      }),
    };
    const controller = createRestoredSettlementController({
      orderId: "order-one",
      identity: "buyer-one",
      api,
      pollMs: 5000,
    });
    controllers.push(controller);
    await controller.start();
    expect(controller.getSnapshot().settlement).toEqual(ready);
    await controller.setVisible(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(reads).toBe(1);
    await controller.setVisible(true);
    expect(reads).toBe(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(reads).toBe(3);
    expect(controller.getSnapshot()).toMatchObject({
      settlement: null,
      locked: true,
    });
  });

  it("backs failed reads off to at most 30 seconds without overlapping requests", async () => {
    vi.useFakeTimers();
    const api: RestoredSettlementApi = {
      read: vi.fn(async () => {
        throw new Error("offline");
      }),
    };
    const controller = createRestoredSettlementController({
      orderId: "order-one",
      identity: "seller-one",
      api,
      pollMs: 5000,
    });
    controllers.push(controller);
    await controller.start();
    expect(api.read).toHaveBeenCalledTimes(1);
    const delays = [5000, 10_000, 20_000, 30_000, 30_000];
    for (const [index, delay] of delays.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(api.read).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(api.read).toHaveBeenCalledTimes(6);
  });
});
