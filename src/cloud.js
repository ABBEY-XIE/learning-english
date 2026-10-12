import {metaGet,metaSet} from './db.js';
import {extension} from './utils.js';
export class Cloud {
 constructor(){this.config={cloudConfigured:false,aiConfigured:false};this.session=null;this.refreshing=null;this.lastError='';this.connected=false;}
 async init(){
  try {const r=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(7000)});if(!r.ok)throw new Error();this.config=await r.json();await metaSet('public-config',this.config);}
  catch {this.config=await metaGet('public-config',this.config);}
  this.session=await metaGet('auth-session');
  if(this.session&&this.config.cloudConfigured&&navigator.onLine){
   try {await this.token();const user=await this.request('/auth/v1/user');if(user.id!==this.session.user.id)throw new Error('账号状态不一致，请重新登录');this.session.user=user;await metaSet('auth-session',this.session);}
   catch(e){this.lastError=e.message;if(e.status===401||e.status===400){this.session=null;await metaSet('auth-session',null);}}
  }
  return this;
 }
 async token(){
  if(!this.session)throw new Error('请先登录');
  if((this.session.expires_at||0)*1000>Date.now()+60000)return this.session.access_token;
  if(!this.refreshing)this.refreshing=(async()=>{
   const response=await fetch(this.config.supabaseUrl+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:this.config.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:this.session.refresh_token}),signal:AbortSignal.timeout(15000)});
   const data=await this.parse(response);
   this.session=data;await metaSet('auth-session',data);return data.access_token;
  })().finally(()=>{this.refreshing=null;});
  return this.refreshing;
 }
 async parse(response){
  let data;try{data=await response.json();}catch{data=null;}
  if(!response.ok){
   let message=data?.message||data?.error_description||data?.msg||data?.error||'云端请求未完成';
   if(['42P01','PGRST205','PGRST202'].includes(data?.code))message='数据表尚未创建，请运行 supabase/setup.sql 后重试。';
   if(String(message).includes('Invalid login credentials'))message='邮箱或密码不正确。请使用在Supabase Authentication中创建的学习账号，而不是Supabase后台密码。';
   const error=new Error(String(message).slice(0,350));error.status=response.status;throw error;
  }
  return data;
 }
 async request(path,options={},binary=false){
  if(!this.config.cloudConfigured)throw new Error('云端尚未配置，请先完成连接设置。');
  if(!navigator.onLine)throw new Error('当前离线，录音已保留在本机。重新联网后再同步。');
  const token=await this.token();
  let response;try{response=await fetch(this.config.supabaseUrl+path,{...options,headers:{apikey:this.config.supabaseKey,Authorization:`Bearer ${token}`,...options.headers},signal:AbortSignal.timeout(25000)});}catch{throw new Error('云端连接超时，请检查网络后重试。');}
  if(binary&&response.ok)return response.blob();
  return this.parse(response);
 }
 async signIn(email,password){
  if(!this.config.cloudConfigured)throw new Error('请先配置SUPABASE_URL和SUPABASE_PUBLISHABLE_KEY。');
  const response=await fetch(this.config.supabaseUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:this.config.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password}),signal:AbortSignal.timeout(20000)});
  const data=await this.parse(response);if(!data.user?.id||!data.access_token)throw new Error('登录结果不完整');
  this.session=data;await metaSet('auth-session',data);this.lastError='';return data.user;
 }
 async signOut(){try{await this.request('/auth/v1/logout',{method:'POST'});}catch{}this.session=null;this.connected=false;await metaSet('auth-session',null);}
 async rows(table){
  let rows=[];
  for(let offset=0;offset<20000;offset+=500){
   const batch=await this.request(`/rest/v1/${table}?select=*&limit=500&offset=${offset}&order=id.asc`);
   if(!Array.isArray(batch))throw new Error('云端数据格式不正确');rows.push(...batch);if(batch.length<500)return rows;
  }
  throw new Error('数据量超出本版一次同步的范围，未用不完整数据替换本机档案。');
 }
 async put(table,data,conflict='id'){
  return this.request(`/rest/v1/${table}?on_conflict=${conflict}`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(data)});
 }
 async cycle(c){
  const existing=await this.request('/rest/v1/study_cycles?id=eq.'+c.id+'&select=completed_days&limit=1');
  const completed=[...new Set([...(c.completed||[]),...(Array.isArray(existing[0]?.completed_days)?existing[0].completed_days:[])])].sort((a,b)=>a-b);
  return this.put('study_cycles',{id:c.id,user_id:this.session.user.id,name:c.name,created_at:c.createdAt,completed_days:completed,updated_at:new Date().toISOString()});
 }
 async review(r){return this.put('weekly_reviews',{id:r.id,user_id:this.session.user.id,cycle_id:r.cycleId,week:r.week,content:r.content,updated_at:r.updatedAt},'user_id,cycle_id,week');}
 async upload(r){
  const userId=this.session?.user.id;if(r.scope!==userId)throw new Error('这段录音属于另一个本机档案，请先明确选择导入。');
  if(!r.blob?.size)throw new Error('本机找不到这段音频，不能显示为上传成功。');
  if(r.blob.size>8*1024*1024)throw new Error('单段音频超过8MB，请先下载保存，再分段录制。');
  const path=`${userId}/${r.id}.${extension(r.mime)}`;
  await this.request('/storage/v1/object/speaking-audio/'+path,{method:'POST',headers:{'Content-Type':r.mime.split(';')[0],'x-upsert':'true'},body:r.blob});
  const data={id:r.id,user_id:userId,cycle_id:r.cycleId,session_id:r.sessionId,day:r.day,category:r.category,
   prompt:r.prompt,prompt_zh:r.promptZh||'',hint:r.hint||'',goal:r.goal||'',created_at:r.createdAt,
   duration:r.duration,mime:r.mime,audio_path:path,parent_id:r.parentId||null,recovered:!!r.recovered,imported:!!r.imported};
  if(r.imported&&!r.audioPath){Object.assign(data,{transcript_original:r.transcriptOriginal||'',transcript:r.transcript||'',transcript_reviewed:!!r.transcriptReviewed,feedback:r.feedback||null,feedback_history:r.feedbackHistory||[]});}
  const rows=await this.put('practice_records',data);return this.fromRow(rows[0],r);
 }
 fromRow(row,local={}){
  return {...local,id:row.id,scope:row.user_id,cycleId:row.cycle_id,sessionId:row.session_id,day:row.day,category:row.category,
   prompt:row.prompt,promptZh:row.prompt_zh,hint:row.hint,goal:row.goal,createdAt:row.created_at,updatedAt:row.updated_at,
   duration:row.duration,mime:row.mime,audioPath:row.audio_path,parentId:row.parent_id,transcriptOriginal:row.transcript_original,
   transcript:row.transcript,transcriptReviewed:row.transcript_reviewed,feedback:row.feedback,feedbackHistory:row.feedback_history||[],
   sync:'cloud',syncError:'',deleted:false,recovered:!!row.recovered,imported:!!row.imported};
 }
 async audio(r){
  if(r.blob?.size)return r.blob;
  if(r.scope!==this.session?.user.id||!r.audioPath?.startsWith(r.scope+'/'))throw new Error('请登录这段录音所属的账号。');
  return this.request('/storage/v1/object/speaking-audio/'+r.audioPath,{},true);
 }
 async delete(r){
  if(r.scope!==this.session?.user.id)throw new Error('账号不匹配，不能删除云端记录');
  const path=r.audioPath||`${r.scope}/${r.id}.${extension(r.mime)}`;
  await this.request('/storage/v1/object/speaking-audio',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});
  await this.request('/rest/v1/practice_records?id=eq.'+r.id,{method:'DELETE',headers:{Prefer:'return=representation'}});
 }
 async coach(recordId,action,transcript){
  if(!this.config.aiConfigured)throw new Error('AI尚未配置。录音、计划和回放仍可使用。');
  const token=await this.token();
  let response;try{response=await fetch('/api/coach',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({recordId,action,transcript}),signal:AbortSignal.timeout(65000)});}catch{throw new Error('AI请求未完成。稍后重试会先检查是否已有结果，录音不会丢失。');}
  return this.parse(response);
 }
}
