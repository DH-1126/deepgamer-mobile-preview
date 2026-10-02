import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { RestoredOrderLocalFulfillmentView } from "./RestoredOrderLocalFulfillment";
import type { LocalFulfillmentSnapshot } from "../linked/order-local-fulfillment";
const base: LocalFulfillmentSnapshot = {
  fulfillment: null,
  loading: false,
  busy: false,
  error: null,
  unknown: false,
  replay: false,
  command: null,
  confirmation: null,
};
describe("client local fulfillment read-only view", () => {
  it("explains pending gates in Chinese without exposing the backend reason code", () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <RestoredOrderLocalFulfillmentView
          onRefresh={() => {}}
          snapshot={{
            ...base,
            fulfillment: {
              orderId: "order",
              provenance: "LOCAL_DEMO",
              rowVersion: 0,
              state: "WAITING_GATES",
              gates: {
                settlement: {
                  status: "PENDING",
                  operationId: null,
                  actorId: null,
                  at: null,
                },
                risk: {
                  status: "PENDING",
                  operationId: null,
                  actorId: null,
                  at: null,
                },
              },
              conversationId: null,
              imConversationId: null,
              assigneeUserId: null,
              templateSnapshot: null,
              steps: [],
              canOperate: false,
              blockedReason: "LOCAL_FULFILLMENT_GATES_PENDING",
            },
          }}
        />
      </StaticRouter>,
    );
    expect(html).toContain("等待客服分别模拟放行清算和风控");
    expect(html).not.toContain("LOCAL_FULFILLMENT_GATES_PENDING");
    expect(html).toContain(
      "本单清分需在独立清分卡显式执行或查看；买家确认以交易确认卡为准。",
    );
    expect(html).not.toContain("资金末步与放款尚未开放");
    expect(html).not.toContain("最后确认步骤及放款尚未开放");
  });
  it("renders loading, honest unavailable and errors with retry", () => {
    const render = (s: LocalFulfillmentSnapshot) =>
      renderToStaticMarkup(
        <StaticRouter location="/">
          <RestoredOrderLocalFulfillmentView
            snapshot={s}
            onRefresh={() => {}}
          />
        </StaticRouter>,
      );
    expect(render({ ...base, loading: true })).toContain("正在读取履约状态");
    expect(render(base)).toContain("暂无可读取");
    expect(render({ ...base, error: "读取失败" })).toContain('role="alert"');
  });
  it("uses the IM identifier for the same group and never offers backend simulation controls", () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <RestoredOrderLocalFulfillmentView
          onRefresh={() => {}}
          snapshot={{
            ...base,
            fulfillment: {
              orderId: "order",
              provenance: "LOCAL_DEMO",
              rowVersion: 5,
              state: "LINKED",
              gates: {
                settlement: {
                  status: "SIMULATED_PASS",
                  operationId: "settlement-id",
                  actorId: "admin",
                  at: "2026-09-29",
                },
                risk: {
                  status: "SIMULATED_PASS",
                  operationId: "risk-id",
                  actorId: "admin",
                  at: "2026-09-29",
                },
              },
              conversationId: "fulfillment-not-im",
              imConversationId: "im-demo-123",
              assigneeUserId: null,
              templateSnapshot: null,
              steps: [],
              canOperate: false,
              blockedReason: null,
            },
          }}
        />
      </StaticRouter>,
    );
    expect(html).toContain('href="/im/im-demo-123"');
    expect(html).not.toContain("/im/fulfillment-not-im");
    expect(html).toContain("仅可查看");
    expect(html).not.toMatch(/确认模拟|模拟清算放行|模拟风控放行/);
  });
  it("describes COMPLETED as a verified terminal fact and points to the independent receipt", () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <RestoredOrderLocalFulfillmentView
          onRefresh={() => {}}
          snapshot={{
            ...base,
            fulfillment: {
              orderId: "order",
              provenance: "LOCAL_DEMO",
              rowVersion: 8,
              state: "COMPLETED",
              gates: {
                settlement: {
                  status: "SIMULATED_PASS",
                  operationId: "gate",
                  actorId: "admin",
                  at: "2026-09-30",
                },
                risk: {
                  status: "SIMULATED_PASS",
                  operationId: "risk",
                  actorId: "admin",
                  at: "2026-09-30",
                },
              },
              conversationId: "conversation",
              imConversationId: "im",
              assigneeUserId: "admin",
              templateSnapshot: null,
              steps: [],
              canOperate: false,
              blockedReason: null,
            },
          }}
        />
      </StaticRouter>,
    );
    expect(html).toContain("清分已完成（详见独立回执）");
    expect(html).toContain("本单金额与回执见独立清分卡");
    expect(html).not.toContain("资金末步与放款尚未开放");
  });
});
