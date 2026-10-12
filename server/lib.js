export class AppError extends Error { constructor(status, message, code='REQUEST_FAILED') { super(message); this.status=status; this.code=code; } }
export function settings(env=process.env) {
  const url=(env.SUPABASE_URL || '').trim().replace(/\/$/,'');
  const key=(env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const urlOK=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
  const keyOK=key.startsWith('sb_publishable_') && key.length>20;
  return { url:urlOK?url:'', key:keyOK?key:'', cloud:!!(urlOK&&keyOK), ai:!!env.OPENAI_API_KEY,
    allowlist:(env.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),
    textModel:(env.OPENAI_TEXT_MODEL||'gpt-4.1-mini').trim(), transcribeModel:(env.OPENAI_TRANSCRIBE_MODEL||'gpt-4o-mini-transcribe').trim() };
}
export function publicConfig(env=process.env) {
  const s=settings(env);
  return { version:'0.1.0', supabaseUrl:s.url, supabaseKey:s.key, cloudConfigured:s.cloud,
    aiConfigured:!!(s.cloud&&s.ai&&s.allowlist.length), model:s.textModel,
    rubric:'travel-life-text-v1.0', pronunciation:false,
    notice:env.SUPABASE_PUBLISHABLE_KEY && !s.key ? 'Supabase公钥类型不正确，请使用 sb_publishable_ 开头的 Publishable key；不要填写 Secret key。' : '' };
}
export async function remote(url, options={}, timeout=12000) {
  try { return await fetch(url,{...options,signal:AbortSignal.timeout(timeout)}); }
  catch { throw new AppError(504,'服务连接超时，已保存的录音不受影响，请稍后重试。','UPSTREAM_TIMEOUT'); }
}
export async function jsonResult(response, friendly='云端请求失败，请检查配置并重试。') {
  let data; try { data=await response.json(); } catch {throw new AppError(502,friendly);}
  if(!response.ok) {
    if(data?.code==='42P01'||data?.code==='PGRST205'||data?.code==='PGRST202') throw new AppError(503,'云端数据表尚未准备好，请先执行 supabase/setup.sql。','DATABASE_NOT_READY');
    if(String(data?.message||'').includes('DAILY_LIMIT')) throw new AppError(429,'今天的AI调用保护上限已达到（80次请求，失败尝试也计入）。仍可录音和回放，明天UTC零点后恢复。','DAILY_LIMIT');
    throw new AppError(response.status===401?401:502,friendly);
  }
  return data;
}
export async function auth(req) {
  const s=settings();
  if(!s.cloud)throw new AppError(503,'请先配置Supabase云端连接。','CLOUD_NOT_CONFIGURED');
  if(!s.ai||!s.allowlist.length)throw new AppError(503,'AI尚未启用，需要配置API密钥及允许使用的邮箱。','AI_NOT_CONFIGURED');
  const token=(req.headers.authorization||'').replace(/^Bearer /i,'');
  if(!token || token.length>5000)throw new AppError(401,'请先登录你的学习账号。','LOGIN_REQUIRED');
  const origin=req.headers.origin;
  if(origin && new URL(origin).host !== req.headers.host)throw new AppError(403,'请求来源不正确。','ORIGIN_REJECTED');
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
export async function openAI(endpoint,body,form=false) {
  const headers={Authorization:`Bearer ${process.env.OPENAI_API_KEY}`};
  if(!form)headers['Content-Type']='application/json';
  const response=await remote('https://api.openai.com/v1/'+endpoint,{method:'POST',headers,body:form?body:JSON.stringify(body)},38000);
  if(!response.ok) {
    const status=response.status;
    throw new AppError(status===429?429:502,status===401?'AI密钥未通过验证，请在Vercel检查配置。':status===429?'AI服务暂时达到额度或请求限制，请检查API账单或稍后重试。':'AI请求未完成，请检查模型权限或稍后重试。录音仍已保存。','AI_UPSTREAM_ERROR');
  }
  try{return await response.json();}catch{throw new AppError(502,'AI返回内容无法读取，请稍后重试。');}
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
  f.fixes=f.fixes.filter(x=>typeof x.original==='string'&&x.original.trim()&&transcript.toLowerCase().includes(x.original.toLowerCase())&&typeof x.suggested==='string'&&typeof x.reason_zh==='string').slice(0,2);
  f.strengths=f.strengths.filter(x=>typeof x==='string').slice(0,2);
  return f;
}
export function sendError(res,error) {
  const known=error instanceof AppError;
  res.status(known?error.status:500).json({error:known?error.code:'INTERNAL_ERROR',message:known?error.message:'请求没有完成，录音不会因此删除。请稍后重试。'});
}
