import { describe, expect, it, vi } from "vitest";
import type {
  LocalOrderFulfillmentDto,
  LocalOrderFulfillmentCommand,
} from "../../../运营平台/packages/contracts/src/order-fulfillment";
import {
  createOrderLocalFulfillmentController,
  availableFulfillmentActions,
  parseLocalFulfillment,
  createRestoredLocalFulfillmentApi,
} from "./order-local-fulfillment";
import { createRestoredLinkedTransport } from "./restoredLinkedTransport";

export const facts: LocalOrderFulfillmentDto = {
  orderId: "order",
  provenance: "LOCAL_DEMO",
  rowVersion: 7,
  state: "WAITING_GATES",
  gates: {
    settlement: {
      status: "PENDING",
      operationId: null,
      actorId: null,
      at: null,
    },
    risk: { status: "PENDING", operationId: null, actorId: null, at: null },
  },
  conversationId: null,
  imConversationId: null,
  assigneeUserId: null,
  templateSnapshot: null,
  steps: [],
  canOperate: true,
  blockedReason: "LOCAL_FULFILLMENT_GATES_PENDING",
};
function fixture(canExecute = true, canAdvance = true) {
  const memory = new Map<string, string>();
  let latest = structuredClone(facts);
  const api = {
    read: vi.fn(async () => latest),
    operation: vi.fn(async (_id: string): Promise<never> => {
      throw Object.assign(new Error("未找到操作"), {
        status: 404,
        code: "LOCAL_FULFILLMENT_OPERATION_NOT_FOUND",
      });
    }),
    operate: vi.fn(async (command: LocalOrderFulfillmentCommand) => ({
      operationId: command.operationId,
      action: command.action,
      rowVersion: 8,
      fulfillment: { ...latest, rowVersion: 8 },
    })),
  };
  const controller = createOrderLocalFulfillmentController({
    orderId: "order",
    identity: "admin",
    canExecute,
    canAdvance,
    api,
    storage: {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => {
        memory.set(k, v);
      },
      removeItem: (k) => {
        memory.delete(k);
      },
    },
    createId: () => "fulfillment-original-one",
  });
  return {
    controller,
    api,
    memory,
    setLatest: (value: LocalOrderFulfillmentDto) => {
      latest = value;
    },
  };
}
describe("local fulfillment authority and recovery", () => {
  it("locks and preserves a saved step when the original-result GET returns 403 after workbench permission loss", async () => {
    const f = fixture(true, false),
      key = "deepgamer:order-local-fulfillment:v1:admin:order";
    const command = {
      operationId: "committed-step-original",
      rowVersion: 7,
      action: "COMPLETE_STEP" as const,
      stepCode: "MATERIAL_SYNC" as const,
    };
    const raw = JSON.stringify({
      identity: "admin",
      orderId: "order",
      command,
    });
    f.memory.set(key, raw);
    f.api.operation.mockRejectedValueOnce(
      Object.assign(new Error("恢复工作台权限才能读取步骤结果"), {
        status: 403,
        code: "FORBIDDEN",
      }),
    );
    await f.controller.start();
    await f.controller.query();
    await f.controller.replay();
    await f.controller.refresh();
    f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
    await f.controller.confirm();
    expect(f.controller.getSnapshot()).toMatchObject({
      fulfillment: null,
      command,
      unknown: true,
      replay: false,
      confirmation: null,
      error: "恢复工作台权限才能读取步骤结果",
    });
    expect(f.memory.get(key)).toBe(raw);
    expect(f.api.operation).toHaveBeenCalledTimes(1);
    expect(f.api.read).not.toHaveBeenCalled();
    expect(f.api.operate).not.toHaveBeenCalled();
  });
  it.each([
    { action: "COMPLETE_STEP" as const, stepCode: "MATERIAL_SYNC" as const },
    { action: "SIMULATE_RISK_PASS" as const },
  ])(
    "queries saved $action after workbench permission loss but only gates may replay",
    async (choice) => {
      const f = fixture(true, false),
        key = "deepgamer:order-local-fulfillment:v1:admin:order";
      const command = {
        operationId: "operation-original",
        rowVersion: 7,
        ...choice,
      };
      const raw = JSON.stringify({
        identity: "admin",
        orderId: "order",
        command,
      });
      f.memory.set(key, raw);
      await f.controller.start();
      expect(f.api.operation).toHaveBeenCalledWith("operation-original");
      const replayAllowed = choice.action !== "COMPLETE_STEP";
      expect(f.controller.getSnapshot()).toMatchObject({
        command,
        unknown: true,
        replay: replayAllowed,
      });
      await f.controller.replay();
      if (replayAllowed) {
        expect(f.api.operate).toHaveBeenCalledWith(command);
        expect(f.memory.has(key)).toBe(false);
      } else {
        expect(f.api.operate).not.toHaveBeenCalled();
        expect(f.memory.get(key)).toBe(raw);
        await f.controller.query();
        expect(f.api.operation).toHaveBeenCalledTimes(2);
        expect(f.controller.getSnapshot().replay).toBe(false);
      }
    },
  );
  it("uses only fulfillment rowVersion and requires explicit confirmation before writing", async () => {
    const f = fixture();
    await f.controller.start();
    f.controller.prepare({ action: "SIMULATE_SETTLEMENT_PASS" });
    expect(f.api.operate).not.toHaveBeenCalled();
    await f.controller.refresh();
    expect(f.controller.getSnapshot().confirmation?.action).toBe(
      "SIMULATE_SETTLEMENT_PASS",
    );
    await f.controller.confirm();
    expect(f.api.operate.mock.calls[0][0]).toEqual({
      operationId: "fulfillment-original-one",
      rowVersion: 7,
      action: "SIMULATE_SETTLEMENT_PASS",
    });
    expect(f.api.read).toHaveBeenCalledTimes(2);
  });
  it("allows gates independently but requires both before creating a group", () => {
    expect(availableFulfillmentActions(facts, "admin", true)).toEqual([
      { action: "SIMULATE_SETTLEMENT_PASS" },
      { action: "SIMULATE_RISK_PASS" },
    ]);
    const one = {
      ...facts,
      gates: {
        ...facts.gates,
        settlement: {
          ...facts.gates.settlement,
          status: "SIMULATED_PASS" as const,
        },
      },
    };
    expect(availableFulfillmentActions(one, "admin", true)).toEqual([
      { action: "SIMULATE_RISK_PASS" },
    ]);
    expect(
      availableFulfillmentActions(
        {
          ...one,
          state: "WAITING_GROUP",
          gates: { ...one.gates, risk: one.gates.settlement },
        },
        "admin",
        true,
      ),
    ).toEqual([{ action: "CREATE_GROUP" }]);
  });
  it("requires assignment, current step, predecessors and workbench page permission; never opens final step", () => {
    const linked: LocalOrderFulfillmentDto = {
      ...facts,
      state: "LINKED",
      assigneeUserId: "admin",
      steps: [
        {
          stepCode: "MATERIAL_SYNC",
          name: "资料同步",
          status: "CURRENT",
          completedAt: null,
          canOperate: true,
          blockedReason: null,
        },
        {
          stepCode: "BUYER_VERIFY",
          name: "买家验号",
          status: "PENDING",
          completedAt: null,
          canOperate: true,
          blockedReason: null,
        },
        {
          stepCode: "CONFIRM_COMPLETE",
          name: "确认完成",
          status: "CURRENT",
          completedAt: null,
          canOperate: true,
          blockedReason: null,
        },
      ],
    };
    expect(availableFulfillmentActions(linked, "admin", true)).toEqual([
      { action: "COMPLETE_STEP", stepCode: "MATERIAL_SYNC" },
    ]);
    expect(availableFulfillmentActions(linked, "admin", false)).toEqual([]);
    expect(
      availableFulfillmentActions(
        { ...linked, assigneeUserId: null },
        "admin",
        true,
      ),
    ).toEqual([]);
    expect(availableFulfillmentActions(linked, "other", true)).toEqual([]);
  });
  it.each([0, 1, 2, 3])(
    "exposes only sequential current step %i, with no completion action for final confirmation",
    (index) => {
      const codes = [
        "MATERIAL_SYNC",
        "BUYER_VERIFY",
        "BIND_PHONE",
        "CONFIRM_COMPLETE",
      ] as const;
      const linked: LocalOrderFulfillmentDto = {
        ...facts,
        state: "LINKED",
        assigneeUserId: "admin",
        steps: codes.map((stepCode, i) => ({
          stepCode,
          name: stepCode,
          status: i < index ? "DONE" : i === index ? "CURRENT" : "PENDING",
          completedAt: i < index ? "2026-09-29" : null,
          canOperate: true,
          blockedReason: null,
        })),
      };
      expect(availableFulfillmentActions(linked, "admin", true)).toEqual(
        index < 3 ? [{ action: "COMPLETE_STEP", stepCode: codes[index] }] : [],
      );
    },
  );
  it("does not advance from a malformed predecessor sequence even if the current step is enabled", () => {
    const linked: LocalOrderFulfillmentDto = {
      ...facts,
      state: "LINKED",
      assigneeUserId: "admin",
      steps: [
        {
          stepCode: "BUYER_VERIFY",
          name: "错误前序",
          status: "DONE",
          completedAt: "2026-09-29",
          canOperate: false,
          blockedReason: null,
        },
        {
          stepCode: "BUYER_VERIFY",
          name: "买家验号",
          status: "CURRENT",
          completedAt: null,
          canOperate: true,
          blockedReason: null,
        },
      ],
    };
    expect(availableFulfillmentActions(linked, "admin", true)).toEqual([]);
  });
  it("client adapter only reads its owned-order endpoint and validates every response", async () => {
    const calls: string[] = [];
    const transport = {
      read: async (path: string, parse: (value: unknown) => unknown) => {
        calls.push(path);
        return { data: parse({ ...facts, canOperate: false }) };
      },
    } as unknown as ReturnType<typeof createRestoredLinkedTransport>;
    expect(
      (await createRestoredLocalFulfillmentApi(transport, "order").read())
        .canOperate,
    ).toBe(false);
    expect(calls).toEqual(["/client/orders/order/local-fulfillment"]);
    expect(
      Object.keys(createRestoredLocalFulfillmentApi(transport, "order")),
    ).toEqual(["read"]);
  });
  it("duplicate confirmation is suppressed while the same command is pending", async () => {
    const f = fixture();
    await f.controller.start();
    let resolve!: (value: Awaited<ReturnType<typeof f.api.operate>>) => void;
    f.api.operate.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
    const first = f.controller.confirm();
    await f.controller.confirm();
    expect(f.api.operate).toHaveBeenCalledTimes(1);
    resolve({
      operationId: "fulfillment-original-one",
      action: "SIMULATE_RISK_PASS",
      rowVersion: 8,
      fulfillment: { ...facts, rowVersion: 8 },
    });
    await first;
  });
  it("locks a lost response, queries before replay, and sends exactly the original payload", async () => {
    const f = fixture();
    await f.controller.start();
    f.api.operate.mockRejectedValueOnce(new Error("离线"));
    f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
    await f.controller.confirm();
    await f.controller.replay();
    expect(f.api.operate).toHaveBeenCalledTimes(1);
    await f.controller.refresh();
    expect(f.api.read).toHaveBeenCalledTimes(1);
    await f.controller.query();
    expect(f.controller.getSnapshot().replay).toBe(true);
    f.setLatest({ ...facts, rowVersion: 9 });
    await f.controller.replay();
    expect(f.api.operate.mock.calls.map((c) => c[0])).toEqual([
      {
        operationId: "fulfillment-original-one",
        rowVersion: 7,
        action: "SIMULATE_RISK_PASS",
      },
      {
        operationId: "fulfillment-original-one",
        rowVersion: 7,
        action: "SIMULATE_RISK_PASS",
      },
    ]);
    expect(f.controller.getSnapshot().fulfillment?.rowVersion).toBe(9);
    expect(f.memory.size).toBe(0);
  });
  it.each(["ORDER_NOT_FOUND", "OTHER_NOT_FOUND"])(
    "does not replay %s and clears private facts while preserving unresolved storage",
    async (code) => {
      const f = fixture();
      await f.controller.start();
      f.api.operate.mockRejectedValueOnce(new Error("离线"));
      f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
      await f.controller.confirm();
      f.api.operation.mockRejectedValueOnce(
        Object.assign(new Error("订单失去访问"), { status: 404, code }),
      );
      await f.controller.query();
      await f.controller.replay();
      expect(f.api.operate).toHaveBeenCalledTimes(1);
      expect(f.controller.getSnapshot()).toMatchObject({
        fulfillment: null,
        replay: false,
      });
      expect(f.memory.size).toBe(1);
    },
  );
  it.each([
    null,
    [],
    {
      identity: "other",
      orderId: "order",
      command: {
        action: "CREATE_GROUP",
        rowVersion: 7,
        operationId: "operation-123",
      },
    },
    {
      identity: "admin",
      orderId: "other",
      command: {
        action: "CREATE_GROUP",
        rowVersion: 7,
        operationId: "operation-123",
      },
    },
    {
      identity: "admin",
      orderId: "order",
      command: {
        action: "COMPLETE_STEP",
        stepCode: "CONFIRM_COMPLETE",
        rowVersion: 7,
        operationId: "operation-123",
      },
    },
    {
      identity: "admin",
      orderId: "order",
      command: {
        action: "CREATE_GROUP",
        rowVersion: 7,
        operationId: "operation-123",
        extra: true,
      },
    },
  ])(
    "preserves corrupt or cross-subject saved record %j and blocks reads and writes",
    async (value) => {
      const f = fixture(),
        raw = JSON.stringify(value);
      f.memory.set("deepgamer:order-local-fulfillment:v1:admin:order", raw);
      await f.controller.start();
      await f.controller.refresh();
      await f.controller.query();
      await f.controller.replay();
      f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
      await f.controller.confirm();
      expect(f.memory.values().next().value).toBe(raw);
      expect(f.api.read).not.toHaveBeenCalled();
      expect(f.api.operation).not.toHaveBeenCalled();
      expect(f.api.operate).not.toHaveBeenCalled();
      expect(f.controller.getSnapshot().error).toMatch(/损坏/);
    },
  );
  it("recovers saved operation by querying first then GETs latest instead of displaying historical operation facts", async () => {
    const f = fixture();
    f.memory.set(
      "deepgamer:order-local-fulfillment:v1:admin:order",
      JSON.stringify({
        identity: "admin",
        orderId: "order",
        command: {
          action: "SIMULATE_RISK_PASS",
          operationId: "operation-original",
          rowVersion: 7,
        },
      }),
    );
    f.api.operation.mockResolvedValueOnce({
      operationId: "operation-original",
      action: "SIMULATE_RISK_PASS",
      rowVersion: 8,
      fulfillment: { ...facts, rowVersion: 8 },
    } as never);
    f.setLatest({ ...facts, rowVersion: 12 });
    await f.controller.start();
    expect(f.api.operation).toHaveBeenCalledWith("operation-original");
    expect(f.api.operate).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().fulfillment?.rowVersion).toBe(12);
  });
  it("rejects mismatched operation action and keeps it unknown", async () => {
    const f = fixture();
    await f.controller.start();
    f.api.operate.mockResolvedValueOnce({
      operationId: "fulfillment-original-one",
      action: "CREATE_GROUP",
      rowVersion: 8,
      fulfillment: { ...facts, rowVersion: 8 },
    });
    f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
    await f.controller.confirm();
    expect(f.controller.getSnapshot().unknown).toBe(true);
    expect(f.memory.size).toBe(1);
  });
  it("known conflict stays visible and refreshes latest facts without another write", async () => {
    const f = fixture();
    await f.controller.start();
    f.api.operate.mockRejectedValueOnce(
      Object.assign(new Error("版本冲突"), { status: 409 }),
    );
    f.setLatest({ ...facts, rowVersion: 9 });
    f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
    await f.controller.confirm();
    expect(f.controller.getSnapshot()).toMatchObject({
      error: "版本冲突",
      fulfillment: { rowVersion: 9 },
      command: null,
    });
    expect(f.api.operate).toHaveBeenCalledTimes(1);
  });
  it("read-only identities never query cached admin operations or prepare writes", async () => {
    const f = fixture(false);
    await f.controller.start();
    f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
    await f.controller.confirm();
    expect(f.controller.getSnapshot().confirmation).toBeNull();
    expect(f.api.operate).not.toHaveBeenCalled();
    expect(f.api.operation).not.toHaveBeenCalled();
  });
  it("permission loss and stop clear facts; late former identity response cannot publish", async () => {
    const f = fixture();
    await f.controller.start();
    f.api.read.mockRejectedValueOnce(
      Object.assign(new Error("无权限"), { status: 403 }),
    );
    await f.controller.refresh();
    expect(f.controller.getSnapshot().fulfillment).toBeNull();
    f.controller.prepare({ action: "SIMULATE_RISK_PASS" });
    expect(f.controller.getSnapshot().confirmation).toBeNull();
    const g = fixture();
    let resolve!: (value: LocalOrderFulfillmentDto) => void;
    g.api.read.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const load = g.controller.start();
    g.controller.stop();
    resolve(facts);
    await load;
    expect(g.controller.getSnapshot().fulfillment).toBeNull();
  });
  it("rejects malformed and cross-order response facts", () => {
    expect(() =>
      parseLocalFulfillment({ ...facts, orderId: "other" }, "order"),
    ).toThrow();
    expect(() =>
      parseLocalFulfillment(
        { ...facts, steps: [{ stepCode: "UNKNOWN" }] },
        "order",
      ),
    ).toThrow();
  });
});
