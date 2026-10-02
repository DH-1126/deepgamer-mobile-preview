import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Button, Heading, SurfaceCard } from "./ui";
import { useRestoredClient } from "../linked/RestoredClientProvider";
import {
  createOrderLocalFulfillmentController,
  createRestoredLocalFulfillmentApi,
  type LocalFulfillmentSnapshot,
} from "../linked/order-local-fulfillment";
const empty: LocalFulfillmentSnapshot = {
  fulfillment: null,
  loading: false,
  busy: false,
  error: "本地履约接口尚未连接",
  unknown: false,
  replay: false,
  command: null,
  confirmation: null,
};
const stateLabels = {
  WAITING_GATES: "等待前置放行",
  WAITING_GROUP: "等待建立履约群",
  LINKED: "已关联本地履约群",
  COMPLETED: "清分已完成（详见独立回执）",
  BLOCKED: "履约受阻",
  UNVERIFIED: "历史关系未核验",
};
const stepLabels = {
  PENDING: "待处理",
  CURRENT: "当前步骤",
  DONE: "模拟完成",
  SKIPPED: "已跳过",
  BLOCKED: "已阻断",
};
const reasons: Record<string, string> = {
  LOCAL_FULFILLMENT_GATES_PENDING: "等待客服分别模拟放行清算和风控",
};
export function RestoredOrderLocalFulfillmentView({
  snapshot: s,
  onRefresh,
}: {
  snapshot: LocalFulfillmentSnapshot;
  onRefresh: () => void;
}) {
  const f = s.fulfillment;
  return (
    <SurfaceCard className="restored-order-detail-card">
      <Heading as="h2" variant="section">
        订单履约（本地演示）
      </Heading>
      <p>
        买家与卖家仅可查看同一履约群及进度。本地演示不连接真实清算或风控，不自动接管、完成订单或放款。
      </p>
      <Button
        variant="outline"
        size="md"
        disabled={s.loading || s.busy}
        onClick={onRefresh}
      >
        刷新履约状态
      </Button>
      {s.loading && <p role="status">正在读取履约状态…</p>}
      {s.error && <p role="alert">{s.error}</p>}
      {f && (
        <>
          <p>
            {stateLabels[f.state]} ·{" "}
            {f.provenance === "LOCAL_DEMO"
              ? "LOCAL_DEMO 本地演示"
              : "UNVERIFIED 未核验"}
          </p>
          <dl className="restored-order-info">
            <div>
              <dt>清算前置</dt>
              <dd>
                {f.gates.settlement.status === "SIMULATED_PASS"
                  ? "已模拟放行"
                  : "待显式放行"}
              </dd>
            </div>
            <div>
              <dt>风控前置</dt>
              <dd>
                {f.gates.risk.status === "SIMULATED_PASS"
                  ? "已模拟放行"
                  : "待显式放行"}
              </dd>
            </div>
          </dl>
          {f.blockedReason && (
            <p role="status">
              履约尚未可推进：{reasons[f.blockedReason] ?? f.blockedReason}
            </p>
          )}
          {f.state === "LINKED" && (
            <>
              {f.imConversationId ? (
                <Link
                  className="restored-order-payment-entry"
                  to={`/im/${encodeURIComponent(f.imConversationId)}`}
                >
                  查看同一履约群
                </Link>
              ) : (
                <p>尚无可信 IM 群关联。</p>
              )}
              {!f.assigneeUserId && (
                <p>客服尚未接管，等待客服在工作台显式接管。</p>
              )}
            </>
          )}
          <ol style={{ paddingInlineStart: 24, overflowWrap: "anywhere" }}>
            {f.steps.map((step) => (
              <li key={step.stepCode}>
                {step.name}：{stepLabels[step.status]}
              </li>
            ))}
          </ol>
          <p>
            {f.state === "COMPLETED"
              ? "已读取可信清分终态；本单金额与回执见独立清分卡。买家确认仍是独立历史事实。"
              : "本单清分需在独立清分卡显式执行或查看；买家确认以交易确认卡为准。"}
          </p>
        </>
      )}
      {!s.loading && !s.error && !f && <p>暂无可读取的履约状态。</p>}
    </SurfaceCard>
  );
}
export function RestoredOrderLocalFulfillment({
  orderId,
}: {
  orderId: string;
}) {
  const { transport, connection } = useRestoredClient(),
    identity = connection?.actor.managementId ?? "";
  const controller = useMemo(
    () =>
      transport
        ? createOrderLocalFulfillmentController({
            orderId,
            identity,
            canExecute: false,
            canAdvance: false,
            api: {
              ...createRestoredLocalFulfillmentApi(transport, orderId),
              operate: async () => {
                throw new Error("客户端履约只读");
              },
              operation: async () => {
                throw new Error("客户端履约只读");
              },
            },
            storage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
          })
        : null,
    [transport, orderId, identity],
  );
  const s = useSyncExternalStore(
    controller?.subscribe ?? (() => () => {}),
    controller?.getSnapshot ?? (() => empty),
    controller?.getSnapshot ?? (() => empty),
  );
  useEffect(() => {
    if (!controller) return;
    void controller.start();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void controller.refresh();
    }, 5000);
    return () => {
      clearInterval(timer);
      controller.stop();
    };
  }, [controller]);
  return (
    <RestoredOrderLocalFulfillmentView
      snapshot={s}
      onRefresh={() => {
        void controller?.refresh();
      }}
    />
  );
}
