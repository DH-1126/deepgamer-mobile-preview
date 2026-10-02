import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOrderConfirmationController,
  createRestoredConfirmationApi,
  parseOrderConfirmation,
  confirmationBlockedReasons,
  type ConfirmationApi,
} from "./order-confirmation";
import type {
  LocalOrderConfirmationCommand,
  LocalOrderConfirmationDto,
  LocalOrderConfirmationOperationDto,
} from "../../../运营平台/packages/contracts/src/order-confirmation";

it("names buyer and current assignee blockers without changing their codes", () => {
  expect(confirmationBlockedReasons.LOCAL_CONFIRMATION_BUYER_REQUIRED).toBe(
    "仅订单本人买家可确认，当前账号只能查看。",
  );
  expect(confirmationBlockedReasons.FULFILLMENT_NOT_CLAIMED).toBe(
    "需先在履约工作台接管。",
  );
  expect(confirmationBlockedReasons.FULFILLMENT_NOT_OWNER).toBe(
    "仅当前接管客服可发布确认卡。",
  );
});

const row: LocalOrderConfirmationDto = {
  orderId: "order",
  provenance: "LOCAL_DEMO",
  rowVersion: 1,
  status: "SENT",
  cardId: "card",
  publishedAt: "2026-09-29T03:00:00.000Z",
  confirmedAt: null,
  confirmedBy: null,
  canPublish: false,
  canConfirm: true,
  blockedReason: null,
};
const confirmed: LocalOrderConfirmationDto = {
  ...row,
  rowVersion: 2,
  status: "CONFIRMED_MANUAL",
  confirmedAt: "2026-09-29T03:01:00.000Z",
  confirmedBy: "buyer",
  canConfirm: false,
};
const problem = (status: number, code: string) =>
  Object.assign(new Error(code), { status, code });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
};
const controllers: ReturnType<typeof createOrderConfirmationController>[] = [];
function fixture(
  options: {
    saved?: string;
    identity?: string;
    action?: "CONFIRM" | "PUBLISH" | null;
    pollMs?: number;
  } = {},
) {
  const memory = new Map<string, string>();
  const key = `deepgamer:order-confirmation:v1:${options.identity ?? "buyer"}:${options.action === undefined ? "CONFIRM" : options.action}:order`;
  if (options.saved !== undefined) memory.set(key, options.saved);
  let current = { ...row };
  const commands: LocalOrderConfirmationCommand[] = [];
  const api: ConfirmationApi = {
    read: vi.fn(async () => current),
    operation: vi.fn(
      async (id: string): Promise<LocalOrderConfirmationOperationDto> => ({
        operationId: id,
        action: "CONFIRM",
        rowVersion: 2,
        confirmation: confirmed,
      }),
    ),
    operate: vi.fn(async (command) => {
      commands.push(command);
      current = confirmed;
      return {
        operationId: command.operationId,
        action: command.action,
        rowVersion: 2,
        confirmation: confirmed,
      };
    }),
  };
  const c = createOrderConfirmationController({
    orderId: "order",
    identity: options.identity ?? "buyer",
    action: options.action === undefined ? "CONFIRM" : options.action,
    api,
    pollMs: options.pollMs,
    createId: () => "confirmation-operation-one",
    storage: {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, value) => {
        memory.set(k, value);
      },
      removeItem: (k) => {
        memory.delete(k);
      },
    },
  });
  controllers.push(c);
  return {
    c,
    api,
    memory,
    key,
    commands,
    set: (value: LocalOrderConfirmationDto) => {
      current = value;
    },
  };
}
afterEach(() => {
  controllers.splice(0).forEach((c) => c.stop());
  vi.useRealTimers();
});
describe("confirmation controller and client adapter", () => {
  it("strictly rejects foreign, extra and internally inconsistent facts", () => {
    for (const value of [
      { ...row, orderId: "other" },
      { ...row, extra: true },
      { ...row, rowVersion: -1 },
      { ...confirmed, confirmedBy: null },
    ])
      expect(() => parseOrderConfirmation(value, "order")).toThrow();
  });
  it("requires explicit confirmation, persists before writing and suppresses duplicate submit", async () => {
    const f = fixture();
    await f.c.start();
    expect(f.commands).toEqual([]);
    f.c.prepare();
    expect(f.c.getSnapshot().confirmation).toBe("CONFIRM");
    f.c.cancel();
    expect(f.c.getSnapshot().confirmation).toBeNull();
    const pending = deferred<LocalOrderConfirmationOperationDto>();
    vi.mocked(f.api.operate).mockImplementationOnce(async (command) => {
      expect(f.memory.size).toBe(1);
      f.commands.push(command);
      return pending.promise;
    });
    f.c.prepare();
    const write = f.c.confirm();
    await f.c.confirm();
    f.c.cancel();
    expect(f.commands).toEqual([
      {
        operationId: "confirmation-operation-one",
        rowVersion: 1,
        action: "CONFIRM",
      },
    ]);
    expect(f.c.getSnapshot().busy).toBe(true);
    f.set(confirmed);
    pending.resolve({
      operationId: "confirmation-operation-one",
      action: "CONFIRM",
      rowVersion: 2,
      confirmation: confirmed,
    });
    await write;
    expect(f.c.getSnapshot().card?.status).toBe("CONFIRMED_MANUAL");
    expect(f.memory.size).toBe(0);
    f.c.prepare();
    expect(f.c.getSnapshot().confirmation).toBeNull();
  });
  it("restores UNKNOWN by querying original result then separately reads current capabilities", async () => {
    const f = fixture();
    await f.c.start();
    vi.mocked(f.api.operate).mockRejectedValueOnce(new Error("lost response"));
    f.c.prepare();
    await f.c.confirm();
    const original = f.memory.get(f.key)!;
    expect(f.c.getSnapshot()).toMatchObject({ unknown: true, replay: false });
    f.c.stop();
    const restored = fixture({ saved: original });
    restored.set({ ...confirmed, blockedReason: "AFTER_SALE_BLOCKS_RELEASE" });
    await restored.c.start();
    expect(restored.api.operation).toHaveBeenCalledWith(
      "confirmation-operation-one",
    );
    expect(restored.commands).toEqual([]);
    expect(restored.c.getSnapshot().card).toMatchObject({
      status: "CONFIRMED_MANUAL",
      canConfirm: false,
      blockedReason: "AFTER_SALE_BLOCKS_RELEASE",
    });
    expect(restored.memory.size).toBe(0);
  });
  it("allows same-body explicit retry only after exact operation-not-found", async () => {
    const f = fixture();
    await f.c.start();
    vi.mocked(f.api.operate).mockRejectedValueOnce(new Error("lost"));
    f.c.prepare();
    await f.c.confirm();
    await f.c.replay();
    expect(f.commands.length).toBe(0);
    vi.mocked(f.api.operation).mockRejectedValueOnce(
      problem(404, "LOCAL_CONFIRMATION_OPERATION_NOT_FOUND"),
    );
    await f.c.query();
    expect(f.c.getSnapshot().replay).toBe(true);
    await f.c.replay();
    expect(f.commands).toEqual([
      {
        operationId: "confirmation-operation-one",
        rowVersion: 1,
        action: "CONFIRM",
      },
    ]);
    expect(f.memory.size).toBe(0);
  });
  it.each([
    [401, "CLIENT_SESSION_REQUIRED"],
    [403, "FORBIDDEN"],
    [404, "ORDER_NOT_FOUND"],
  ])(
    "locks %s recovery, clears private facts and preserves request",
    async (status, code) => {
      const f = fixture();
      await f.c.start();
      vi.mocked(f.api.operate).mockRejectedValueOnce(new Error("lost"));
      f.c.prepare();
      await f.c.confirm();
      const raw = f.memory.get(f.key);
      vi.mocked(f.api.operation).mockRejectedValueOnce(
        problem(Number(status), String(code)),
      );
      await f.c.query();
      await f.c.replay();
      await f.c.refresh();
      f.c.prepare();
      expect(f.c.getSnapshot()).toMatchObject({
        card: null,
        locked: true,
        replay: false,
        confirmation: null,
      });
      expect(f.memory.get(f.key)).toBe(raw);
    },
  );
  it("preserves pending request on write authorization loss", async () => {
    const f = fixture();
    await f.c.start();
    vi.mocked(f.api.operate).mockRejectedValueOnce(problem(403, "FORBIDDEN"));
    f.c.prepare();
    await f.c.confirm();
    expect(f.c.getSnapshot()).toMatchObject({
      locked: true,
      card: null,
      command: { operationId: "confirmation-operation-one" },
    });
    expect(f.memory.size).toBe(1);
  });
  it.each([
    "broken",
    "null",
    "[]",
    JSON.stringify({
      operationId: "valid-command",
      rowVersion: 1,
      action: "PUBLISH",
    }),
    JSON.stringify({
      operationId: "valid-command",
      rowVersion: 1,
      action: "CONFIRM",
      amount: 1,
    }),
  ])("does not remove or send damaged saved record %s", async (saved) => {
    const f = fixture({ saved });
    await f.c.start();
    await f.c.query();
    await f.c.replay();
    await f.c.refresh();
    f.c.prepare();
    await f.c.confirm();
    expect(f.memory.get(f.key)).toBe(saved);
    expect(f.api.read).not.toHaveBeenCalled();
    expect(f.api.operation).not.toHaveBeenCalled();
    expect(f.api.operate).not.toHaveBeenCalled();
    expect(f.c.getSnapshot().locked).toBe(true);
  });
  it("rejects mismatched original operation result without forgetting pending command", async () => {
    const saved = JSON.stringify({
      operationId: "original-operation",
      rowVersion: 1,
      action: "CONFIRM",
    });
    const f = fixture({ saved });
    vi.mocked(f.api.operation).mockResolvedValueOnce({
      operationId: "wrong-operation",
      action: "CONFIRM",
      rowVersion: 2,
      confirmation: confirmed,
    });
    await f.c.start();
    expect(f.memory.get(f.key)).toBe(saved);
    expect(f.c.getSnapshot().replay).toBe(false);
    expect(f.c.getSnapshot().error).toBeTruthy();
  });
  it("keeps known original success separate when current read fails", async () => {
    const f = fixture({
      saved: JSON.stringify({
        operationId: "original-operation",
        rowVersion: 1,
        action: "CONFIRM",
      }),
    });
    vi.mocked(f.api.read).mockRejectedValueOnce(
      new Error("current unavailable"),
    );
    await f.c.start();
    expect(f.c.getSnapshot().result?.confirmation.status).toBe(
      "CONFIRMED_MANUAL",
    );
    expect(f.c.getSnapshot().card).toBeNull();
    expect(f.c.getSnapshot().error).toBeTruthy();
    expect(f.memory.size).toBe(0);
  });
  it("rejects an original buyer confirmation attributed to another identity", async () => {
    const saved = JSON.stringify({
      operationId: "original-operation",
      rowVersion: 1,
      action: "CONFIRM",
    });
    const f = fixture({ saved });
    vi.mocked(f.api.operation).mockResolvedValueOnce({
      operationId: "original-operation",
      action: "CONFIRM",
      rowVersion: 2,
      confirmation: { ...confirmed, confirmedBy: "different-buyer" },
    });
    await f.c.start();
    expect(f.memory.get(f.key)).toBe(saved);
    expect(f.c.getSnapshot().result).toBeNull();
    expect(f.c.getSnapshot().replay).toBe(false);
  });
  it("does not erase another mounted identity pending command when an old write completes", async () => {
    const f = fixture();
    await f.c.start();
    const late = deferred<LocalOrderConfirmationOperationDto>();
    vi.mocked(f.api.operate).mockReturnValueOnce(late.promise);
    f.c.prepare();
    const submit = f.c.confirm();
    const raw = f.memory.get(f.key);
    f.c.stop();
    const other = fixture({ identity: "another-buyer" });
    await other.c.start();
    late.resolve({
      operationId: "confirmation-operation-one",
      action: "CONFIRM",
      rowVersion: 2,
      confirmation: confirmed,
    });
    await submit;
    expect(f.memory.get(f.key)).toBe(raw);
    expect(f.c.getSnapshot().result).toBeNull();
    expect(other.c.getSnapshot().card?.status).toBe("SENT");
    expect(other.commands).toEqual([]);
  });
  it("does not send a write if its recovery record cannot be saved", async () => {
    let writes = 0;
    const c = createOrderConfirmationController({
      orderId: "order",
      identity: "buyer",
      action: "CONFIRM",
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("storage blocked");
        },
        removeItem: () => {},
      },
      api: {
        read: async () => row,
        operate: async () => {
          writes++;
          throw new Error("unexpected");
        },
        operation: async () => {
          throw new Error("unused");
        },
      },
    });
    controllers.push(c);
    await c.start();
    c.prepare();
    await c.confirm();
    expect(writes).toBe(0);
    expect(c.getSnapshot().error).toContain("未发送");
  });
  it("reads updated facts after version conflict without auto retry or discarding the reason", async () => {
    const f = fixture();
    await f.c.start();
    f.set({
      ...row,
      canConfirm: false,
      blockedReason: "LOCAL_CONFIRMATION_ORDER_VERSION_CHANGED",
    });
    vi.mocked(f.api.operate).mockRejectedValueOnce(
      problem(409, "DATA_VERSION_CONFLICT"),
    );
    f.c.prepare();
    await f.c.confirm();
    expect(f.c.getSnapshot().card?.blockedReason).toBe(
      "LOCAL_CONFIRMATION_ORDER_VERSION_CHANGED",
    );
    expect(f.c.getSnapshot().error).toContain("DATA_VERSION_CONFLICT");
    expect(f.memory.size).toBe(0);
    expect(f.api.operate).toHaveBeenCalledTimes(1);
  });
  it("does not expose a stale read after stop or let seller/empty identity act", async () => {
    const f = fixture();
    const load = deferred<LocalOrderConfirmationDto>();
    vi.mocked(f.api.read).mockReturnValueOnce(load.promise);
    const start = f.c.start();
    f.c.stop();
    load.resolve(row);
    await start;
    expect(f.c.getSnapshot().card).toBeNull();
    for (const options of [{ action: null }, { identity: "" }]) {
      const x = fixture(options);
      await x.c.start();
      x.c.prepare();
      await x.c.confirm();
      expect(x.commands).toEqual([]);
    }
  });
  it("polls visible client every five seconds, pauses hidden and backs off failure", async () => {
    vi.useFakeTimers();
    const f = fixture({ pollMs: 5000 });
    await f.c.start();
    expect(f.api.read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.api.read).toHaveBeenCalledTimes(2);
    f.c.setVisible(false);
    await vi.advanceTimersByTimeAsync(20000);
    expect(f.api.read).toHaveBeenCalledTimes(2);
    f.c.setVisible(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.api.read).toHaveBeenCalledTimes(3);
    vi.mocked(f.api.read).mockRejectedValueOnce(new Error("offline"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.api.read).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.api.read).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.api.read).toHaveBeenCalledTimes(5);
  });
  it("never polls over an open confirmation or unresolved operation", async () => {
    vi.useFakeTimers();
    const f = fixture({ pollMs: 5000 });
    await f.c.start();
    f.c.prepare();
    await vi.advanceTimersByTimeAsync(15000);
    expect(f.api.read).toHaveBeenCalledTimes(1);
    vi.mocked(f.api.operate).mockRejectedValueOnce(new Error("lost"));
    await f.c.confirm();
    await vi.advanceTimersByTimeAsync(15000);
    expect(f.api.read).toHaveBeenCalledTimes(1);
  });
  it("client adapter uses only bound client paths, exact command key and strict response", async () => {
    const read = vi.fn(
      async (_path: string, parse: (v: unknown) => unknown) => ({
        data: parse(row),
      }),
    );
    const write = vi.fn(
      async (
        _path: string,
        command: LocalOrderConfirmationCommand,
        _key: string,
        parse: (v: unknown) => unknown,
      ) => ({
        data: parse({
          operationId: command.operationId,
          action: "CONFIRM",
          rowVersion: 2,
          confirmation: confirmed,
        }),
      }),
    );
    const api = createRestoredConfirmationApi(
      { read, write } as unknown as Parameters<
        typeof createRestoredConfirmationApi
      >[0],
      "order",
    );
    await api.read();
    await api.operate({
      operationId: "adapter-original",
      action: "CONFIRM",
      rowVersion: 1,
    });
    expect(read.mock.calls[0][0]).toBe(
      "/client/orders/order/local-confirmation",
    );
    expect(write.mock.calls[0].slice(0, 3)).toEqual([
      "/client/orders/order/local-confirmation/operations",
      { operationId: "adapter-original", rowVersion: 1, action: "CONFIRM" },
      "adapter-original",
    ]);
  });
});
