import {put,remove} from './db.js';
/** One MediaRecorder instance per learner turn. Never auto-cut on thinking pauses. */
export class TurnRecorder {
 constructor({onTick,onSaved,onError,onState,storage={put,remove}}){this.storage=storage;this.onTick=onTick;this.onSaved=onSaved;this.onError=onError;this.onState=onState;this.state='idle';this.stream=null;this.recorder=null;this.queue=Promise.resolve();this.wake=null;}
 async start(meta){
  if(this.state!=='idle')return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('当前浏览器不能录音。请在HTTPS网址用Safari或Chrome打开，并允许麦克风。');
  this.state='requesting';this.onState(this.state);this.interrupted=false;this.errorSeen=false;
  try{
   this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
   // Permission prompts can background the page. Do not begin an invisible recording.
   if(document.hidden){this.stream.getTracks().forEach(t=>t.stop());throw new Error('请返回练习页面后再开始录音。');}
   const candidates=['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm'];
   const mime=candidates.find(x=>MediaRecorder.isTypeSupported(x));
   this.recorder=new MediaRecorder(this.stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:{audioBitsPerSecond:64000});
   this.meta={...meta,mime:this.recorder.mimeType||mime||'audio/webm'};this.chunks=[];this.queue=Promise.resolve();this.started=performance.now();this.elapsed=0;
   this.recorder.ondataavailable=e=>{
    if(e.data.size){this.chunks.push(e.data);const draft={...this.meta,duration:Math.min(125,(performance.now()-this.started)/1000),blob:new Blob(this.chunks,{type:this.meta.mime})};
     this.queue=this.queue.then(()=>this.storage.put('drafts',draft)).catch(()=>{this.draftFailed=true;});
    }
   };
   this.recorder.onerror=()=>{this.interrupted=true;this.stop(true);};
   this.recorder.onstop=()=>this.finish();
   for(const track of this.stream.getTracks())track.onended=()=>this.stop(true);
   this.visibility=()=>{if(document.hidden)this.stop(true);};document.addEventListener('visibilitychange',this.visibility);
   this.recorder.start(1000);this.state='recording';this.onState(this.state);
   this.timer=setInterval(()=>{this.elapsed=(performance.now()-this.started)/1000;this.onTick(this.elapsed);if(this.elapsed>=120)this.stop(false);},200);
   if(navigator.wakeLock){try{this.wake=await navigator.wakeLock.request('screen');if(this.state!=='recording')await this.wake.release();}catch{}}
  }catch(e){this.cleanup();this.state='idle';this.onState(this.state);throw new Error(e.name==='NotAllowedError'?'麦克风未获授权。请在网址旁的权限设置中允许麦克风，再重试。':e.name==='NotFoundError'?'没有找到可用的麦克风，请连接耳机或检查设备。':e.message||'录音启动失败。');}
 }
 stop(interrupted=false){
  if(this.state!=='recording')return;
  this.interrupted=this.interrupted||interrupted;this.elapsed=(performance.now()-this.started)/1000;
  this.state='saving';this.onState(this.state);clearInterval(this.timer);
  if(this.recorder?.state!=='inactive'){try{this.recorder.stop();}catch{this.finish();}}else this.finish();
 }
 async finish(){
  if(this.finishing)return;this.finishing=true;
  await this.queue;const blob=new Blob(this.chunks,{type:this.meta.mime});
  const record={...this.meta,blob,duration:Math.min(125,this.elapsed||((performance.now()-this.started)/1000)),sync:'local',syncError:'',transcript:'',feedback:null,deleted:false,recovered:this.interrupted};
  this.cleanup();
  try{
   if(!blob.size)throw new Error('没有取得音频数据，这一轮未保存。请检查麦克风后再试。');
   await this.storage.put('records',record);
   // The final record is durable; a leftover recovery draft must not turn success into failure.
   try{await this.storage.remove('drafts',record.id);}catch{}
  }catch(e){this.finishing=false;this.state='idle';this.onState(this.state);this.onError(e,blob,record);return;}
  // Release the recorder before optional upload/UI work, so the next turn cannot be blocked.
  this.finishing=false;this.state='idle';this.onState(this.state);
  try{await this.onSaved(record);}catch(e){this.onError(new Error('录音已写入本机，但后续更新未完成：'+(e.message||'')),null,record);}
 }
 cleanup(){
  clearInterval(this.timer);if(this.visibility)document.removeEventListener('visibilitychange',this.visibility);
  if(this.stream){for(const t of this.stream.getTracks()){t.onended=null;t.stop();}}
  this.stream=null;this.wake?.release().catch(()=>{});this.wake=null;
 }
}
