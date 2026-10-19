import test from 'node:test';
import assert from 'node:assert/strict';
import {settings,publicConfig,jsonResult,audioInput,parseTranscript,transcribeAudio,evaluateText,providerRequest} from '../server/lib.js';
import coach from '../api/coach.js';
const env={SUPABASE_URL:'https://unit-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_unit_test_0123456789',KIMI_API_KEY:'TEST_KIMI_KEY_NOT_REAL',DASHSCOPE_API_KEY:'TEST_BAILIAN_KEY_NOT_REAL',ALLOWED_EMAILS:'learner@example.com'};
const feedback=()=>({eligible:true,task_score:5,clarity_score:4,language_score:4,evidence_limit:'仅当前文字，未评价发音。',strengths:['说明了自己的需要。'],fixes:[{original:'I want coffee',suggested:'I would like a coffee.',reason_zh:'可选的礼貌表达。'}],natural_answer:'I would like a coffee.',next_question:'Would you like milk?',next_question_zh:'需要牛奶吗？',next_hint:'回答是否需要。'});
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const result=()=>({code:0,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('配置：Kimi与百炼分别启用，不把缺少一家当成全部不可用',()=>{
 const a=publicConfig({...env,DASHSCOPE_API_KEY:''}),b=publicConfig({...env,KIMI_API_KEY:''});
 assert.equal(a.feedbackConfigured,true);assert.equal(a.transcribeConfigured,false);assert.equal(b.transcribeConfigured,true);assert.equal(b.feedbackConfigured,false);
});
test('配置：保留MOONSHOT别名，不误读OPENAI_API_KEY',()=>{
 assert.equal(settings({...env,KIMI_API_KEY:'',MOONSHOT_API_KEY:'alias'}).kimiKey,'alias');
 assert.equal(settings({...env,KIMI_API_KEY:'',OPENAI_API_KEY:'wrong-platform'}).kimi,false);
});
test('配置：私密密钥与白名单不返回浏览器',()=>{
 const c=JSON.stringify(publicConfig(env));for(const key of ['TEST_KIMI_KEY_NOT_REAL','TEST_BAILIAN_KEY_NOT_REAL','learner@example.com'])assert.ok(!c.includes(key));
});
test('配置：拒绝套餐密钥、错误模型和未授权端点',()=>{
 assert.equal(settings({...env,DASHSCOPE_API_KEY:'sk-sp-test'}).bailian,false);
 assert.equal(settings({...env,KIMI_MODEL:'gpt-4.1-mini'}).kimi,false);
 for(const url of ['http://api.moonshot.cn/v1','https://api.moonshot.cn.evil.test/v1','https://x:y@api.moonshot.cn/v1','https://api.moonshot.cn/v1?key=x'])assert.equal(settings({...env,KIMI_BASE_URL:url}).kimi,false);
 assert.equal(settings({...env,DASHSCOPE_BASE_URL:'https://space123.cn-beijing.maas.aliyuncs.com'}).bailian,true);
});
test('数据库：成功的204空响应不会错误地触发JSON失败',async()=>{assert.equal(await jsonResult(new Response(null,{status:204})),null);});
test('音频：保留原始字节，并按WebM或MP4真实格式提交',()=>{
 for(const [mime,format]of [['audio/webm;codecs=opus','webm'],['audio/mp4;codecs=aac','mp4'],['audio/wav','wav']]){const a=audioInput(new Uint8Array([1,2,3]),mime);assert.equal(a.format,format);assert.deepEqual([...Buffer.from(a.data.split(',')[1],'base64')],[1,2,3]);}
});
test('音频：空文件、非音频和超限不会被悄悄截断',()=>{
 assert.throws(()=>audioInput(new Uint8Array(),'audio/wav'));assert.throws(()=>audioInput(new Uint8Array([1]),'text/html'));assert.throws(()=>audioInput(new Uint8Array(7600000),'audio/wav'));
});
test('转写：解析全文，拒绝仅包含最后一句或空文字的响应',()=>{
 assert.equal(parseTranscript({output:{text:' First. Second. ',output:{sentence:{text:'Second.'}}}}),'First. Second.');
 assert.throws(()=>parseTranscript({output:{sentence:{text:'Last only'}}}));assert.throws(()=>parseTranscript({output:{text:''}}));assert.throws(()=>parseTranscript({output:{text:'x'.repeat(4001)}}));
});
test('百炼：按同步ASR规范发送，不外发Supabase凭证',async()=>{
 let args;const text=await transcribeAudio(settings(env),new Uint8Array([1,2]),'audio/mp4',async(...a)=>{args=a;return {output:{text:'I want coffee'}};});
 assert.equal(text,'I want coffee');assert.equal(args[0],'bailian');assert.ok(args[1].endsWith('/api/v1/services/aigc/multimodal-generation/generation'));assert.equal(args[3].parameters.format,'mp4');assert.equal(args[3].model,'qwen-audio-3.0-asr-flash');assert.ok(!JSON.stringify(args).includes(env.SUPABASE_PUBLISHABLE_KEY));
});
test('Kimi：JSON模式与非思考模式，只使用文本消息',async()=>{
 let args;const f=await evaluateText(settings(env),'Evaluate.',{confirmed_transcript:'I want coffee'},async(...a)=>{args=a;return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(feedback())}}]};});
 assert.equal(f.task_score,5);assert.ok(args[1].endsWith('/chat/completions'));assert.deepEqual(args[3].response_format,{type:'json_object'});assert.deepEqual(args[3].thinking,{type:'disabled'});
});
test('Kimi：截断、无效JSON和越界分数均不保存',async()=>{
 for(const answer of [{choices:[{finish_reason:'length',message:{content:'{}'}}]},{choices:[{finish_reason:'stop',message:{content:'not json'}}]},{choices:[{finish_reason:'stop',message:{content:JSON.stringify({...feedback(),task_score:99})}}]}])await assert.rejects(()=>evaluateText(settings(env),'s',{confirmed_transcript:'I want coffee'},async()=>answer));
});
test('错误：上游异常不能回显私密原文或API密钥',async()=>{
 for(const status of [400,401,402,403,404,429,500])await assert.rejects(()=>providerRequest('kimi','url','key',{},async()=>json({error:{message:'SECRET_USER_TEXT',code:'InvalidKey'}},status)),e=>!e.message.includes('SECRET_USER_TEXT')&&e.message.includes('Kimi'));
});
test('端到端模拟：鉴权、转写、204保存、评分、缓存及失败保留',async()=>{
 const oldEnv={...process.env},oldFetch=globalThis.fetch;Object.assign(process.env,env);
 const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
 const row={id,user_id:owner,audio_path:`${owner}/${id}.webm`,duration:12,mime:'audio/webm',prompt:'What would you like?',goal:'Order coffee',transcript_original:'',transcript:'',feedback_history:[]};
 let external=0,fail=false;
 globalThis.fetch=async(url,opts={})=>{
  if(url.endsWith('/auth/v1/user'))return json({id:owner,email:'learner@example.com',email_confirmed_at:'2026-10-19'});
  if(url.includes('/rpc/claim_ai_request'))return json(true);
  if(url.includes('/storage/v1/object/'))return new Response(new Uint8Array([1,2,3]));
  if(url.includes('dashscope.aliyuncs.com')){external++;return json({output:{text:'I want coffee'}});}
  if(url.includes('api.moonshot.cn')){external++;return fail?json({error:{code:'insufficient_quota'}},429):json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(feedback())}}]});}
  if(url.includes('/rest/v1/practice_records')){if(opts.method==='PATCH'){Object.assign(row,JSON.parse(opts.body));return new Response(null,{status:204});}return json([row]);}
  throw new Error('Unexpected mock request');
 };
 const call=async(action,text='I want coffee')=>{const r=result();await coach({method:'POST',headers:{authorization:'Bearer fake',host:'roam.test',origin:'https://roam.test'},body:{recordId:id,action,transcript:text}},r);return r;};
 try{
  assert.equal((await call('transcribe')).code,200);assert.equal(row.transcript_original,'I want coffee');assert.ok(row.transcribe_model.startsWith('bailian:'));
  assert.equal((await call('transcribe')).body.cached,true);assert.equal(external,1);
  assert.equal((await call('evaluate')).code,200);assert.equal(row.feedback.provider,'kimi');assert.equal(row.feedback.pronunciation_assessed,false);
  assert.equal((await call('evaluate')).body.cached,true);assert.equal(external,2);
  fail=true;const before=JSON.stringify(row);assert.equal((await call('evaluate','I want coffee please')).code,429);assert.equal(JSON.stringify(row),before);
  process.env.ALLOWED_EMAILS='';const count=external;assert.equal((await call('transcribe')).body.error,'EMAIL_ALLOWLIST_MISSING');assert.equal(external,count);
 }finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in oldEnv))delete process.env[k];Object.assign(process.env,oldEnv);}
});
