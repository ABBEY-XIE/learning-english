# Roam 第一次部署：不用写代码

版本：0.1.0 ｜ 2026年10月12日

**现在先完成第一部分：把网页发布出来。**不需要一次填完所有平台，也不用再注册账号。
项目包没有真实密钥、密码或私人录音。请不要把这些内容添加进代码或发到聊天里。

## 第一部分：上传文件，让Vercel显示网页

1. 解压 `roam-learning-english-v0.1.zip`，打开里面的 `learning-english` 文件夹。
2. 回到你已有的GitHub仓库 `ABBEY-XIE/learning-english`，确认分支为 `main`。
3. 点击文件列表上方 **Add file → Upload files**。
4. **把learning-english文件夹里面的文件和子文件夹一起拖进去。**不要拖压缩包，不要只上传index.html，也不要把最外层learning-english目录本身拖进去。
5. 等上传完成。提交说明填写 `Add Roam personal speaking v0.1`，选择直接提交到 `main`，点击 **Commit changes**。如果界面只能提议分支／Propose changes，需要提交后合并到main；个人新仓库通常可直接提交。
6. 回到原来的Vercel项目，打开 **Deployments**，查看最新一条部署。代码已连接时，main分支的新提交会触发部署。
7. 最新部署显示Ready后，使用项目Overview中的 **Visit** 打开。现在应该看到Roam首页，而不是初始的404。

上传后仓库第一页应能直接看到这些内容（不应再多套一层目录）：

```text
api/       public/      scripts/      server/
src/       supabase/    tests/
index.html
package.json
package-lock.json
vercel.json
README.md
SETUP.md
TESTING.md
开始使用.html
```

`.gitignore`、`.env.example`是隐藏文件。Mac Finder按Command＋Shift＋句号可显示隐藏文件；这两个文件可上传，但填写了真实值的`.env`或`.env.local`绝不能上传。不要把系统生成的.DS_Store拖进去。

### Vercel仍然失败时

先查看最新部署的Build Logs，不要删除项目重建。给协助者提供错误文字或不包含密钥的截图。
必要时检查项目设置：Framework为 **Other**、Root Directory为仓库根目录、Build Command为 `npm run build`、Output Directory为 `dist`、Node.js为22.x。项目的vercel.json已经设置构建命令与输出目录。
如果你只是重新部署了最初只有README的旧提交，仍会404；必须从包含新代码的main提交部署。

### 第一次只测本机录音

用手机浏览器打开同一个正式网址，建议Safari或Chrome普通窗口，不用无痕模式。
进入“今日练习”，点击“开始说话”，授权麦克风，说10秒左右，再点结束保存。
回放这段录音，再录一段；确认档案里是两个独立文件。刷新网页，检查两段仍能回放。
此时显示“本机试用模式”“仅本机保存”完全正常——**尚未接通云端，也尚未接通AI**。
先用不含隐私的测试内容，不要把重要录音仅存本机。不要清浏览器数据，也不要在不同Vercel临时域名之间来回录：它们的本机存储是分开的。

## 第二部分：准备Supabase私人空间

### 2.1 创建数据表与私有音频权限

等Supabase项目不再显示“Coming up…”后，进入项目的 **SQL Editor**，新建查询。
打开本包 `supabase/setup.sql`，复制全部内容并粘贴到SQL编辑器，点击Run。
它创建录音／周期／复盘数据表、私人音频空间和按日调用限制；脚本可重复执行，不会删除原有录音。
SQL编辑器若提示包含DROP操作，本脚本只替换命名为`roam_...`的访问策略，不删除数据表。请完整保留BEGIN与COMMIT。
执行后检查表和Storage里有 `speaking-audio`，而且必须是 **Private，不是Public**。
如果有任何SQL错误，先停止下一步并查看报错；不要为了绕开错误关闭RLS或改公开桶。

### 2.2 建立一个学习登录账号

这是登录Roam的账号，不是Supabase管理后台密码。
在 **Authentication → Users** 中选择新增用户／Add user／Create new user，填你自己的邮箱并设置一个单独的密码。
后台创建时选择邮箱已确认／Auto Confirm，或者完成对应邮箱确认流程。
随后到Authentication的 **Sign In / Providers** 相关设置中关闭 **Allow new users to sign up**；保留邮箱密码登录，不启用匿名登录。关闭公开注册后，已经创建的账号仍然可以登录。
没有注册按钮不等于后端已关闭注册，必须完成上述设置。

### 2.3 复制两个非私密连接值

在Supabase项目的 **Connect** 中查看Project URL和Publishable key；也可以在 **Settings → API Keys** 找到公钥。
公钥应当以 `sb_publishable_` 开头。如果尚无该类型，先在API Keys创建新的公钥。
不要复制Secret key、service_role、数据库密码或连接字符串。

回Vercel项目，打开 **Environment Variables**（有些界面放在Settings中），添加：

