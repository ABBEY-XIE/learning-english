export class AppError extends Error { constructor(status, message, code='REQUEST_FAILED') { super(message); this.status=status; this.code=code; } }
// Only official endpoints may receive learner data and API keys.
function providerURL(value,type){
 try{
  const u=new URL(value);const path=u.pathname.replace(/\/$/,'');
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port)return '';
  if(type==='kimi'&&['api.moonshot.cn','api.moonshot.ai'].includes(u.hostname)&&path==='/v1')return u.origin+path;
  if(type==='bailian'&&(u.hostname==='dashscope.aliyuncs.com'||/^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/i.test(u.hostname))&&!path)return u.origin;
 }catch{}
 return '';
}
export function settings(env=process.env){
 const url=(env.SUPABASE_URL||'').trim().replace(/\/$/,'');const key=(env.SUPABASE_PUBLISHABLE_KEY||'').trim();
 const cloud=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)&&key.startsWith('sb_publishable_')&&key.length>20;
 const kimiKey=(env.KIMI_API_KEY||env.MOONSHOT_API_KEY||'').trim(),bailianKey=(env.DASHSCOPE_API_KEY||'').trim();
 const kimiURL=providerURL((env.KIMI_BASE_URL||'https://api.moonshot.cn/v1').trim(),'kimi');
 const bailianURL=providerURL((env.DASHSCOPE_BASE_URL||'https://dashscope.aliyuncs.com').trim(),'bailian');
 const textModel=(env.KIMI_MODEL||'kimi-k2.6').trim(),transcribeModel=(env.DASHSCOPE_ASR_MODEL||'qwen-audio-3.0-asr-flash').trim();
 const kimi=!!(kimiKey&&kimiURL&&['kimi-k2.6','kimi-k2.5'].includes(textModel));
 const bailian=!!(bailianKey&&!bailianKey.startsWith('sk-sp-')&&bailianURL&&['qwen-audio-3.0-asr-flash','fun-asr-flash-2026-06-15'].includes(transcribeModel));
 const allowlist=(env.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const notices=[];
 if(key&&!cloud)notices.push('请核对Supabase项目URL和sb_publishable_公钥，不要填写Secret key。');
 if(env.OPENAI_API_KEY&&!kimiKey)notices.push('本版不读取OPENAI_API_KEY，请将Kimi密钥填入KIMI_API_KEY或MOONSHOT_API_KEY。');
 if(kimiKey&&!kimi)notices.push('Kimi配置无效：检查官方接口地址和模型，默认模型为kimi-k2.6。');
 if(bailianKey&&!bailian)notices.push('百炼配置无效：使用北京地域普通API密钥，不用sk-sp-套餐密钥；默认模型为qwen-audio-3.0-asr-flash。');
 if((kimiKey||bailianKey)&&!allowlist.length)notices.push('请设置ALLOWED_EMAILS为你的学习账号邮箱。');
 return {url:cloud?url:'',key:cloud?key:'',cloud,ai:kimi||bailian,kimi,bailian,kimiKey,bailianKey,kimiURL,bailianURL,textModel,transcribeModel,allowlist,notices};
}
export function publicConfig(env=process.env){
 const s=settings(env),allowed=!!(s.cloud&&s.allowlist.length);
 return {version:'0.2.0',supabaseUrl:s.url,supabaseKey:s.key,cloudConfigured:s.cloud,aiConfigured:allowed&&s.ai,
  transcribeConfigured:allowed&&s.bailian,feedbackConfigured:allowed&&s.kimi,
  transcribeProvider:'阿里云百炼（北京）',feedbackProvider:'Kimi',transcribeModel:s.transcribeModel,model:s.textModel,
  consentVersion:'kimi-bailian-20261019-v1',rubric:'travel-life-text-v1.0',pronunciation:false,notice:s.notices.join(' ')};
}
export async function remote(url, options={}, timeout=12000) {
  try { return await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(timeout)}); }
  catch { throw new AppError(504,'服务连接超时，已保存的录音不受影响，请稍后重试。','UPSTREAM_TIMEOUT'); }
}
export async function jsonResult(response, friendly='云端请求失败，请检查配置并重试。') {
  if(response.ok&&response.status===204)return null; // PostgREST PATCH may return no body.
  let data; try { data=await response.json(); } catch {throw new AppError(502,friendly);}
  if(!response.ok) {
    if(data?.code==='42P01'||data?.code==='PGRST205'||data?.code==='PGRST202') throw new AppError(503,'云端数据表尚未准备好，请先执行 supabase/setup.sql。','DATABASE_NOT_READY');
    if(String(data?.message||'').includes('DAILY_LIMIT')) throw new AppError(429,'今天的AI调用保护上限已达到（80次请求，失败尝试也计入）。仍可录音和回放，明天UTC零点后恢复。','DAILY_LIMIT');
    throw new AppError(response.status===401?401:502,friendly);
  }
  return data;
}
export async function auth(req,action) {
  const s=settings();
  if(!s.cloud)throw new AppError(503,'请先配置Supabase云端连接。','CLOUD_NOT_CONFIGURED');
  if(!s.allowlist.length)throw new AppError(503,'请先设置ALLOWED_EMAILS为你的学习邮箱。','EMAIL_ALLOWLIST_MISSING');
  if(action==='transcribe'&&!s.bailian)throw new AppError(503,'百炼转写未配置，请检查DASHSCOPE_API_KEY及北京地域配置。','BAILIAN_NOT_CONFIGURED');
  if(action==='evaluate'&&!s.kimi)throw new AppError(503,'Kimi反馈未配置，请检查KIMI_API_KEY及模型配置。','KIMI_NOT_CONFIGURED');
  const token=(req.headers.authorization||'').replace(/^Bearer /i,'');
  if(!token || token.length>5000)throw new AppError(401,'请先登录你的学习账号。','LOGIN_REQUIRED');
  const origin=req.headers.origin;
  if(origin && (()=>{try{return new URL(origin).host!==req.headers.host;}catch{return true;}})())throw new AppError(403,'请求来源不正确。','ORIGIN_REJECTED');
  const headers={apikey:s.key,Authorization:`Bearer ${token}`};
  const user=await jsonResult(await remote(s.url+'/auth/v1/user',{headers}), '登录已过期，请重新登录。');
  if(!user.id || !s.allowlist.includes(String(user.email||'').toLowerCase()) || !user.email_confirmed_at)throw new AppError(403,'当前邮箱未获准使用AI。请核对允许使用的邮箱与账号验证状态。','EMAIL_NOT_ALLOWED');
  return {s,user,headers};
}
export async function rest(ctx,path,options={}) {
  return jsonResult(await remote(ctx.s.url+'/rest/v1/'+path,{...options,headers:{...ctx.headers,'Content-Type':'application/json',...options.headers}}));
}
export async function reserve(ctx,id) {
  return rest(ctx,'rpc/claim_ai_request',{method:'POST',body:JSON.stringify({p_record_id:id})});
}
// Do not return raw upstream messages: they can contain private text or keys.
export async function providerRequest(provider,endpoint,key,body,fetcher=remote){
 const label=provider==='kimi'?'Kimi':'百炼',prefix=provider==='kimi'?'KIMI':'BAILIAN';let response;
 try{response=await fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(provider==='bailian'?{'X-DashScope-SSE':'disable'}:{})},body:JSON.stringify(body)},38000);}
 catch{throw new AppError(504,`${label}连接超时；录音仍保留，请稍后重试。`,prefix+'_TIMEOUT');}
 let data;try{data=await response.json();}catch{throw new AppError(502,`${label}返回内容无法读取，未生成结果。`,prefix+'_INVALID_RESPONSE');}
 if(!response.ok||data?.error||(data?.code&&data.code!=='Success')){
  const code=String(data?.error?.code||data?.code||'');let message;
  if(response.status===401)message='密钥未通过验证，请检查密钥所属平台及地域。';
  else if(response.status===402||/insufficient|arrear|balance|quota.exhausted/i.test(code))message='余额或额度不足，请查看平台账单，不要重复调用。';
  else if(response.status===403)message='拒绝访问，请检查服务开通、模型权限或IP限制。';
  else if(response.status===404)message='模型或接口不可用，请检查模型名称及地域。';
  else if(response.status===429)message='达到请求或额度限制，请稍后再试并查看用量。';
  else if(response.status===400)message='未接受请求参数，请记录本错误供维护者排查。';
  else message=`请求未完成（HTTP ${response.status}），录音仍已保存。`;
  throw new AppError(response.status===429?429:502,label+message,prefix+'_UPSTREAM_ERROR');
 }
 return data;
}
export function audioInput(audio,mime){
 if(!audio?.byteLength||audio.byteLength>8*1024*1024)throw new AppError(400,'录音为空或超过8MB，请先保留原音。','AUDIO_SIZE_INVALID');
 const media=String(mime||'').split(';')[0].trim().toLowerCase();
 const formats={'audio/webm':'webm','video/webm':'webm','audio/mp4':'mp4','video/mp4':'mp4','audio/x-m4a':'m4a','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg'};
 const format=formats[media];if(!format)throw new AppError(400,'录音格式暂不支持转写，请下载备份。','AUDIO_FORMAT_UNSUPPORTED');
 const data=`data:${media};base64,${Buffer.from(audio).toString('base64')}`;
 if(data.length>10000000)throw new AppError(400,'音频编码后超过转写输入上限；请保留原音并测试更短的一段。','ASR_INPUT_TOO_LARGE');
 return {data,format};
}
export function parseTranscript(data){
 const text=data?.output?.text??data?.output?.output?.text;
 // A sentence-only response can omit earlier sentences. Never save that as the complete transcript.
 if(typeof text!=='string'||!text.trim())throw new AppError(422,'没有取得完整有效的转写，请回听原音。不会编造文字或分数。','NO_TRANSCRIPT');
 if(text.length>4000)throw new AppError(422,'转写超过本版长度限制，未截断保存；请使用较短录音。','TRANSCRIPT_TOO_LONG');
 return text.trim();
}
export async function transcribeAudio(s,audio,mime,request=providerRequest){
 const {data,format}=audioInput(audio,mime);
 const result=await request('bailian',s.bailianURL+'/api/v1/services/aigc/multimodal-generation/generation',s.bailianKey,{
  model:s.transcribeModel,input:{messages:[{role:'user',content:[{type:'input_audio',input_audio:{data}}]}]},parameters:{format,language_hints:['en','zh']}
 });return parseTranscript(result);
}
export async function evaluateText(s,system,payload,request=providerRequest){
 const answer=await request('kimi',s.kimiURL+'/chat/completions',s.kimiKey,{
  model:s.textModel,messages:[{role:'system',content:system+' Return only JSON matching this schema: '+JSON.stringify(feedbackSchema)},{role:'user',content:JSON.stringify(payload)}],
  response_format:{type:'json_object'},thinking:{type:'disabled'},max_tokens:2300,stream:false
 });const choice=answer?.choices?.[0];
 if(choice?.finish_reason!=='stop')throw new AppError(502,'Kimi回复未完整生成或被拒绝，未保存分数。','KIMI_INCOMPLETE');
 const text=choice?.message?.content;
 if(typeof text!=='string'||text.length>20000)throw new AppError(502,'Kimi反馈格式无效，未生成分数。','KIMI_INVALID_RESPONSE');
 let parsed;try{parsed=JSON.parse(text);}catch{throw new AppError(502,'Kimi没有返回有效JSON反馈，未生成分数。','KIMI_INVALID_JSON');}
 return validateFeedback(parsed,payload.confirmed_transcript);
}
export const isUUID=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export const feedbackSchema={type:'object',additionalProperties:false,properties:{
  eligible:{type:'boolean'},task_score:{type:['integer','null']},clarity_score:{type:['integer','null']},language_score:{type:['integer','null']},
  evidence_limit:{type:'string'},strengths:{type:'array',items:{type:'string'}},
  fixes:{type:'array',items:{type:'object',additionalProperties:false,properties:{original:{type:'string'},suggested:{type:'string'},reason_zh:{type:'string'}},required:['original','suggested','reason_zh']}},
  natural_answer:{type:'string'},next_question:{type:'string'},next_question_zh:{type:'string'},next_hint:{type:'string'}
},required:['eligible','task_score','clarity_score','language_score','evidence_limit','strengths','fixes','natural_answer','next_question','next_question_zh','next_hint']};
export function validateFeedback(f,transcript) {
  if(!f || typeof f.eligible!=='boolean' || !Array.isArray(f.fixes) || !Array.isArray(f.strengths)) throw new AppError(502,'AI反馈格式不完整，未生成分数。');
  for(const key of ['task_score','clarity_score','language_score']) {
    if(!f.eligible) f[key]=null;
    else if(!Number.isInteger(f[key])||f[key]<0||f[key]>5) throw new AppError(502,'AI评分超出规定范围，未保存该结果。');
  }
  for(const key of ['evidence_limit','natural_answer','next_question','next_question_zh','next_hint']) if(typeof f[key]!=='string'||f[key].length>2500)throw new AppError(502,'AI反馈格式不符合要求。');
  f.fixes=f.fixes.filter(x=>x&&typeof x.original==='string'&&x.original.trim()&&transcript.toLowerCase().includes(x.original.toLowerCase())&&typeof x.suggested==='string'&&typeof x.reason_zh==='string').slice(0,2);
  f.strengths=f.strengths.filter(x=>typeof x==='string').slice(0,2);
  return Object.fromEntries(Object.keys(feedbackSchema.properties).map(k=>[k,f[k]]));
}
export function sendError(res,error) {
  const known=error instanceof AppError;
  res.status(known?error.status:500).json({error:known?error.code:'INTERNAL_ERROR',message:known?error.message:'请求没有完成，录音不会因此删除。请稍后重试。'});
}
