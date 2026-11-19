# 校园墙（Campus Wall）

一个可以直接部署到 Vercel 的校园公开留言墙：普通账号发帖 / 点赞 / 评论，管理员凭密码登录后可以删帖、禁言。

- 技术栈：Next.js 14（App Router）+ Supabase（Postgres 数据库 + 图片存储）
- 部署：GitHub 仓库 → Vercel 一键导入 → 绑定腾讯云域名
- 无需服务器、无需 COS（图片走 Supabase Storage）

---

## 一、先回答你的问题：需不需要 COS / 轻量数据库？

| 项目 | 是否需要 | 说明 |
| --- | --- | --- |
| **数据库** | **必须** | Vercel 是 Serverless，函数实例随时重启、没有本地磁盘，SQLite / JSON 文件存不住数据。所以一定要一个云端数据库。 |
| **COS 对象存储** | **不必须** | 图片可以存在 Supabase Storage（免费额度 1GB，单图 4MB 以内够用）。只有当你希望「图片走国内 CDN、打开更快、容量更大」时，才换成腾讯云 COS。 |
| **腾讯云轻量数据库** | **不必须** | 如果你想把数据库也放在国内（低延迟、可备案访问），可以把 Supabase 换成腾讯云轻量数据库（MySQL/PostgreSQL）或 TDSQL-C，但需要改代码里的数据访问层，成本比 Supabase 高。 |

**最省事的推荐方案（本仓库已实现）**：

- 数据库 + 图片存储：Supabase 免费版（一个项目搞定两件事）
- 托管：Vercel 免费版
- 域名：腾讯云域名，DNS 加一条 CNAME 指向 Vercel 即可

> 什么时候该上 COS？
> 1. 图片总量超过 1GB，或想放视频 / 大文件；
> 2. 用户主要在国内，Supabase Storage 的境外节点加载图片慢；
> 3. 想用腾讯云 CDN + 图片处理（缩放、水印）。
> 这时把 `app/api/upload/route.js` 换成 COS SDK 上传，数据库保持不变即可。

---

## 二、功能清单

普通账号：
- 注册 / 登录（用户名 + 密码，bcrypt 加密存储）
- 发帖（文字 ≤1000 字，可选配图 ≤4MB）
- 点赞 / 取消点赞（每人对每条帖子只能赞一次）
- 评论（≤300 字）
- 被禁言后不能发帖、不能评论（仍可浏览、点赞）

管理员：
- 独立入口 `/admin`，只输入密码（密码存在环境变量 `ADMIN_PASSWORD`）
- 删帖（连带删除该帖的评论与点赞）
- 用户列表，禁言 / 解除禁言
- 可以发「官方」帖子（作者显示为「管理员」）

---

## 三、目录结构

```
campus-wall/
├─ app/
│  ├─ page.js                 # 首页：帖子流
│  ├─ login/page.js           # 登录 / 注册
│  ├─ admin/page.js           # 管理后台
│  ├─ globals.css             # 全站样式
│  ├─ layout.js
│  └─ api/
│     ├─ auth/register|login|logout|admin|me/route.js
│     ├─ posts/route.js                      # 列表 + 发帖
│     ├─ posts/[id]/route.js                 # 详情 + 删帖
│     ├─ posts/[id]/like/route.js            # 点赞
│     ├─ posts/[id]/comments/route.js        # 评论
│     ├─ upload/route.js                     # 图片上传
│     └─ admin/users/route.js, admin/users/[id]/mute/route.js
├─ components/                # SiteHeader / Composer / PostCard
├─ lib/                       # supabase / auth(JWT) / 格式化工具
├─ supabase/schema.sql        # 数据库建表脚本（一次性执行）
└─ .env.example
```

---

## 四、本地运行

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量文件并填写
cp .env.example .env.local      # Windows PowerShell: Copy-Item .env.example .env.local

# 3. 启动
npm run dev                      # 打开 http://localhost:3000
```

### 先在 Supabase 建库（5 分钟）

1. 打开 https://supabase.com 注册，**New project**，区域选 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`（离国内较近）。
2. 项目创建后进入 **SQL Editor → New query**，把 `supabase/schema.sql` 全文粘进去，点 **Run**。
   - 这一步会建好 `users / posts / likes / comments` 四张表、点赞数自动统计触发器、`campus-wall` 图片存储桶。
3. **Project Settings → API**，复制两个值填进 `.env.local`：
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key（点 Reveal 才可见）→ `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ 这是最高权限密钥，只能放服务端，**不要**加 `NEXT_PUBLIC_` 前缀、不要提交到 GitHub。

### 再填两个自定义变量

```
AUTH_SECRET=随便一串 32 位以上随机字符
ADMIN_PASSWORD=你的管理员密码
```

`AUTH_SECRET` 可用 `openssl rand -base64 32` 生成，改掉它等于让所有已登录用户掉线。

---

## 五、部署到 Vercel（GitHub → Vercel）

```bash
git init
git add .
git commit -m "feat: 校园墙初版"
git branch -M main
git remote add origin https://github.com/<你的用户名>/campus-wall.git
git push -u origin main
```

（在 GitHub 上先新建一个空仓库 `campus-wall`，不要勾选 README / .gitignore，避免冲突。）

然后：

1. 打开 https://vercel.com → **Add New → Project** → 选择刚推的仓库 → Import
2. Framework 会自动识别为 Next.js，Build Command / Output 保持默认
3. **Environment Variables** 里加 4 个（Production / Preview / Development 都勾上）：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTH_SECRET`
   - `ADMIN_PASSWORD`
