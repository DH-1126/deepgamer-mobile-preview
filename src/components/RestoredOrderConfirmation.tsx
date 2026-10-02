import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { Button, Dialog, Heading, SurfaceCard } from "./ui";
import { useRestoredClient } from "../linked/RestoredClientProvider";
import {
  confirmationBlockedReasons,
  createOrderConfirmationController,
  createRestoredConfirmationApi,
  type ConfirmationSnapshot,
} from "../linked/order-confirmation";

type Controller = ReturnType<typeof createOrderConfirmationController>;
const labels = {
  NOT_SENT: "待发布",
  SENT: "待买家确认",
  CONFIRMED_MANUAL: "已确认（清分状态见独立回执）",
};
const buttonStyle: CSSProperties = {
  minHeight: 44,
  maxWidth: "100%",
  whiteSpace: "normal",
  flexShrink: 0,
};
const empty: ConfirmationSnapshot = {
  card: null,
  result: null,
  loading: false,
  busy: false,
  error: "确认接口尚未连接",
  unknown: false,
  replay: false,
  locked: false,
  command: null,
  confirmation: null,
};

export function RestoredOrderConfirmationView({
  snapshot: s,
  controller: c,
  buyer,
}: {
  snapshot: ConfirmationSnapshot;
  controller: Controller;
  buyer: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null),
    refresh = useRef<HTMLButtonElement>(null),
    query = useRef<HTMLButtonElement>(null),
    fallback = useRef<HTMLParagraphElement>(null),
    wasOpen = useRef(false),
    needsFocus = useRef(false);
  const open = buyer && !s.locked && s.confirmation === "CONFIRM";
  const disabled =
    !buyer ||
    !s.card?.canConfirm ||
    s.card.provenance !== "LOCAL_DEMO" ||
    !!s.card.blockedReason ||
    s.loading ||
    s.busy ||
    !!s.error ||
    !!s.command ||
    s.locked;
  useEffect(() => {
    if (wasOpen.current && !open) needsFocus.current = true;
    wasOpen.current = open;
    if (open || !needsFocus.current || s.loading || s.busy) return;
    const timer = window.setTimeout(() => {
      const target = [trigger.current, refresh.current, query.current].find(
        (button) => button && !button.disabled,
      );
      (target ?? fallback.current)?.focus();
      needsFocus.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, s.loading, s.busy, disabled, s.locked]);
  return (
    <SurfaceCard className="restored-order-detail-card">
      <Heading as="h2" variant="section">
        交易确认卡（本地模拟）
      </Heading>
      <p ref={fallback} tabIndex={-1}>
        买家确认只记录确认事实；确认动作本身不触发入账，资金状态见独立清分回执。原订单状态和金额事实不由确认动作改写。
      </p>
      <Button
        ref={refresh}
        variant="outline"
        size="md"
        style={buttonStyle}
        disabled={s.loading || s.busy || !!s.command || s.locked}
        onClick={() => void c.refresh()}
      >
        刷新确认状态
      </Button>
      {s.loading && <p role="status">正在读取确认状态…</p>}
      {s.error && <p role="alert">{s.error}</p>}
      {s.card && (
        <>
          <dl className="restored-order-info">
            <div>
              <dt>确认状态</dt>
              <dd>{labels[s.card.status]}</dd>
            </div>
            <div>
              <dt>首次发布时间</dt>
              <dd>{s.card.publishedAt ?? "尚未发布"}</dd>
            </div>
            <div>
              <dt>确认时间</dt>
              <dd>{s.card.confirmedAt ?? "尚未确认"}</dd>
            </div>
            <div>
              <dt>确认买家</dt>
              <dd>{s.card.confirmedBy ?? "尚未确认"}</dd>
            </div>
          </dl>
          {s.card.blockedReason && (
            <p role="status">
              {confirmationBlockedReasons[s.card.blockedReason] ??
                `当前事实阻断操作：${s.card.blockedReason}`}
            </p>
          )}
        </>
      )}
      {!s.card && !s.loading && <p>暂无可读取的当前确认状态。</p>}
      {s.result && (
        <p role="status">
          原操作已核验：
          {s.result.action === "CONFIRM" ? "买家确认已记录" : "确认卡已发布"}
          。原结果：{labels[s.result.confirmation.status]} ·
          {s.result.confirmation.confirmedAt ??
            s.result.confirmation.publishedAt}
          {s.result.confirmation.confirmedBy &&
            ` · 确认买家 ${s.result.confirmation.confirmedBy}`}
          。
          {!s.card &&
            s.error &&
            "当前事实读取失败，需重新读取后查看；原结果不授予当前操作权限。"}
        </p>
      )}
      {!buyer && <p>卖家仅可查看确认事实；只有订单本人买家可以确认交易。</p>}
      {s.command && (
        <>
          <p role="status" style={{ overflowWrap: "anywhere" }}>
            原操作 {s.command.operationId} 尚需核对，保留同一请求。
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button
              ref={query}
              variant="outline"
              style={buttonStyle}
              disabled={s.busy || s.locked || !buyer}
              onClick={() => void c.query()}
            >
              查询原操作
            </Button>
            {s.replay && (
              <Button
                variant="outline"
                style={buttonStyle}
                disabled={s.busy || s.locked || !buyer}
                onClick={() => void c.replay()}
              >
                重发原请求
              </Button>
            )}
          </div>
        </>
      )}
      {buyer && (
        <Button
          ref={trigger}
          style={buttonStyle}
          disabled={disabled}
          onClick={() => c.prepare()}
        >
          确认交易（本地模拟）
        </Button>
      )}
      <Dialog
        open={open}
        title="确认本地模拟交易"
        showClose={false}
        closeOnBackdrop={!s.busy}
        onClose={() => c.cancel()}
        actions={
          <>
            <Button
              variant="outline"
              style={buttonStyle}
              disabled={s.busy}
              onClick={() => c.cancel()}
            >
              取消
            </Button>
            <Button
              style={buttonStyle}
              loading={s.busy}
              disabled={s.busy}
              onClick={() => void c.confirm()}
            >
              {s.busy ? "提交中…" : "确认交易"}
            </Button>
          </>
        }
      >
        <p>
          确认当前订单的交易资料。仅记录本人买家手动确认；确认动作本身不触发入账，资金状态见独立清分回执。
        </p>
      </Dialog>
    </SurfaceCard>
  );
}

export function RestoredOrderConfirmation({
  orderId,
  buyer,
}: {
  orderId: string;
  buyer: boolean;
}) {
  const { connection, transport } = useRestoredClient(),
    identity = connection?.actor.managementId ?? "";
  const controller = useMemo(
    () =>
      transport
        ? createOrderConfirmationController({
            orderId,
            identity,
            action: buyer ? "CONFIRM" : null,
            api: createRestoredConfirmationApi(transport, orderId),
            storage: window.sessionStorage,
            pollMs: 5000,
          })
        : null,
    [transport, identity, orderId, buyer],
  );
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? (() => () => {}),
    controller?.getSnapshot ?? (() => empty),
    controller?.getSnapshot ?? (() => empty),
  );
  useEffect(() => {
    if (!controller) return;
    const sync = () =>
      controller.setVisible(document.visibilityState === "visible");
    sync();
    void controller.start();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      controller.stop();
    };
  }, [controller]);
  return controller ? (
    <RestoredOrderConfirmationView
      snapshot={snapshot}
      controller={controller}
      buyer={buyer}
    />
  ) : null;
}
