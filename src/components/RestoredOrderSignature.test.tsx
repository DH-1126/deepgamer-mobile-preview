import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RestoredOrderSignatureView } from "./RestoredOrderSignature";
import { createOrderSignatureController, type SignatureSnapshot } from "../linked/order-signature";
const controller=createOrderSignatureController({orderId:"order",identity:"buyer",role:null,storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},api:{read:async()=>{throw new Error("unused")},simulate:async()=>{throw new Error("unused")},operation:async()=>{throw new Error("unused")}}});
const base:SignatureSnapshot={signature:{orderId:"order",provenance:"LOCAL_DEMO",rowVersion:1,contractId:"contract",sellerStatus:"succeeded",platformStatus:"task_created",overallStatus:"signing",blockedReason:null,canOperate:false},loading:false,busy:false,error:null,unknown:false,replay:false,command:null,confirmation:null};
describe("signature status panel",()=>{
 it("explains invalid fulfillment step evidence in Chinese and keeps seller signing disabled",()=>{
  const html=renderToStaticMarkup(<RestoredOrderSignatureView snapshot={{...base,signature:{...base.signature!,blockedReason:"LOCAL_FULFILLMENT_STEP_EVIDENCE_INVALID"}}} controller={controller} seller/>);
  expect(html).toContain("履约步骤完成证据未通过核验，暂不能签署");expect(html).not.toContain("LOCAL_FULFILLMENT_STEP_EVIDENCE_INVALID");expect(html).toMatch(/disabled=""[^>]*>模拟卖家签署成功/);
 });
 it("shows both roles while a buyer has no signing controls",()=>{
  const html=renderToStaticMarkup(<RestoredOrderSignatureView snapshot={base} controller={controller} seller={false}/>);
  expect(html).toContain("买家仅可查看");expect(html).toContain("待签署");expect(html).toContain("签署中");expect(html).not.toContain("模拟卖家签署成功");
 });
 it("keeps loading, blocked, error and original operation recovery visible",()=>{
  const html=renderToStaticMarkup(<RestoredOrderSignatureView snapshot={{...base,loading:true,error:"结果未知",signature:{...base.signature!,blockedReason:"SIGNATURE_TRANSFER_NOT_READY"},command:{operationId:"original-operation",rowVersion:0,result:"SUCCESS"},unknown:true,replay:true}} controller={controller} seller/>);
  expect(html).toContain("正在读取");expect(html).toContain("换绑交付");expect(html).toContain("role=\"alert\"");expect(html).toContain("查询原操作");expect(html).toContain("重发原请求");
 });
});