| Name：照此填写 | Value：你自己从项目中复制 |
|---|---|
| `SUPABASE_URL` | Project URL，完整HTTPS地址 |
| `SUPABASE_PUBLISHABLE_KEY` | 以sb_publishable_开头的Publishable key |

先应用到Production。没有调试需要时，不把真实个人数据环境开放给不可信Preview部署。
保存后在Deployments中对最新源码重新 **Redeploy**，环境变量不会自动应用到旧部署。

### 2.4 验证云端，而不只是看到绿色图标

新部署Ready后刷新Roam → 连接与设置 → 输入你刚创建的学习邮箱和密码，并确认保存授权。
点击“检查并同步云端”，录一段新的短音频；必须等该段显示 **云端已保存**。
本机试用阶段的旧录音不会擅自归入账号；点击“把本机试用记录导入此账号”，核对账号后确认。
用另一台设备的同一正式网址登录这个学习账号，进入录音档案、加载回放，才算跨设备保存通过。
测试阶段仍要下载备份；不要把“登录成功”误认为“音频上传成功”。

## 第三部分：最后开启真实AI

前两部分稳定后再做。ChatGPT订阅与API是独立服务，网站没有自动借用你Pro额度的能力。
在你自己的OpenAI开发者项目内开通可用API和计费，创建项目API密钥，只保存在Vercel服务端配置：

| Name | Value |
|---|---|
| `OPENAI_API_KEY` | 你自己的项目API密钥，不发聊天、不写代码 |
| `ALLOWED_EMAILS` | 允许使用AI的学习账号邮箱；单人版只填你一个 |

保存后再次Redeploy。在Roam设置中看到“AI配置已填写”只表示配置存在；首次真实调用成功才说明连接有效。
默认转写模型是 `gpt-4o-mini-transcribe`，文本反馈模型是 `gpt-4.1-mini`。无需先修改；如模型在你的项目不可用再由开发协助者调整。

使用路径：录完并云端保存 → 查看录音 → 转写这一段 → 回听，修正听错文字 → 确认文字，获取反馈 → 重练或继续AI追问。
只修正转写错误，不先把英语润色完再评分。
首次调用会说明录音发给OpenAI转写、确认后的文字及少量对话前文用于反馈；只有同意并点击才发送。
内置课程题和系统朗读不冒充实时AI。没有API连接时，转写及评分按钮禁用，不出现随机分数。
每个学习账号每天UTC时间最多80次AI请求（转写和评估各算一次，失败也计入）。这是一层保护，不是固定美元预算，也不是商业级风控。请同时查看API账单。

## 使用边界：第一版要知道的事情

- 当前是前台短回合录音，不是锁屏耳机连续对练。每段建议10–30秒；最长2分钟会保存，不要求说满。
- 录音时不能切页。后台／锁屏发生中断时会尽力保存已取得片段，但文件可能不完整，必须回听，不能保证每种设备都恢复成功。
- 本机存储可能被浏览器清理；从Safari添加到主屏幕后，应重新验证登录与云端历史，不假设本机缓存一定共享。
- 云端同步不是独立备份。定期在“连接与设置”导出含录音的完整备份，存到自己安全的文件夹。当前完整备份音频合计上限100MB，超过时先逐段下载；备份未加密，不能公开分享。
- 退出账号不会自动删除本机副本；共用设备先导出，再清除并退出。
- 只评当前回答的任务完成、表达清晰及语法用词，不评发音、不给雅思或CEFR等级。
- 数据图显示录音时长（含停顿），不是净发言时长。首答与重练分开；周复盘是数据汇总和自评，不声称已经证明水平提高。
- 断网时仍以本机先保存为目标；联网后需重新打开页面、点击同步，不保证关掉页面后的后台补传。
- 取消录音／删除文件／云端同步没有进行真实手机验证前，不要把本版作为唯一录音工具。

## 更新时不丢数据的做法

先导出当前完整备份；新版本先在预览环境检查，再发布正式域名。
不要删除原Supabase项目，不要更换成公开桶，不要清除浏览器数据来解决一个页面错误。
服务工作线程会在关闭旧页面后逐步启用新版本；测试更新前先完成当前录音并关闭旧标签，再打开同一正式网址。
测试需要清缓存时，先确认音频已经云端保存或有完整导出备份。

## 官方参考（核查日期：2026-10-12）

- GitHub网页上传：https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Vercel Git部署：https://vercel.com/docs/git
- Vercel环境变量：https://vercel.com/docs/environment-variables/managing-environment-variables
- Supabase项目URL与公钥：https://supabase.com/docs/guides/getting-started/api-keys
- Supabase登录配置：https://supabase.com/docs/guides/auth/general-configuration
- Supabase音频权限：https://supabase.com/docs/guides/storage/security/access-control
- MediaRecorder中断限制：https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event
- OpenAI语音转写：https://developers.openai.com/api/docs/guides/speech-to-text
- OpenAI结构化输出：https://developers.openai.com/api/docs/guides/structured-outputs

本指南没有远程修改你的GitHub、Vercel或Supabase。配置完成与否，以你账号中的实际结果为准。
