import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Button, Heading, SurfaceCard } from "./ui";
import { useRestoredClient } from "../linked/RestoredClientProvider";
import {
  createRestoredSettlementApi,
  createRestoredSettlementController,
  type RestoredSettlementSnapshot,
} from "../linked/order-settlement";

const disconnected: RestoredSettlementSnapshot = {
  orderId: "",
  identity: "",
  settlement: null,
  loading: false,
  error: "清分状态接口尚未连接",
  locked: false,
};

const statusLabels = {
  BLOCKED: "当前阻断",
  READY: "待后台显式模拟清分",
  SETTLED: "已清分",
};

const fen = (value: number) => `¥${(value / 100).toFixed(2)}`;

export function RestoredOrderSettlementView({
  snapshot: s,
  onRefresh,
}: {
  snapshot: RestoredSettlementSnapshot;
  onRefresh: () => void;
}) {
  const receipt = s.settlement?.receipt;
  return (
    <SurfaceCard className="restored-order-detail-card">
      <Heading as="h2" variant="section">
        本单演示清分回执
      </Heading>
      <p>
        买卖方仅可读。本区域只展示当前订单的冻结金额与原子提交回执，不展示也不修改历史钱包。
      </p>
      <Button
        variant="outline"
        size="md"
        disabled={s.loading || s.locked}
        onClick={onRefresh}
      >
        刷新清分状态
      </Button>
      {s.loading && <p role="status">正在读取清分状态…</p>}
      {s.error && <p role="alert">{s.error}</p>}
      {s.settlement && (
        <>
          <dl className="restored-order-info">
            <div>
              <dt>清分状态</dt>
              <dd>{statusLabels[s.settlement.status]}</dd>
            </div>
            <div>
              <dt>数据来源</dt>
              <dd>
                {s.settlement.provenance === "LOCAL_DEMO"
                  ? "本地演示"
                  : "历史未核验"}
              </dd>
            </div>
          </dl>
          {s.settlement.blockedReason && (
            <p role="status" style={{ overflowWrap: "anywhere" }}>
              当前业务事实阻断清分：{s.settlement.blockedReason}
            </p>
          )}
        </>
      )}
      {!s.settlement && !s.loading && !s.error && <p>暂无可读的清分状态。</p>}
      {receipt && (
        <section
          aria-label="本单清分回执"
          data-settlement-receipt="true"
          style={{ overflowWrap: "anywhere", minWidth: 0 }}
        >
          <p>本地演示回执，不代表真实资金到账或可提现余额。</p>
          <dl className="restored-order-info">
            <div>
              <dt>清分回执</dt>
              <dd>{receipt.settlementId}</dd>
            </div>
            <div>
              <dt>清分时间</dt>
              <dd>{receipt.settledAt}</dd>
            </div>
            <div>
              <dt>冻结商品金额</dt>
              <dd>{fen(receipt.goodsAmountFen)}</dd>
            </div>
            <div>
              <dt>冻结服务费</dt>
              <dd>{fen(receipt.serviceFeeFen)}</dd>
            </div>
            <div>
              <dt>唯一实收</dt>
              <dd>{fen(receipt.paidAmountFen)}</dd>
            </div>
            <div>
              <dt>卖家本单入账</dt>
              <dd>{fen(receipt.sellerCreditFen)}</dd>
            </div>
            <div>
              <dt>平台本单入账</dt>
              <dd>{fen(receipt.platformCreditFen)}</dd>
            </div>
            <div>
              <dt>冻结定价版本</dt>
              <dd>{receipt.pricingVersion}</dd>
            </div>
          </dl>
        </section>
      )}
    </SurfaceCard>
  );
}

export function RestoredOrderSettlement({ orderId }: { orderId: string }) {
  const { connection, transport } = useRestoredClient();
  const identity = connection?.actor.managementId ?? "";
  const controller = useMemo(
    () =>
      transport
        ? createRestoredSettlementController({
            orderId,
            identity,
            api: createRestoredSettlementApi(transport, orderId),
            pollMs: 5000,
          })
        : null,
    [transport, identity, orderId],
  );
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? (() => () => undefined),
    controller?.getSnapshot ?? (() => disconnected),
    controller?.getSnapshot ?? (() => disconnected),
  );
  useEffect(() => {
    if (!controller) return;
    const sync = () =>
      void controller.setVisible(document.visibilityState === "visible");
    sync();
    void controller.start();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      controller.stop();
    };
  }, [controller]);
  return controller ? (
    <RestoredOrderSettlementView
      snapshot={snapshot}
      onRefresh={() => void controller.refresh()}
    />
  ) : null;
}
