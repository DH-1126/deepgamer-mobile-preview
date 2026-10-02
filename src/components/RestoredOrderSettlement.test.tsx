/// <reference path="../../../运营平台/apps/admin-api/node_modules/@types/node/index.d.ts" />
import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { LocalOrderSettlementDto } from "../../../运营平台/packages/contracts/src/order-settlement";
import { RestoredOrderSettlementView } from "./RestoredOrderSettlement";
import type { RestoredSettlementSnapshot } from "../linked/order-settlement";

const { JSDOM } = createRequire(
  new URL("../../../运营平台/apps/admin-web/package.json", import.meta.url),
)("jsdom");
let root: Root | undefined;
let dom: InstanceType<typeof JSDOM>;
const originals = new Map<string, PropertyDescriptor | undefined>();

function setup(width: number) {
  dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', {
    url: "http://localhost/",
  });
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
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  originals.clear();
  dom?.window.close();
});

const ready: LocalOrderSettlementDto = {
  orderId: "order-one",
  provenance: "LOCAL_DEMO",
  rowVersion: 7,
  status: "READY",
  canSettle: false,
  blockedReason: null,
  receipt: null,
};
const settled: LocalOrderSettlementDto = {
  ...ready,
  rowVersion: 8,
  status: "SETTLED",
  receipt: {
    settlementId: "settlement-with-a-very-long-local-demo-id",
    operationId: "settlement-operation-one",
    settledAt: "2026-09-30T04:00:00.000Z",
    currency: "CNY",
    goodsAmountFen: 10_000,
    serviceFeeFen: 500,
    paidAmountFen: 10_500,
    sellerAccountId: "seller-account-one",
    sellerCreditFen: 10_000,
    platformCreditFen: 500,
    pricingVersion: "operations-service-fee:fee-one:approval-v1",
  },
};
const snapshot = (
  settlement: LocalOrderSettlementDto,
): RestoredSettlementSnapshot => ({
  orderId: settlement.orderId,
  identity: "buyer-one",
  settlement,
  loading: false,
  error: null,
  locked: false,
});

describe("restored buyer and seller settlement receipt", () => {
  it("renders READY as readonly backend work without exposing an action or wallet balance", async () => {
    setup(320);
    await act(async () =>
      root!.render(
        <RestoredOrderSettlementView
          snapshot={snapshot(ready)}
          onRefresh={() => undefined}
        />,
      ),
    );
    expect(document.body.textContent).toContain("待后台显式模拟清分");
    expect(document.body.textContent).toContain("买卖方仅可读");
    expect(document.body.textContent).not.toContain("执行清分");
    expect(document.body.textContent).not.toContain("钱包余额");
  });

  it("shows only the frozen per-order receipt and wraps identifiers at 390px", async () => {
    setup(390);
    await act(async () =>
      root!.render(
        <RestoredOrderSettlementView
          snapshot={snapshot(settled)}
          onRefresh={() => undefined}
        />,
      ),
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain("已清分");
    expect(text).toContain("¥100.00");
    expect(text).toContain("¥5.00");
    expect(text).toContain("¥105.00");
    expect(text).toContain("settlement-with-a-very-long-local-demo-id");
    expect(text).toContain("2026-09-30T04:00:00.000Z");
    expect(text).toContain("operations-service-fee:fee-one:approval-v1");
    expect(text).toContain("本地演示回执，不代表真实资金到账");
    expect(text).not.toContain("钱包余额");
    const receipt = document.querySelector<HTMLElement>(
      '[data-settlement-receipt="true"]',
    );
    expect(receipt?.style.overflowWrap).toBe("anywhere");
  });
});
