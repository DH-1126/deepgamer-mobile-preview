import {
  localOrderSettlementSchema,
  type LocalOrderSettlementDto,
} from "../../../运营平台/packages/contracts/src/order-settlement";
import type { createRestoredLinkedTransport } from "./restoredLinkedTransport";

export type RestoredSettlementApi = {
  read(signal?: AbortSignal): Promise<LocalOrderSettlementDto>;
};

export type RestoredSettlementSnapshot = {
  orderId: string;
  identity: string;
  settlement: LocalOrderSettlementDto | null;
  loading: boolean;
  error: string | null;
  locked: boolean;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "清分状态读取失败，请重试";
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return;
  const status = Number((error as { status?: unknown }).status);
  return Number.isFinite(status) ? status : undefined;
}

export function parseRestoredSettlement(
  value: unknown,
  orderId: string,
): LocalOrderSettlementDto {
  const settlement = localOrderSettlementSchema.parse(value);
  if (settlement.orderId !== orderId) {
    throw new Error("清分响应与请求订单不一致");
  }
  return settlement;
}

export function createRestoredSettlementApi(
  transport: Pick<ReturnType<typeof createRestoredLinkedTransport>, "read">,
  orderId: string,
): RestoredSettlementApi {
  const path = `/client/orders/${encodeURIComponent(orderId)}/local-settlement`;
  return {
    read: async (signal) =>
      (
        await transport.read(
          path,
          (value) => parseRestoredSettlement(value, orderId),
          signal,
        )
      ).data,
  };
}

export function createRestoredSettlementController(options: {
  orderId: string;
  identity: string;
  api: RestoredSettlementApi;
  pollMs?: number;
}) {
  const { orderId, identity, api } = options;
  const pollMs = options.pollMs ?? 5000;
  let snapshot: RestoredSettlementSnapshot = {
    orderId,
    identity,
    settlement: null,
    loading: false,
    error: null,
    locked: false,
  };
  let active = false;
  let visible = true;
  let generation = 0;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | undefined;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<RestoredSettlementSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  const clearTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (success: boolean) => {
    clearTimer();
    if (!active || !visible || snapshot.locked) return;
    failures = success ? 0 : failures + 1;
    const delay = success
      ? pollMs
      : [pollMs, pollMs * 2, pollMs * 4, pollMs * 6][Math.min(failures - 1, 3)];
    timer = setTimeout(() => void load(), delay);
  };
  async function load() {
    if (!active || !visible || snapshot.locked) return;
    clearTimer();
    const token = ++generation;
    pending?.abort();
    const request = new AbortController();
    pending = request;
    emit({ loading: true, error: null });
    try {
      const settlement = await api.read(request.signal);
      if (!active || token !== generation) return;
      emit({ settlement, loading: false, error: null });
      schedule(true);
    } catch (error) {
      if (!active || token !== generation) return;
      const status = errorStatus(error);
      const locked = status === 401 || status === 403 || status === 404;
      emit({
        settlement: null,
        loading: false,
        error: errorMessage(error),
        locked,
      });
      schedule(false);
    } finally {
      if (pending === request) pending = undefined;
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      if (active) return;
      active = true;
      await load();
    },
    refresh: load,
    async setVisible(next: boolean) {
      if (visible === next) return;
      visible = next;
      generation += 1;
      clearTimer();
      pending?.abort();
      pending = undefined;
      if (active && visible) await load();
    },
    stop() {
      active = false;
      generation += 1;
      clearTimer();
      pending?.abort();
      pending = undefined;
      snapshot = {
        orderId,
        identity,
        settlement: null,
        loading: false,
        error: null,
        locked: false,
      };
      listeners.clear();
    },
  };
}
