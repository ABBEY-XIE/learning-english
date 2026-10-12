import test from 'node:test';
import assert from 'node:assert/strict';
import {TurnRecorder} from '../src/recorder.js';

// Logic-only simulations. No device microphone or real IndexedDB is used here.
test('逐段录音状态机（模拟媒体与存储，不代表手机实测）',async t=>{
 const savedGlobals=new Map(['window','document','navigator','MediaRecorder'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const listeners=new Map();let tracks=[],empty=false,denied=false;
 const document={hidden:false,addEventListener(n,f){listeners.set(n,f);},removeEventListener(n){listeners.delete(n);}};
 class FakeRecorder{
  static isTypeSupported(type){return type.startsWith('audio/mp4');}
  constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive';}
  start(){this.state='recording';}
  stop(){this.state='inactive';this.emit(empty?'':'second-chunk');this.finished=Promise.resolve(this.onstop());}
  emit(text){this.ondataavailable({data:new Blob([text],{type:this.mimeType})});}
 }
 const navigator={mediaDevices:{async getUserMedia(){if(denied){const e=new Error();e.name='NotAllowedError';throw e;}const track={stop(){this.stopped=true;}};tracks.push(track);return {getTracks:()=>[track]};}}};
 Object.defineProperties(globalThis,{window:{configurable:true,value:{isSecureContext:true,MediaRecorder:FakeRecorder}},document:{configurable:true,value:document},navigator:{configurable:true,value:navigator},MediaRecorder:{configurable:true,value:FakeRecorder}});
 const meta=n=>({id:'r'+n,scope:'guest',cycleId:'c',sessionId:'s',day:1,prompt:'Hello?',createdAt:new Date().toISOString()});
 function setup(overrides={}){
  const tables={records:new Map(),drafts:new Map()},states=[],saved=[],errors=[];
  const storage={async put(s,v){tables[s].set(v.id,structuredClone(v));},async remove(s,id){tables[s].delete(id);}};
  const recorder=new TurnRecorder({onTick(){},onState:s=>states.push(s),onSaved:r=>saved.push(r),onError:(...args)=>errors.push(args),storage,...overrides});
  return {recorder,tables,states,saved,errors,storage};
 }
 try{
 await t.test('每轮写入完整音频，再清除中间草稿；停止设备占用',async()=>{
  const x=setup();await x.recorder.start(meta(1));const media=x.recorder.recorder;media.emit('first-chunk');x.recorder.started-=15000;await x.recorder.queue;assert.equal(x.tables.drafts.size,1);x.recorder.stop();await media.finished;
  assert.equal(x.tables.records.size,1);assert.equal(await x.saved[0].blob.text(),'first-chunksecond-chunk');assert.equal(x.tables.drafts.size,0);assert.equal(x.recorder.state,'idle');assert.ok(tracks.at(-1).stopped);assert.ok(x.saved[0].duration>=15);assert.equal(x.saved[0].sync,'local');
 });
 await t.test('连续两轮UUID独立保存，不覆盖上一轮',async()=>{
  const x=setup();for(const n of [1,2]){await x.recorder.start(meta(n));const media=x.recorder.recorder;x.recorder.stop();await media.finished;}assert.equal(x.tables.records.size,2);assert.deepEqual(x.saved.map(r=>r.id),['r1','r2']);
 });
 await t.test('上一轮上传回调未结束，也能正常保存下一轮',async()=>{
  let release;const wait=new Promise(r=>release=r);const x=setup({onSaved:async r=>{if(r.id==='r1')await wait;}});await x.recorder.start(meta(1));const first=x.recorder.recorder;x.recorder.stop();await new Promise(r=>setTimeout(r,5));assert.equal(x.recorder.state,'idle');await x.recorder.start(meta(2));const second=x.recorder.recorder;x.recorder.stop();await second.finished;assert.equal(x.tables.records.size,2);release();await first.finished;assert.equal(x.recorder.finishing,false);
 });
 await t.test('本机保存失败时不报告成功，保留可下载内存音频',async()=>{
  const x=setup();x.storage.put=async()=>{throw new Error('quota full');};await x.recorder.start(meta(1));const media=x.recorder.recorder;x.recorder.stop();await media.finished;assert.equal(x.saved.length,0);assert.equal(x.errors.length,1);assert.ok(x.errors[0][1].size>0);assert.equal(x.recorder.state,'idle');
 });
 await t.test('草稿清理失败不撤销已成功保存的正式录音',async()=>{
  const x=setup();x.storage.remove=async()=>{throw new Error('cleanup fail');};await x.recorder.start(meta(1));const media=x.recorder.recorder;x.recorder.stop();await media.finished;assert.equal(x.saved.length,1);assert.equal(x.errors.length,0);
 });
 await t.test('空音频不会创建伪录音',async()=>{
  empty=true;const x=setup();await x.recorder.start(meta(1));const media=x.recorder.recorder;x.recorder.stop();await media.finished;assert.equal(x.tables.records.size,0);assert.equal(x.saved.length,0);assert.match(x.errors[0][0].message,/没有取得音频/);empty=false;
 });
 await t.test('页面被隐藏时结束当前段，并标记需回听的中断记录',async()=>{
  const x=setup();await x.recorder.start(meta(1));const media=x.recorder.recorder;document.hidden=true;listeners.get('visibilitychange')();await media.finished;assert.equal(x.saved[0].recovered,true);document.hidden=false;
 });
 await t.test('拒绝麦克风权限时返回可理解错误，不进入录音状态',async()=>{
  denied=true;const x=setup();await assert.rejects(()=>x.recorder.start(meta(1)),/麦克风未获授权/);assert.equal(x.recorder.state,'idle');denied=false;
 });
 }finally{for(const [k,descriptor]of savedGlobals){if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}}
});