4. Deploy，得到 `https://xxx.vercel.app`

之后每次 `git push` 会自动重新部署。

> 也可以用命令行：`vercel --prod`（会引导你登录并绑定项目）。

---

## 六、绑定腾讯云域名

1. 腾讯云控制台 → **域名与网站 → 我的域名** → 找到你的域名 → **解析**
2. 添加记录：
   | 主机记录 | 记录类型 | 记录值 |
   | --- | --- | --- |
   | `@`（根域名） | CNAME | `cname.vercel-dns.com` |
   | `www` | CNAME | `cname.vercel-dns.com` |
3. Vercel 项目 → **Settings → Domains** → 添加 `yourdomain.com` 和 `www.yourdomain.com`，按提示验证
4. 等 DNS 生效（几分钟到几小时），Vercel 会自动签发 HTTPS 证书

**关于备案**：Vercel 服务器在境外，域名解析到境外服务器**不需要 ICP 备案**；但如果同一域名以后要解析到国内服务器（如腾讯云 CVM/COS/CDN），就必须先完成 ICP 备案。

**关于国内访问速度**：Vercel 的默认域名在国内部分网络访问偏慢甚至不稳定，绑定自己的域名后会好一些；如果用户主要在校园内网、对速度要求高，可以考虑国内云服务器 + 备案（那就不是 Vercel 方案了）。

---

## 七、管理员怎么用

1. 访问 `https://你的域名/admin`
2. 输入 `ADMIN_PASSWORD` 环境变量里设置的密码（登录态 7 天，比普通用户的 30 天短）
3. 帖子管理：直接删帖；用户管理：禁言 / 解除禁言

> 管理员账号不是数据库里的普通用户，而是一个独立的「密码牌」身份，所以不会占用用户名，也不能发评论（可以发官方帖子）。
> 想改密码：改 Vercel 环境变量 `ADMIN_PASSWORD` 后 Redeploy，已登录的管理员需要重新登录。

---

## 八、微信扫码登录怎么开

登录页已经内置微信扫码入口，默认是禁用状态（按钮显示「未配置」）。启用只差两个环境变量：

| 变量名 | 值 |
| --- | --- |
| `WECHAT_APP_ID` | 微信开放平台「网站应用」的 AppID |
| `WECHAT_APP_SECRET` | 对应的 AppSecret |

加完 Redeploy 即可，代码会自动：

1. `/api/auth/wechat/start` 跳转微信扫码页（`scope=snsapi_login`）；
2. 扫码后微信回调 `/api/auth/wechat/callback`，用 code 换 openid；
3. 首次登录自动建账号（拿微信昵称作用户名，重名自动加后缀），写 `users.wechat_openid`；
4. 下发和账号密码登录同一套 JWT cookie，之后发帖点赞评论完全一致。

**开通门槛（这段是重点）**

- 必须是**微信开放平台**的「网站应用」，个人主体不能申请，需要企业 / 个体工商户营业执照 + 300 元/年认证费；
- 开放平台审核时要求**授权回调域名已完成 ICP 备案**。本站跑在 Vercel（境外），域名没有备案，很可能卡在这一步；
- 另一种路径是认证服务号 + 网页授权（`snsapi_userinfo`），同样需要认证与备案。

所以在没有 AppID/AppSecret 之前，微信按钮会一直是禁用状态——这不是 bug，是缺资质。拿到资质后把两个变量填进 Vercel，功能立刻生效，不用改代码。

---

## 九、常见坑

| 现象 | 原因 / 解决 |
| --- | --- |
| 发帖报「加载帖子失败」 | 环境变量没配好，或 Supabase 项目被暂停（免费版长期无访问会休眠，登录控制台点一下恢复） |
| 发帖报「permission denied for table posts」 | 建表后没给 `service_role` 授权，跑一遍 `supabase/schema.sql` 里的 `grant ...` 那几行 |
| 图片上传 413 | Vercel 单次请求上限 4.5MB，前端已限制 4MB；更大的图请先压缩，或改走 COS 直传 |
| 图片显示不出来 | `schema.sql` 里的 `campus-wall` 桶没建成功，或桶不是 public |
| 管理员密码一直报错 | Vercel 改了环境变量没 Redeploy |
| 微信按钮是灰的 | 提示「未配置」= 缺 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`，见第八节 |
| 想让页面更「校园」一点 | 改 `app/globals.css` 里的 `--brand` / `--brand-2` 两个色值即可换主题色；已是暗色主题，改 `--bg` / `--card` 可调明暗 |

---

## 九、安全说明

- 密码用 bcrypt（10 轮）哈希存储，数据库里看不到明文
- 登录态是 httpOnly + SameSite=Lax + 生产环境 Secure 的签名 JWT，前端拿不到 token
- Supabase 开了 RLS 且不建策略，匿名 key 无法直接读写，所有读写都经服务端接口
- 敏感密钥只在服务端使用，不进 Git（`.env.local` 已在 `.gitignore`）
- 建议上线后在 Vercel 再加一层 **Rate Limit / WAF**，或者给发帖接口加验证码，防止刷屏
