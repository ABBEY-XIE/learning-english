# Roam v0.2：Kimi＋百炼配置

更新：2026-10-19。适用于已部署v0.1且Supabase已连接的个人用户。原网站、录音和账号继续使用，不重建项目、不重跑SQL、不清除浏览器数据。

## 1. 百炼控制台

保持“华北2（北京）”和默认业务空间。点击API-KEY → 创建API Key，备注可填Roam语音转写。使用普通按量付费密钥，不使用Token Plan或Coding Plan专用sk-sp-密钥。

如果显示“部分功能使用受限”，先点开查看具体原因，按真实提示处理；不要猜测是欠费或实名问题。创建时复制完整密钥并自行安全保存，不要发到聊天或上传GitHub。新密钥可能只在创建时显示完整值。

同时保存创建窗口里的API Host。默认北京地址是https://dashscope.aliyuncs.com；控制台若提供北京工作空间专属域名，也可以使用。不要混用不同地域密钥。

## 2. Vercel环境变量

在原learning-english项目的Environment Variables中，保留SUPABASE_URL和SUPABASE_PUBLISHABLE_KEY。添加或核对以下变量，环境包含Production：

| Name | Value |
|---|---|
| KIMI_API_KEY | 你现有的Kimi密钥；已有MOONSHOT_API_KEY可沿用，不必两个都填 |
| DASHSCOPE_API_KEY | 刚创建的百炼北京地域普通API Key |
| ALLOWED_EMAILS | Supabase中创建并已确认邮箱的学习账号邮箱，单人只填一个 |

两个私密密钥选Secret，只填进Vercel，不写网页或代码。不要把Kimi密钥放进OPENAI_API_KEY，本版不读取该变量。

默认模型和地址已写入代码，通常不需填写以下可选变量：

- KIMI_MODEL=kimi-k2.6（也支持kimi-k2.5）
- KIMI_BASE_URL=https://api.moonshot.cn/v1；仅国际站Kimi账号改成https://api.moonshot.ai/v1
- DASHSCOPE_ASR_MODEL=qwen-audio-3.0-asr-flash
- DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com

若百炼创建窗口给出的API Host是北京业务空间专属域名，将根地址填写到DASHSCOPE_BASE_URL，例如https://实际空间ID.cn-beijing.maas.aliyuncs.com。不要附加compatible-mode/v1、控制台路径或API路径。仅接受官方域名，不支持第三方中转。

## 3. 部署和验收

保存变量后，对包含v0.2代码的最新版本执行Production Redeploy。完成当前录音并关闭旧标签，再打开Domains中的固定正式网址；不要清除浏览器数据。

连接与设置应分别显示“百炼转写”和“Kimi反馈”。配置已填写仅表示配置存在，不等于密钥、余额、权限和网络已经验证。

录制一段10秒非隐私英文 → 等云端已保存 → 打开详情 → 转写这一段 → 同意将音频发送给百炼 → 回听核对文字 → 确认文字获取反馈 → 同意将文字发送给Kimi。只纠正识别错误，不提前润色自己说错的英语。

最后在另一台设备的同一固定网址登录同一账号，确认录音、文字和反馈可读取。AI失败不删除原音；不要重复快速点击。错误提示会区分百炼与Kimi。

## 数据和费用边界

选中的原始音频由服务端从Supabase私有桶读取后交给百炼，不公开音频链接，也不把Supabase密钥交给百炼。Kimi仅接收核对后文字、题目、沟通目标及少量前文。本版不向OpenAI发送请求。

AI按次由用户主动触发，并分别提示同意。两家API均可能收费；每日80次请求保护沿用旧逻辑（UTC日界，失败也计入），不等于金额硬上限。首次只测试一段，并查看各平台账单。

不修改数据库结构。转写保存模型来源；评分保存Kimi模型和规则版本。文字反馈不是发音测评或等级认证。编码后转写输入上限10MB，超过会报错，不截断或删除原始音频。建议每段10–30秒。

## 官方接口依据

- https://help.aliyun.com/zh/model-studio/get-api-key
- https://help.aliyun.com/en/model-studio/fun-asr-flash-recorded-speech-recognition-http-api
- https://platform.moonshot.cn/docs/guide/use-json-mode-feature-of-kimi-api
- https://huggingface.co/moonshotai/Kimi-K2.6
