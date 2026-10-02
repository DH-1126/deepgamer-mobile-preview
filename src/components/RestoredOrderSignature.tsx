import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Button, Dialog, Heading, SurfaceCard } from "./ui";
import { useRestoredClient } from "../linked/RestoredClientProvider";
import { createOrderSignatureController, createRestoredSignatureApi, type SignatureSnapshot } from "../linked/order-signature";

const labels = { task_created: "待签署", signing: "签署中", succeeded: "模拟成功", failed: "明确失败，可重试" };
const reasons: Record<string,string> = {
  LOCAL_FULFILLMENT_STEP_EVIDENCE_INVALID: "履约步骤完成证据未通过核验，暂不能签署",
  SIGNATURE_FULFILLMENT_NOT_LINKED: "尚未关联可信履约", SIGNATURE_TRANSFER_NOT_READY: "换绑交付及前序步骤尚未完成",
  SIGNATURE_LOCAL_ORDER_REQUIRED: "历史或未核验订单只读", SIGNATURE_ORDER_BLOCKED: "当前订单状态、售后或退款阻断签署",
  PAYMENT_ALLOCATION_NOT_READY: "尚未取得唯一付款归属", AFTER_SALE_BLOCKS_RELEASE: "售后或资金处置尚待核对", REFUND_BLOCKS_RELEASE: "退款事实待核对",
};
type Controller = ReturnType<typeof createOrderSignatureController>;
const empty:SignatureSnapshot={signature:null,loading:false,busy:false,error:"签署接口尚未连接",unknown:false,replay:false,command:null,confirmation:null};
export function RestoredOrderSignatureView({ snapshot:s, controller:c, seller }: {snapshot:SignatureSnapshot;controller:Controller;seller:boolean}) {
  const blocked=s.loading||s.busy||!!s.error||!s.signature?.canOperate||!!s.command;
  return <SurfaceCard className="restored-order-detail-card"><Heading as="h2" variant="section">订单签署（本地模拟）</Heading>
    <p>只记录卖家与平台签署状态，不生成合同正文，不连接真实签署服务；双方成功不会自动完成订单或放款。</p>
    <Button variant="outline" size="md" disabled={s.loading||s.busy} onClick={()=>void c.refresh()}>刷新签署状态</Button>
    {s.loading&&<p role="status">正在读取签署状态…</p>}{s.error&&<p role="alert">{s.error}</p>}
    {s.signature&&<><dl className="restored-order-info"><div><dt>卖家</dt><dd>{labels[s.signature.sellerStatus]}</dd></div><div><dt>平台</dt><dd>{labels[s.signature.platformStatus]}</dd></div><div><dt>总状态</dt><dd>{labels[s.signature.overallStatus]}</dd></div><div><dt>签署版本</dt><dd>{s.signature.rowVersion}</dd></div></dl>
      {s.signature.blockedReason&&<p role="status">阻断原因：{reasons[s.signature.blockedReason]??s.signature.blockedReason}</p>}</>}
    {!s.loading&&!s.error&&!s.signature&&<p>暂无可读取的签署状态。</p>}
    {!seller&&<p>买家仅可查看订单签署状态。</p>}
    {s.command&&<><p role="status">原操作 {s.command.operationId} 需要核对。请先查询原操作，保留同一请求恢复。</p><Button variant="outline" disabled={s.busy} onClick={()=>void c.query()}>查询原操作</Button>{s.replay&&<Button variant="outline" disabled={s.busy} onClick={()=>void c.replay()}>重发原请求</Button>}</>}
    {seller&&<div className="restored-signature-actions"><Button variant="outline" disabled={blocked} onClick={()=>c.prepare("SUCCESS")}>模拟卖家签署成功</Button><Button variant="outline" disabled={blocked} onClick={()=>c.prepare("FAILED")}>模拟卖家签署失败</Button></div>}
    <Dialog open={!!s.confirmation} onClose={()=>c.cancel()} title="确认本地模拟签署" actions={<><Button variant="outline" disabled={s.busy} onClick={()=>c.cancel()}>取消</Button><Button disabled={s.busy} onClick={()=>void c.confirm()} loading={s.busy}>确认模拟{s.confirmation==="SUCCESS"?"成功":"失败"}</Button></>}>
      <p>仅更新当前订单中卖家自己的本地签署状态，不触发真实签约或放款。</p>
    </Dialog>
  </SurfaceCard>;
}
export function RestoredOrderSignature({ orderId, seller }: {orderId:string;seller:boolean}) {
  const { transport, connection }=useRestoredClient();
  const identity=connection?.actor.managementId??"";
  const controller=useMemo(()=>transport?createOrderSignatureController({orderId,identity,role:seller?"SELLER":null,api:createRestoredSignatureApi(transport,orderId),storage:window.sessionStorage}):null,[transport,orderId,identity,seller]);
  const s=useSyncExternalStore(controller?.subscribe??(()=>()=>{}),controller?.getSnapshot??(()=>empty),controller?.getSnapshot??(()=>empty));
  useEffect(()=>{if(!controller)return;void controller.start();const timer=setInterval(()=>{if(document.visibilityState==="visible")void controller.refresh()},5000);return()=>{clearInterval(timer);controller.stop()}},[controller]);
  return controller?<RestoredOrderSignatureView snapshot={s} controller={controller} seller={seller}/>:null;
}
