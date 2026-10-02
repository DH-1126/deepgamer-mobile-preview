/// <reference path="../../../运营平台/apps/admin-api/node_modules/@types/node/index.d.ts" />
import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import React, { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RestoredOrderConfirmationView } from "./RestoredOrderConfirmation";
import {
  createOrderConfirmationController,
  type ConfirmationSnapshot,
} from "../linked/order-confirmation";
import type {
  LocalOrderConfirmationDto,
  LocalOrderConfirmationOperationDto,
} from "../../../运营平台/packages/contracts/src/order-confirmation";

const { JSDOM } = createRequire(
  new URL("../../../运营平台/apps/admin-web/package.json", import.meta.url),
)("jsdom");
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
let root: Root | undefined;
let dom: InstanceType<typeof JSDOM>;
const originals = new Map<string, PropertyDescriptor | undefined>();
const active: ReturnType<typeof createOrderConfirmationController>[] = [];
function setup(width: number) {
  dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', {
    url: "http://localhost/",
  });
  // jsdom has no layout engine. Give focusable elements visible rectangles so
  // the real shared Dialog can exercise its browser visibility/focus contract.
  dom.window.HTMLElement.prototype.getClientRects = () =>
    [{ width: 44, height: 44 }] as unknown as DOMRectList;
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const mount = document.getElementById("mount")!;
  mount.style.width = `${width}px`;
  root = createRoot(mount);
  return mount;
}
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  active.splice(0).forEach((c) => c.stop());
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  originals.clear();
  dom?.window.close();
});
const button = (label: string) => {
  const found = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  expect(found, label).toBeTruthy();
  return found!;
};
describe("mounted buyer confirmation card", () => {
  it.each(["write", "query"])(
    "shows immutable confirmation after %s success when current GET fails, never stale SENT or capabilities",
    async (mode) => {
      setup(390);
      let reads = 0,
        writes = 0;
      const result: LocalOrderConfirmationOperationDto = {
        operationId: "successful-buyer-operation",
        action: "CONFIRM",
        rowVersion: 2,
        confirmation: {
          ...row,
          rowVersion: 2,
          status: "CONFIRMED_MANUAL",
          canConfirm: false,
          confirmedBy: "buyer",
          confirmedAt: "2026-09-29T03:01:00.000Z",
        },
      };
      const c = createOrderConfirmationController({
        orderId: "order",
        identity: "buyer",
        action: "CONFIRM",
        storage: window.sessionStorage,
        createId: () => result.operationId,
        api: {
          read: async () => {
            if (++reads > 1) throw new Error("当前事实读取失败");
            return row;
          },
          operate: async () => {
            writes++;
            if (mode === "query") throw new Error("lost reply");
            return result;
          },
          operation: async () => result,
        },
      });
      active.push(c);
      function Harness() {
        const s = useSyncExternalStore(
          c.subscribe,
          c.getSnapshot,
          c.getSnapshot,
        );
        return (
          <RestoredOrderConfirmationView snapshot={s} controller={c} buyer />
        );
      }
      await act(async () => {
        root!.render(<Harness />);
        await c.start();
      });
      await act(async () => button("确认交易（本地模拟）").click());
      await act(async () => button("确认交易").click());
      if (mode === "query") await act(async () => button("查询原操作").click());
      expect(document.body.textContent).toContain(
        "原操作已核验：买家确认已记录",
      );
      expect(document.body.textContent).toContain(
        result.confirmation.confirmedAt,
      );
      expect(document.body.textContent).not.toContain("尚未确认");
      expect(document.body.textContent).not.toContain("待买家确认");
      expect(c.getSnapshot().card).toBeNull();
      expect(button("确认交易（本地模拟）").disabled).toBe(true);
      c.prepare();
      await c.confirm();
      expect(writes).toBe(1);
      expect(c.getSnapshot().result?.confirmation.status).toBe(
        "CONFIRMED_MANUAL",
      );
    },
  );
  it("requires a real dialog, supports cancel/Escape/Tab and restores focus at 320px", async () => {
    setup(320);
    let latest = row;
    let writes = 0;
    let finish!: (result: LocalOrderConfirmationOperationDto) => void;
    const c = createOrderConfirmationController({
      orderId: "order",
      identity: "buyer",
      action: "CONFIRM",
      storage: window.sessionStorage,
      api: {
        read: async () => latest,
        operation: async () => {
          throw new Error("unused");
        },
        operate: async () => {
          writes++;
          return new Promise((done) => {
            finish = done;
          });
        },
      },
      createId: () => "mounted-buyer-confirm",
    });
    active.push(c);
    function Harness({
      buyer = true,
      snapshot,
    }: {
      buyer?: boolean;
      snapshot?: ConfirmationSnapshot;
    }) {
      const s = useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
      return (
        <RestoredOrderConfirmationView
          snapshot={snapshot ?? s}
          controller={c}
          buyer={buyer}
        />
      );
    }
    await act(async () => {
      root!.render(<Harness />);
      await c.start();
    });
    expect(document.body.textContent).toContain("待买家确认");
    expect(document.body.textContent).toContain(
      "确认动作本身不触发入账，资金状态见独立清分回执",
    );
    expect(document.body.textContent).not.toContain("尚未放款");
    const trigger = button("确认交易（本地模拟）");
    trigger.focus();
    await act(async () => trigger.click());
    expect(writes).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    await act(async () => {
      await new Promise((done) => window.setTimeout(done, 5));
    });
    expect(document.activeElement).toBe(button("取消"));
    button("确认交易").focus();
    await act(async () =>
      window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(button("取消"));
    await act(async () =>
      window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await act(async () => trigger.click());
    await act(async () => button("取消").click());
    expect(document.activeElement).toBe(trigger);
    await act(async () => trigger.click());
    await act(async () => button("确认交易").click());
    expect(writes).toBe(1);
    expect(button("提交中…").disabled).toBe(true);
    expect(button("取消").disabled).toBe(true);
    await act(async () =>
      window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    latest = {
      ...row,
      status: "CONFIRMED_MANUAL",
      rowVersion: 2,
      canConfirm: false,
      confirmedBy: "buyer",
      confirmedAt: "2026-09-29T03:01:00.000Z",
    };
    await act(async () => {
      finish({
        operationId: "mounted-buyer-confirm",
        action: "CONFIRM",
        rowVersion: 2,
        confirmation: latest,
      });
    });
    await act(async () => {
      await new Promise((done) => window.setTimeout(done, 5));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toContain("已确认（清分状态见独立回执）");
    expect(document.body.textContent).toContain(
      "确认动作本身不触发入账，资金状态见独立清分回执",
    );
    expect(button("确认交易（本地模拟）").disabled).toBe(true);
    expect(document.activeElement).toBe(button("刷新确认状态"));
    await act(async () => root!.render(<Harness buyer={false} />));
    expect(document.body.textContent).toContain("卖家仅可查看");
    expect(
      [...document.querySelectorAll("button")].some((b) =>
        b.textContent?.includes("确认交易"),
      ),
    ).toBe(false);
  });
  it("shows pending, server disabled reason, error, recovery and stale state without granting buyer action at 390px", async () => {
    setup(390);
    const c = createOrderConfirmationController({
      orderId: "order",
      identity: "buyer",
      action: "CONFIRM",
      storage: window.sessionStorage,
      api: {
        read: async () => row,
        operate: async () => {
          throw new Error("unused");
        },
        operation: async () => {
          throw new Error("unused");
        },
      },
    });
    active.push(c);
    const base: ConfirmationSnapshot = {
      card: row,
      result: null,
      loading: false,
      busy: false,
      error: null,
      unknown: false,
      replay: false,
      locked: false,
      command: null,
      confirmation: null,
    };
    await act(async () =>
      root!.render(
        <RestoredOrderConfirmationView
          snapshot={{
            ...base,
            card: {
              ...row,
              rowVersion: 0,
              status: "NOT_SENT",
              cardId: null,
              publishedAt: null,
              canConfirm: false,
            },
          }}
          controller={c}
          buyer
        />,
      ),
    );
    expect(document.body.textContent).toContain("待发布");
    expect(button("确认交易（本地模拟）").disabled).toBe(true);
    await act(async () =>
      root!.render(
        <RestoredOrderConfirmationView
          snapshot={{
            ...base,
            card: {
              ...row,
              canConfirm: false,
              blockedReason: "LOCAL_CONFIRMATION_ORDER_VERSION_CHANGED",
            },
          }}
          controller={c}
          buyer
        />,
      ),
    );
    expect(document.body.textContent).toContain("订单版本已变化");
    expect(button("确认交易（本地模拟）").disabled).toBe(true);
    await act(async () =>
      root!.render(
        <RestoredOrderConfirmationView
          snapshot={{
            ...base,
            error: "网络结果未知",
            unknown: true,
            replay: true,
            command: {
              operationId: "original-pending-operation",
              action: "CONFIRM",
              rowVersion: 1,
            },
          }}
          controller={c}
          buyer
        />,
      ),
    );
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "网络结果未知",
    );
    expect(button("重发原请求")).toBeTruthy();
    expect(button("确认交易（本地模拟）").disabled).toBe(true);
    await act(async () =>
      root!.render(
        <RestoredOrderConfirmationView
          snapshot={{
            ...base,
            error: "权限已变化",
            locked: true,
            command: {
              operationId: "original-pending-operation",
              action: "CONFIRM",
              rowVersion: 1,
            },
          }}
          controller={c}
          buyer
        />,
      ),
    );
    expect(button("查询原操作").disabled).toBe(true);
  });
});
