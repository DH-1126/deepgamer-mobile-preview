import { describe, expect, it, vi } from "vitest";
import { createOrderSignatureController, type SignatureDto, type SignatureOperation } from "./order-signature";
const row: SignatureDto = { orderId:"order", provenance:"LOCAL_DEMO", rowVersion:0, contractId:null, sellerStatus:"task_created", platformStatus:"task_created", overallStatus:"task_created", blockedReason:null, canOperate:true };
const deferred = <T>() => { let resolve!: (value:T)=>void; const promise=new Promise<T>(r=>{resolve=r}); return { promise,resolve } };
function fixture() {
 const memory=new Map<string,string>(); let state={...row};
 const api={ read:vi.fn(async()=>state), operation:vi.fn<() => Promise<SignatureOperation>>(async()=>{throw Object.assign(new Error("not found"),{status:404,code:"SIGNATURE_OPERATION_NOT_FOUND"})}), simulate:vi.fn(async (command:any):Promise<SignatureOperation>=>({ operationId:command.operationId,role:"SELLER",result:command.result,contractVersion:1,signature:{...state,rowVersion:1,sellerStatus:command.result==="SUCCESS"?"succeeded":"failed",overallStatus:command.result==="SUCCESS"?"signing":"failed"} })) };
 const controller=createOrderSignatureController({orderId:"order",identity:"actor",role:"SELLER",api,storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v)},removeItem:k=>{memory.delete(k)}},createId:()=> "signature-operation-one"});
 return {controller,api,memory,setState:(value:SignatureDto)=>{state=value}};
}
describe("order signature recovery controller",()=>{
 it.each([null, [], {operationId:12345678,rowVersion:0,result:"SUCCESS"}, {operationId:"valid-operation",rowVersion:"0",result:"SUCCESS"}, {operationId:"valid-operation",rowVersion:0,result:"SUCCESS",extra:true}, "valid-operation"])("preserves malformed recovery %j and never queries or writes",async(value)=>{
  const f=fixture(),key="deepgamer:order-signature:v1:actor:SELLER:order",raw=JSON.stringify(value);f.memory.set(key,raw);
  await f.controller.start();await f.controller.query();await f.controller.replay();await f.controller.refresh();f.controller.prepare("SUCCESS");await f.controller.confirm();
  expect(f.memory.get(key)).toBe(raw);expect(f.api.operation).not.toHaveBeenCalled();expect(f.api.simulate).not.toHaveBeenCalled();expect(f.controller.getSnapshot().confirmation).toBeNull();
 });
 it("keeps the original command but clears private state when order ownership is lost during query",async()=>{
  const f=fixture();await f.controller.start();f.api.simulate.mockRejectedValueOnce(new Error("lost response"));f.controller.prepare("SUCCESS");await f.controller.confirm();
  f.api.operation.mockRejectedValueOnce(Object.assign(new Error("order not found"),{status:404,code:"ORDER_NOT_FOUND"}));await f.controller.query();await f.controller.replay();
  expect(f.controller.getSnapshot()).toMatchObject({signature:null,replay:false,command:{operationId:"signature-operation-one"}});expect(f.memory.size).toBe(1);expect(f.api.simulate).toHaveBeenCalledTimes(1);
 });
 it("keeps the confirmation open during background refresh",async()=>{
  const f=fixture();await f.controller.start();f.controller.prepare("SUCCESS");await f.controller.refresh();
  expect(f.controller.getSnapshot().confirmation).toBe("SUCCESS");expect(f.api.read).toHaveBeenCalledTimes(1);
 });
 it("keeps corrupt recovery storage blocked after refresh",async()=>{
  const f=fixture();f.memory.set("deepgamer:order-signature:v1:actor:SELLER:order","corrupt");await f.controller.start();await f.controller.refresh();f.controller.prepare("SUCCESS");
  expect(f.controller.getSnapshot().confirmation).toBeNull();expect(f.memory.size).toBe(1);
 });
 it("clears private signature after a known missing-order write",async()=>{
  const f=fixture();await f.controller.start();f.api.simulate.mockRejectedValueOnce(Object.assign(new Error("missing order"),{status:404}));f.controller.prepare("SUCCESS");await f.controller.confirm();
  expect(f.controller.getSnapshot().signature).toBeNull();
 });
 it("retains an unknown request and queries/replays the original payload without creating a new operation",async()=>{
  const f=fixture();await f.controller.start();f.api.simulate.mockRejectedValueOnce(new Error("connection lost"));
  f.controller.prepare("SUCCESS");await f.controller.confirm();
  expect(f.controller.getSnapshot()).toMatchObject({unknown:true,command:{operationId:"signature-operation-one",rowVersion:0,result:"SUCCESS"}});
  expect(f.memory.size).toBe(1);
  await f.controller.query();expect(f.controller.getSnapshot()).toMatchObject({unknown:true,replay:true});
  f.setState({...row,rowVersion:1,sellerStatus:"succeeded",overallStatus:"signing",canOperate:false});
  await f.controller.replay();
  expect(f.api.simulate.mock.calls.map(call=>call[0])).toEqual([{operationId:"signature-operation-one",rowVersion:0,result:"SUCCESS"},{operationId:"signature-operation-one",rowVersion:0,result:"SUCCESS"}]);
  expect(f.controller.getSnapshot().signature?.sellerStatus).toBe("succeeded");expect(f.memory.size).toBe(0);
 });
 it("allows a new command after an explicit failure and suppresses duplicate submit",async()=>{
  const f=fixture();await f.controller.start();const d=deferred<SignatureOperation>();f.api.simulate.mockImplementationOnce(()=>d.promise);
  f.controller.prepare("FAILED");const first=f.controller.confirm();await f.controller.confirm();
  expect(f.api.simulate).toHaveBeenCalledTimes(1);
  f.setState({...row,rowVersion:1,sellerStatus:"failed",overallStatus:"failed"});
  d.resolve({operationId:"signature-operation-one",role:"SELLER",result:"FAILED",contractVersion:1,signature:{...row,rowVersion:1,sellerStatus:"failed",overallStatus:"failed"}});await first;
  f.controller.prepare("SUCCESS");expect(f.controller.getSnapshot().confirmation).toBe("SUCCESS");
 });
 it("does not publish a delayed private result after stop or permission loss",async()=>{
  const f=fixture();const d=deferred<SignatureDto>();f.api.read.mockImplementationOnce(()=>d.promise);
  const load=f.controller.start();f.controller.stop();d.resolve(row);await load;
  expect(f.controller.getSnapshot().signature).toBeNull();
 });
 it("clears private data on a 403 and never allows buyer signing",async()=>{
  const f=fixture();await f.controller.start();f.api.read.mockRejectedValueOnce(Object.assign(new Error("forbidden"),{status:403}));
  await f.controller.refresh();expect(f.controller.getSnapshot().signature).toBeNull();
  f.controller.prepare("SUCCESS");expect(f.controller.getSnapshot().confirmation).toBeNull();
 });
});
