import * as DB from './db.js';
import {Cloud} from './cloud.js';
import {TurnRecorder} from './recorder.js';
import {getLesson} from './plan.js';
import * as UI from './ui.js';
import {uid,esc,icon,clock,dateKey,nextDay,download,extension,boundedText,isUUID,safeQuestion} from './utils.js';

const cloud=new Cloud();
const S={view:'home',scope:'guest',cycles:[],cycleId:'',records:[],notes:[],urls:new Map(),edits:{},minutes:35,voiceRate:0.9,
 day:1,question:getLesson(1).questions[0],questionSource:'built-in',qIndex:0,sessionId:uid(),lastId:null,parentId:null,
 recState:'idle',elapsed:0,showHint:false,showZh:false,filter:'全部',search:'',recordCycle:'',week:1,cloudBusy:false,cloudError:'',aiBusy:null,modalId:null};
const app=document.getElementById('app');const modalRoot=document.getElementById('modal-root');
let toastTimer,renderPending=false;
function toast(message,type='info'){
 const box=document.getElementById('toast');box.textContent=String(message);box.className='visible '+type;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.className='',type==='error'?8500:4200);
}
function presentModal(html,id=null){
 S.modalId=id;modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="录音与反馈" tabindex="-1">${html}</section></div>`;document.body.classList.add('modal-open');modalRoot.querySelector('.modal')?.focus({preventScroll:true});
}
function closeModal(){modalRoot.innerHTML='';S.modalId=null;document.body.classList.remove('modal-open');}
function cacheAudioURLs(){
 const wanted=new Set(S.records.filter(r=>!r.deleted).map(r=>r.id));
 for(const [id,url]of S.urls)if(!wanted.has(id)){URL.revokeObjectURL(url);S.urls.delete(id);}
 for(const r of S.records)if(!r.deleted&&r.blob?.size&&!S.urls.has(r.id))S.urls.set(r.id,URL.createObjectURL(r.blob));
}
function render(force=false){
 if(!force&&S.recState!=='idle'){renderPending=true;return;}
 renderPending=false;cacheAudioURLs();
 const screen=({home:UI.home,plan:UI.plan,practice:UI.practice,records:UI.records,progress:UI.progress,settings:UI.settings})[S.view]||UI.home;
 app.innerHTML=UI.layout(S,cloud,screen(S,cloud));
}
async function refreshRecords(){S.records=await DB.scopeRecords(S.scope);cacheAudioURLs();}
async function savePrefs(){await DB.metaSet('prefs:'+S.scope,{minutes:S.minutes,voiceRate:S.voiceRate,cycleId:S.cycleId,cloudConsent:S.cloudConsent});}
async function saveCycles(){await DB.metaSet('cycles:'+S.scope,S.cycles);await savePrefs();}
async function saveNotes(){await DB.metaSet('notes:'+S.scope,S.notes);}
async function savePractice(){await DB.metaSet('practice:'+S.scope,{cycleId:S.cycleId,day:S.day,question:S.question,questionSource:S.questionSource,qIndex:S.qIndex,sessionId:S.sessionId,lastId:S.lastId,parentId:S.parentId});}
async function loadScope(){
 S.scope=cloud.session?.user.id||'guest';
 for(const url of S.urls.values())URL.revokeObjectURL(url);S.urls.clear();S.edits={};
 const prefs=await DB.metaGet('prefs:'+S.scope,{});S.minutes=[30,35,40].includes(prefs.minutes)?prefs.minutes:35;S.voiceRate=[0.8,0.9,1].includes(prefs.voiceRate)?prefs.voiceRate:0.9;S.cloudConsent=!!prefs.cloudConsent;
 S.cycles=await DB.metaGet('cycles:'+S.scope,[]);S.notes=await DB.metaGet('notes:'+S.scope,[]);
 if(!S.cycles.length){S.cycles=[{id:uid(),name:'第1周期 · 旅行与生活',createdAt:new Date().toISOString(),completed:[],provisional:true}];}
 S.cycleId=S.cycles.some(c=>c.id===prefs.cycleId)?prefs.cycleId:S.cycles[0].id;
 S.day=nextDay(S.cycles.find(c=>c.id===S.cycleId));S.question=getLesson(S.day).questions[0];S.qIndex=0;S.sessionId=uid();S.lastId=null;S.parentId=null;S.questionSource='built-in';
 const saved=await DB.metaGet('practice:'+S.scope);
 if(saved?.cycleId===S.cycleId&&isUUID(saved.sessionId)&&saved.question?.en){Object.assign(S,{...saved,question:safeQuestion(saved.question)});}
 const recovered=await DB.recoverDrafts(S.scope);await refreshRecords();await saveCycles();
 if(recovered)toast(`恢复了${recovered}段中断录音，请先回放确认是否完整。`);
}
function nav(view){
 if(S.recState!=='idle'){toast('先结束并保存当前这一段，再切换页面。');return;}
 if(S.cloudBusy&&view==='settings'){} // Reading settings is safe during sync.
 closeModal();window.speechSynthesis?.cancel();S.view=['home','plan','practice','records','progress','settings'].includes(view)?view:'home';
 if(location.hash!==`#${S.view}`)history.replaceState(null,'',`#${S.view}`);
 render();window.scrollTo({top:0,behavior:'instant'});
}
async function start(day,retake=null){
 if(S.recState!=='idle')return;
 const l=getLesson(day);
 if(retake){
  S.cycleId=retake.cycleId;S.day=retake.day;S.sessionId=uid();S.parentId=retake.parentId||retake.id;S.lastId=retake.id;
  S.question={en:retake.prompt,zh:retake.promptZh||'',hint:retake.hint||'先说出核心意思，再补一个原因。'};S.questionSource='retake';S.qIndex=0;
 }else if(S.day!==l.day||S.view!=='practice'){
  // Reuse the last turn on returning to the same day's practice; starting a different day is a new session.
  const saved=await DB.metaGet('practice:'+S.scope);
  if(saved?.day===l.day&&saved.cycleId===S.cycleId&&isUUID(saved.sessionId)){Object.assign(S,{...saved,question:safeQuestion(saved.question)});}
  else{S.day=l.day;S.question=l.questions[0];S.qIndex=0;S.questionSource='built-in';S.sessionId=uid();S.parentId=null;S.lastId=null;}
 }
 S.showHint=false;S.showZh=false;S.elapsed=0;await savePrefs();await savePractice();nav('practice');
}
function showDetail(id){const r=S.records.find(r=>r.id===id&&!r.deleted);if(!r)return toast('没有找到这段录音。','error');cacheAudioURLs();presentModal(UI.detail(r,S,cloud),id);}
function speak(text){
 if(S.recState!=='idle')return toast('录音时不播放参考声音，避免一起录进去。');
 if(!window.speechSynthesis)return toast('当前设备没有可用的系统朗读功能。','error');
 speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(String(text).slice(0,1500));speech.lang='en-US';speech.rate=S.voiceRate;
 const voices=speechSynthesis.getVoices();const voice=voices.find(v=>v.lang==='en-US')||voices.find(v=>v.lang.startsWith('en'));if(voice)speech.voice=voice;
 speech.onerror=event=>{if(!['canceled','interrupted'].includes(event.error))toast('系统朗读未成功，请检查声音输出或系统英文语音。','error');};speechSynthesis.speak(speech);
}
async function syncOne(record){
 if(!cloud.session||S.scope!==cloud.session.user.id||record.scope!==S.scope||!S.cloudConsent||S.cloudBusy)return record;
 const c=S.cycles.find(c=>c.id===record.cycleId);if(!c)throw new Error('找不到录音所属学习周期');
 let r=await DB.get('records',record.id);if(r.deleted)return r;
 S.cloudBusy=true;
 try{r={...r,sync:'uploading'};await DB.put('records',r);await refreshRecords();render();await cloud.cycle(c);const saved=await cloud.upload(r);await DB.put('records',saved);cloud.connected=true;S.cloudError='';return saved;}
 catch(e){const failed={...r,sync:'error',syncError:e.message};await DB.put('records',failed);S.cloudError=e.message;throw e;}
 finally{S.cloudBusy=false;await refreshRecords();render();}
}
async function syncAll(manual=true){
 if(S.cloudBusy)return;
 if(!cloud.session){if(manual){toast('先登录学习账号，才能同步到私人云端。');nav('settings');}return;}
 if(!navigator.onLine){if(manual)toast('当前离线，录音保留在本机。联网后点击同步。');return;}
 if(!S.cloudConsent){if(!manual)return;if(!confirm('将当前登录档案的录音与学习记录同步到你配置的Supabase私有空间？'))return;S.cloudConsent=true;await savePrefs();}
 S.cloudBusy=true;S.cloudError='';render();let failures=0;const scope=S.scope;
 try{
  const [remoteCycles,remoteRecords,remoteNotes]=await Promise.all([cloud.rows('study_cycles'),cloud.rows('practice_records'),cloud.rows('weekly_reviews')]);
  if(scope!==S.scope)throw new Error('账号发生变化，同步已停止。');
  const map=new Map(S.cycles.filter(c=>!(remoteCycles.length&&c.provisional&&!c.completed.length&&!S.records.some(r=>r.cycleId===c.id)&&!S.notes.some(n=>n.cycleId===c.id))).map(c=>[c.id,c]));
  for(const row of remoteCycles){const local=map.get(row.id);map.set(row.id,{id:row.id,name:local?.name||row.name,createdAt:row.created_at,completed:[...new Set([...(local?.completed||[]),...(Array.isArray(row.completed_days)?row.completed_days:[])])].filter(d=>Number.isInteger(d)&&d>=1&&d<=30).sort((a,b)=>a-b)});}
  S.cycles=[...map.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));if(!S.cycles.some(c=>c.id===S.cycleId))S.cycleId=S.cycles[0].id;await saveCycles();
  for(const c of S.cycles)await cloud.cycle(c);
  let local=await DB.scopeRecords(scope);const localMap=new Map(local.map(r=>[r.id,r]));const remoteMap=new Map(remoteRecords.map(r=>[r.id,r]));
  for(const r of local.filter(r=>r.deleted)){
   try{await cloud.delete(r);await DB.remove('records',r.id);remoteMap.delete(r.id);localMap.delete(r.id);}
   catch(e){failures++;S.cloudError=e.message;}
  }
  for(const [id,row]of remoteMap){const old=localMap.get(id);if(!old?.deleted)await DB.put('records',cloud.fromRow(row,old));}
  // A fully fetched cloud index is authoritative for previously synced copies. Never discard unsynced audio.
  for(const r of local)if(r.sync==='cloud'&&!remoteMap.has(r.id)&&!r.deleted)await DB.remove('records',r.id);
  local=await DB.scopeRecords(scope);
  for(const r of local.filter(r=>!r.deleted&&r.sync!=='cloud')){
   try{await DB.put('records',{...r,sync:'uploading'});const uploaded=await cloud.upload(r);await DB.put('records',uploaded);}
   catch(e){await DB.put('records',{...r,sync:'error',syncError:e.message});failures++;S.cloudError=e.message;}
  }
  for(const row of remoteNotes){const ix=S.notes.findIndex(n=>n.cycleId===row.cycle_id&&n.week===row.week);const value={id:row.id,cycleId:row.cycle_id,week:row.week,content:row.content,updatedAt:row.updated_at,synced:true};if(ix<0)S.notes.push(value);else if(!S.notes[ix].dirty||new Date(row.updated_at)>new Date(S.notes[ix].updatedAt))S.notes[ix]=value;}
  for(const note of S.notes.filter(n=>n.dirty)){try{await cloud.review(note);note.dirty=false;note.synced=true;}catch(e){failures++;S.cloudError=e.message;}}
  await saveNotes();cloud.connected=true;
  if(manual)toast(failures?`还有${failures}项未完成同步，保留本机副本，可重试。`:'云端同步完成。已逐段确认上传结果。',failures?'error':'info');
 }catch(e){S.cloudError=e.message;cloud.connected=false;if(manual)toast(e.message,'error');}
 finally{S.cloudBusy=false;await refreshRecords();render();}
}
const recorder=new TurnRecorder({
 onTick:seconds=>{S.elapsed=seconds;const node=document.getElementById('record-clock');if(node)node.textContent=clock(seconds);},
 onState:state=>{S.recState=state;render(true);},
 onSaved:async record=>{
  S.lastId=record.id;S.parentId=null;await refreshRecords();await savePractice();render();toast(record.recovered?'中断的这一段已保存到本机，请回放确认。':'这一段已保存到本机。');
  if(cloud.session&&navigator.onLine&&S.cloudConsent&&!S.cloudBusy){try{await syncOne(record);}catch(e){toast('录音已在本机；云端上传待重试：'+e.message,'error');}}
 },
 onError:(error,blob,record)=>{
  toast(error.message,'error');
  if(blob?.size){S.rescue={blob,record};presentModal(`<div class="modal-header"><h2>先把这段声音保住</h2></div><div class="notice warning">本机存储没有确认成功，不能显示为“已保存”。请先下载音频，再重试本机保存。</div><p>${esc(error.message)}</p><div class="stack-buttons"><button class="btn primary" data-act="rescue-download">${icon('download')}下载这段录音</button><button class="btn ghost" data-act="rescue-retry">重试本机保存</button><button class="text-btn danger" data-act="rescue-dismiss">已经下载，关闭提示</button></div>`);}
 }
});
async function requireAIConsent(action){
 const key='ai-consent:'+cloud.config.consentVersion+':'+action+':'+S.scope;
 if(await DB.metaGet(key,false))return true;
 const detail=action==='transcribe'
  ?'把你选中的原始录音发送给阿里云百炼（北京地域）进行转写；原音仍保留在私人Supabase中。'
  :'把你核对后的文字、当前题目和少量此前对话发送给Kimi，生成表达反馈及追问；本步骤不发送原始音频。';
 const approved=confirm(detail+'这可能产生对应平台的API费用。只分析当前回答，不评发音、停顿或整体等级。是否同意？');
 if(approved)await DB.metaSet(key,true);return approved;
}
async function ai(id,action){
 let r=await DB.get('records',id);if(!r||r.scope!==S.scope)throw new Error('找不到当前账号的这段录音。');
 if(!cloud.session||r.scope!==cloud.session.user.id){toast('请先登录，并明确导入本机试用录音。');nav('settings');return;}
 if(!(action==='transcribe'?cloud.config.transcribeConfigured:cloud.config.feedbackConfigured))throw new Error(action==='transcribe'?'百炼转写尚未配置，请查看连接与设置。':'Kimi反馈尚未配置，请查看连接与设置。');
 if(S.aiBusy)throw new Error('请等待当前AI请求结束，避免重复提交。');
 if(S.cloudBusy)throw new Error('先等待云端同步完成，再进行AI评估。');
 if(!(await requireAIConsent(action)))return;
 S.aiBusy=id;showDetail(id);
 try{
  if(r.sync!=='cloud')r=await syncOne(r);
  if(r.sync!=='cloud')throw new Error('这段录音还没有云端保存成功，请先同步。');
  const text=S.edits[id]??r.transcript??r.transcriptOriginal;
  const result=await cloud.coach(id,action,text);
  if(action==='transcribe'){
   r={...r,transcriptOriginal:result.transcript,transcript:r.transcriptReviewed?r.transcript:result.transcript};
   if(!(id in S.edits))S.edits[id]=r.transcript;
  }else{
   const history=[...(r.feedbackHistory||[])];if(r.feedback)history.push({feedback:r.feedback,transcript:r.transcript});
   r={...r,transcript:result.transcript,transcriptReviewed:true,feedback:result.feedback,feedbackHistory:history.slice(-10)};
  }
  await DB.put('records',r);await refreshRecords();toast(action==='transcribe'?'转写已返回，请先听一遍并核对文字。':'已取得真实表达反馈。发音未评测。');
 }finally{S.aiBusy=null;await refreshRecords();render();if(S.modalId===id)showDetail(id);}
}
function asDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('无法读取录音以生成备份'));reader.readAsDataURL(blob);});}
async function exportBackup(){
 toast('正在整理备份；含云端音频时需要联网，请保留页面。');const records=S.records.filter(r=>!r.deleted);let bytes=0;const exported=[];
 for(const record of records){const blob=await cloud.audio(record);bytes+=blob.size;if(bytes>100*1024*1024)throw new Error('备份音频合计超过本版100MB上限，请先逐段下载重要录音，分批处理。');const {blob:_,scope,sync,syncError,audioPath,...data}=record;exported.push({...data,audioBase64:await asDataURL(blob)});}
 const payload={app:'roam-speaking',version:1,exportedAt:new Date().toISOString(),cycles:S.cycles,notes:S.notes,records:exported};
 download(new Blob([JSON.stringify(payload)],{type:'application/json'}),`roam-full-backup-${dateKey()}.json`);toast(`完整备份已生成：${records.length}段录音。请在下载文件夹妥善保存。`);
}
function importedFeedback(f){
 if(!f||typeof f!=='object'||!Array.isArray(f.fixes)||!Array.isArray(f.strengths))return null;
 if(JSON.stringify(f).length>30000)return null;
 const out={eligible:f.eligible===true};
 for(const k of ['task_score','clarity_score','language_score']){out[k]=Number.isInteger(f[k])&&f[k]>=0&&f[k]<=5?f[k]:null;if(out[k]===null)out.eligible=false;}
 for(const k of ['evidence_limit','natural_answer','next_question','next_question_zh','next_hint','model','rubric','assessed_at'])out[k]=boundedText(f[k],2500);
 out.strengths=f.strengths.filter(x=>typeof x==='string').slice(0,2).map(x=>x.slice(0,1000));out.fixes=f.fixes.filter(x=>x&&typeof x.original==='string'&&typeof x.suggested==='string').slice(0,2).map(x=>({original:boundedText(x.original,1000),suggested:boundedText(x.suggested,1000),reason_zh:boundedText(x.reason_zh,1000)}));out.imported=true;return out;
}
async function importBackup(file){
 if(!file||file.size>160*1024*1024)throw new Error('请选择160MB以内的Roam完整备份文件。');
 const data=JSON.parse(await file.text());
 if(data.app!=='roam-speaking'||data.version!==1||!Array.isArray(data.cycles)||!Array.isArray(data.records)||data.records.length>2000||data.cycles.length>100)throw new Error('不是此版本支持的Roam备份。');
 if(!confirm(`将恢复${data.records.length}段录音到当前档案，并创建独立的恢复周期，不覆盖已有数据。确认继续？`))return;
 const cycleMap=new Map(data.cycles.map(c=>[c.id,uid()]));const recordMap=new Map(data.records.map(r=>[r.id,uid()]));const sessionMap=new Map();let total=0;
 // Validate the entire file before the first write.
 const records=[];
 for(const row of data.records){
  if(!cycleMap.has(row.cycleId)||typeof row.audioBase64!=='string'||row.audioBase64.length>12*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(row.audioBase64)||!Number.isFinite(row.duration)||row.duration<0||row.duration>125||!Number.isInteger(row.day)||row.day<1||row.day>30)throw new Error('备份中存在不符合格式的录音，未开始写入。');
  const mime=String(row.mime||'').split(';')[0];if(!['audio/webm','audio/mp4','video/mp4','audio/wav','audio/x-wav','audio/mpeg','audio/ogg','video/webm'].includes(mime))throw new Error('备份包含不支持的音频类型。');
  const raw=atob(row.audioBase64);total+=raw.length;if(!raw.length||raw.length>8*1024*1024||total>100*1024*1024)throw new Error('备份音频为空或超过本版大小限制。');
  const bytes=new Uint8Array(raw.length);for(let n=0;n<raw.length;n++)bytes[n]=raw.charCodeAt(n);
  if(!sessionMap.has(row.sessionId))sessionMap.set(row.sessionId,uid());
  records.push({id:recordMap.get(row.id),scope:S.scope,cycleId:cycleMap.get(row.cycleId),sessionId:sessionMap.get(row.sessionId),day:row.day,category:['生活','旅行','潜水','复盘'].includes(row.category)?row.category:'生活',
   prompt:boundedText(row.prompt,1000),promptZh:boundedText(row.promptZh,1000),hint:boundedText(row.hint,1000),goal:boundedText(row.goal,1000),createdAt:isNaN(Date.parse(row.createdAt))?new Date().toISOString():new Date(row.createdAt).toISOString(),duration:row.duration,mime,
   parentId:recordMap.get(row.parentId)||null,blob:new Blob([bytes],{type:mime}),transcriptOriginal:boundedText(row.transcriptOriginal,4000),transcript:boundedText(row.transcript,4000),transcriptReviewed:!!row.transcriptReviewed,feedback:importedFeedback(row.feedback),feedbackHistory:[],imported:true,sync:'local',deleted:false});
 }
 const newCycles=data.cycles.map(c=>({id:cycleMap.get(c.id),name:boundedText(c.name,85)+' · 恢复副本',createdAt:new Date().toISOString(),completed:Array.isArray(c.completed)?[...new Set(c.completed.filter(d=>Number.isInteger(d)&&d>=1&&d<=30))]:[]}));
 const newNotes=(Array.isArray(data.notes)?data.notes:[]).filter(n=>cycleMap.has(n.cycleId)&&Number.isInteger(n.week)&&n.week>=1&&n.week<=4).map(n=>({id:uid(),cycleId:cycleMap.get(n.cycleId),week:n.week,content:{smooth:boundedText(n.content?.smooth,1500),stuck:boundedText(n.content?.stuck,1500),next:boundedText(n.content?.next,1500)},updatedAt:new Date().toISOString(),dirty:true}));
 const mergedCycles=[...S.cycles,...newCycles],mergedNotes=[...S.notes,...newNotes];
 await DB.batch([...records.map(r=>({store:'records',value:r})),{store:'meta',value:{id:'cycles:'+S.scope,value:mergedCycles}},{store:'meta',value:{id:'notes:'+S.scope,value:mergedNotes}}]);
 S.cycles=mergedCycles;S.notes=mergedNotes;
 await refreshRecords();render();toast(`已恢复${records.length}段到本机。登录后点击同步，才能确认云端保存。`);
}
async function adoptGuest(){
 if(!cloud.session)throw new Error('请先登录');
 const already=await DB.metaGet('adopted:'+S.scope,[]);
 const rows=(await DB.scopeRecords('guest')).filter(r=>!r.deleted&&!already.includes(r.id));const cycles=await DB.metaGet('cycles:guest',[]);const notes=(await DB.metaGet('notes:guest',[])).filter(n=>!already.includes(n.id));
 if(!rows.length&&!notes.length){toast('没有需要导入的本机试用录音或复盘。');return;}
 if(!confirm(`将本机试用的${rows.length}段录音和复盘明确导入 ${cloud.session.user.email}？之后同步到这个账号的私人云端。`))return;
 // Keep the source guest backup until the copies are confirmed in the destination.
 const map=new Map(cycles.map(c=>[c.id,uid()]));const ids=new Map(rows.map(r=>[r.id,uid()]));
 S.cycles.push(...cycles.filter(c=>rows.some(r=>r.cycleId===c.id)||notes.some(n=>n.cycleId===c.id)).map(c=>({...c,id:map.get(c.id),name:c.name+' · 本机导入'})));await saveCycles();
 for(const r of rows)await DB.put('records',{...r,id:ids.get(r.id),scope:S.scope,cycleId:map.get(r.cycleId),parentId:ids.get(r.parentId)||null,sync:'local',audioPath:null});
 S.notes.push(...notes.filter(n=>map.has(n.cycleId)).map(n=>({...n,id:uid(),cycleId:map.get(n.cycleId),dirty:true})));await saveNotes();await DB.metaSet('adopted:'+S.scope,[...already,...rows.map(r=>r.id),...notes.map(n=>n.id)]);await refreshRecords();
 toast('已创建此账号的导入副本，原本机试用记录暂时保留。');render();await syncAll(true);
}
async function deleteRecord(id){
 const r=await DB.get('records',id);if(!r||r.scope!==S.scope)return;
 if(!confirm('删除这段原始录音及其转写、反馈？云端也会删除。此操作不能通过网站撤销，重要录音请先下载。'))return;
 closeModal();
 if(r.scope==='guest'){await DB.remove('records',id);}
 else{
  await DB.put('records',{...r,deleted:true});
  try{if(!cloud.session||!navigator.onLine)throw new Error('离线');await cloud.delete(r);await DB.remove('records',id);}
  catch{toast('本机已标记待删除。云端删除尚未确认，联网后请点击同步完成。','error');}
 }
 await refreshRecords();render();
}
const actions={
 nav:el=>nav(el.dataset.view),start:el=>start(Number(el.dataset.day)),
 'close-modal':()=>closeModal(),detail:el=>showDetail(el.dataset.id),
 filter:el=>{S.filter=el.dataset.filter;render();},week:el=>{S.week=Number(el.dataset.week);render();},
 hint:()=>{S.showHint=!S.showHint;render();},'toggle-zh':()=>{S.showZh=!S.showZh;render();},
 speak:()=>speak(S.question.en),'speak-answer':el=>speak(S.records.find(r=>r.id===el.dataset.id)?.feedback?.natural_answer||''),
 next:async()=>{const l=getLesson(S.day);S.qIndex=(S.qIndex+1)%l.questions.length;S.question=l.questions[S.qIndex];S.questionSource='built-in';S.showHint=false;S.showZh=false;S.parentId=null;S.elapsed=0;await savePractice();render();},
 record:async()=>{window.speechSynthesis?.cancel();document.querySelectorAll('audio').forEach(a=>a.pause());const l=getLesson(S.day);S.elapsed=0;await recorder.start({id:uid(),scope:S.scope,cycleId:S.cycleId,sessionId:S.sessionId,day:S.day,category:l.category,prompt:S.question.en,promptZh:S.question.zh||'',hint:S.question.hint||'',goal:l.goal,createdAt:new Date().toISOString(),parentId:S.parentId});},
 'stop-record':()=>recorder.stop(),
 retake:el=>{const r=S.records.find(x=>x.id===el.dataset.id);if(r)return start(r.day,r);},
 'complete-day':async()=>{if(!S.records.some(r=>r.cycleId===S.cycleId&&r.day===S.day&&!r.deleted)){toast('先保存至少一段自己的回答，再记录今日完成。');return;}const c=S.cycles.find(c=>c.id===S.cycleId);c.completed=[...new Set([...c.completed,S.day])].sort((a,b)=>a-b);await saveCycles();toast('已记录今天完成。旧录音保留，不需要凑满说话时长。');if(getLesson(S.day).review){S.week=getLesson(S.day).week;nav('progress');}else nav('home');syncAll(false).catch(e=>toast(e.message,'error'));},
 'new-cycle':async()=>{if(!confirm('开启新的30天练习周期？旧周期、录音和复盘全部保留。'))return;const c={id:uid(),name:`第${S.cycles.length+1}周期 · 旅行与生活`,createdAt:new Date().toISOString(),completed:[]};S.cycles.push(c);S.cycleId=c.id;await saveCycles();S.day=1;S.question=getLesson(1).questions[0];S.qIndex=0;S.sessionId=uid();S.lastId=null;S.parentId=null;await savePractice();render();syncAll(false).catch(()=>{});},
 sync:()=>syncAll(true),
 'load-audio':async el=>{const r=await DB.get('records',el.dataset.id);const blob=await cloud.audio(r);await DB.put('records',{...r,blob});await refreshRecords();render();if(S.modalId===r.id)showDetail(r.id);},
 'download-audio':async el=>{const r=await DB.get('records',el.dataset.id);download(await cloud.audio(r),`roam-day${r.day}-${r.id.slice(0,8)}.${extension(r.mime)}`);},
 'delete-record':el=>deleteRecord(el.dataset.id),
 transcribe:el=>ai(el.dataset.id,'transcribe'),evaluate:el=>ai(el.dataset.id,'evaluate'),
 'ai-next':async el=>{const r=S.records.find(x=>x.id===el.dataset.id);const f=r?.feedback;if(!f?.next_question)return;S.cycleId=r.cycleId;S.day=r.day;S.sessionId=r.sessionId;S.lastId=r.id;S.parentId=null;S.question={en:f.next_question,zh:f.next_question_zh,hint:f.next_hint};S.questionSource='ai';S.showHint=false;S.showZh=false;S.elapsed=0;await savePrefs();await savePractice();nav('practice');},
 logout:async()=>{if(!confirm('退出当前学习账号？本机副本仍保留在此浏览器，登录同一账号后可查看。'))return;await cloud.signOut();await loadScope();S.cloudError='';nav('settings');},
 adopt:()=>adoptGuest(),export:()=>exportBackup(),import:()=>document.getElementById('backup-file')?.click(),
 'clear-local':async()=>{const rows=await DB.scopeRecords(S.scope);const unsynced=rows.filter(r=>r.sync!=='cloud'||r.deleted).length;if(!confirm(`清除当前档案的${rows.length}段本机音频副本？其中${unsynced}段尚未确认云端保存或删除。只有已生成的完整备份或已确认的云端数据才能恢复。`))return;for(const r of rows)await DB.remove('records',r.id);await refreshRecords();render();toast('当前档案的本机录音副本已清除；云端数据未删除。');},
 'rescue-download':()=>{if(S.rescue)download(S.rescue.blob,`roam-rescue-${dateKey()}.${extension(S.rescue.record.mime)}`);},
 'rescue-retry':async()=>{if(!S.rescue)return;await DB.put('records',S.rescue.record);await DB.remove('drafts',S.rescue.record.id);S.lastId=S.rescue.record.id;S.rescue=null;closeModal();await refreshRecords();await savePractice();render();toast('重试成功，已经确认本机保存。');},
 'rescue-dismiss':()=>{if(confirm('确认已经下载这段录音？关闭后，尚未成功存储的内存副本可能丢失。')){S.rescue=null;closeModal();}}
};
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-act]');if(!el||el.disabled)return;
 const act=el.dataset.act;if(!actions[act])return;event.preventDefault();
 if(S.recState!=='idle'&&act!=='stop-record')return;
 if(S.aiBusy&&!['close-modal'].includes(act)){toast('AI请求正在处理，请稍等。');return;}
 if(S.cloudBusy&&['logout','adopt','new-cycle','delete-record','clear-local','import'].includes(act)){toast('云端正在同步，完成后再操作。');return;}
 Promise.resolve().then(()=>actions[act](el)).catch(e=>{toast(e.message||'操作未完成，请重试。','error');if(S.recState==='idle')render();});
});
document.addEventListener('input',event=>{
 if(event.target.id==='transcript-edit')S.edits[event.target.dataset.id]=event.target.value;
 if(event.target.id==='record-search'){
  const pos=event.target.selectionStart;S.search=event.target.value;render();const node=document.getElementById('record-search');node?.focus();try{node?.setSelectionRange(pos,pos);}catch{}
 }
});
document.addEventListener('change',event=>{
 const el=event.target;
 Promise.resolve().then(async()=>{
  if(el.id==='minutes-select'){S.minutes=Number(el.value);await savePrefs();render();}
  if(el.id==='voice-select'){S.voiceRate=Number(el.value);await savePrefs();}
  if(el.id==='cycle-select'){S.cycleId=el.value;await savePrefs();render();}
  if(el.id==='record-cycle'){S.recordCycle=el.value;render();}
  if(el.id==='backup-file'){await importBackup(el.files[0]);el.value='';}
 }).catch(e=>toast(e.message,'error'));
});
document.addEventListener('submit',event=>{
 if(!['login-form','review-form'].includes(event.target.id))return;event.preventDefault();const form=event.target;const data=new FormData(form);const submit=form.querySelector('[type=submit]');submit.disabled=true;
 Promise.resolve().then(async()=>{
  if(form.id==='login-form'){
   await cloud.signIn(String(data.get('email')),String(data.get('password')));form.reset();await loadScope();S.cloudConsent=true;await savePrefs();render();toast('已登录。正在验证云端表和录音存储。');await syncAll(true);
  }else{
   const old=S.notes.find(n=>n.cycleId===S.cycleId&&n.week===S.week);const note={id:old?.id||uid(),cycleId:S.cycleId,week:S.week,content:{smooth:boundedText(String(data.get('smooth')),1500),stuck:boundedText(String(data.get('stuck')),1500),next:boundedText(String(data.get('next')),1500)},updatedAt:new Date().toISOString(),dirty:true};
   S.notes=S.notes.filter(n=>n.id!==note.id);S.notes.push(note);await saveNotes();toast('本周复盘已保存到本机。');render();syncAll(false).catch(()=>{});
  }
 }).catch(e=>toast(e.message,'error')).finally(()=>{submit.disabled=false;});
});
document.addEventListener('play',event=>{if(event.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==event.target)a.pause();});},true);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&S.modalId&&!S.rescue)closeModal();
 if(event.key==='Tab'&&modalRoot.firstChild){const nodes=[...modalRoot.querySelectorAll('button:not([disabled]),input,textarea,select,audio[controls],summary,[tabindex="0"]')];if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
window.addEventListener('beforeunload',event=>{if(S.recState!=='idle'||S.rescue){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',()=>{const target=location.hash.slice(1)||'home';if(S.recState!=='idle'){history.replaceState(null,'','#'+S.view);toast('请先结束当前录音。');}else nav(target);});
window.addEventListener('online',()=>{render();syncAll(false).catch(()=>{});});
window.addEventListener('offline',()=>{render();toast('网络已断开。每轮录音仍先写入本机，联网后请同步。');});
async function init(){
 try{
  await DB.openDB();await cloud.init();await loadScope();S.view=location.hash.slice(1)||'home';render();
  if(cloud.session&&S.cloudConsent)syncAll(false).catch(()=>{});
  if('serviceWorker'in navigator&&window.isSecureContext){navigator.serviceWorker.register('/sw.js').catch(()=>{});}
 }catch(error){app.innerHTML=`<div class="boot-error"><h1>先解决保存问题，再开始录音。</h1><p>${esc(error.message)}</p><p>请使用Safari或Chrome普通模式，检查存储空间，避免在无痕窗口中开始长期练习。</p><button class="btn primary" id="reload-app">重新打开</button></div>`;document.getElementById('reload-app').onclick=()=>location.reload();}
}
init();
