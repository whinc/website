# 开发与部署

主站 <https://whinc.top> 的静态产物、门禁与部署。产品介绍与扫码入口见仓库根 `README.md`。

## 仓库边界

- 本仓只放站点：`site/` 是部署产物，CloudBase 部署 `./site` 即站点根。
- 小程序源码在私有仓，不在这里。
- 两个部署目标：**CloudBase 静态托管** → <https://whinc.top>（主站，自有域名 + CDN）；**GitHub Pages** → <https://whinc.github.io/website/>（备用通道，子路径）。

## 更名记录

2026-11-05：仓库从 `ucalc-website` 更名为 `website`，Pages 备用地址随之变为 `https://whinc.github.io/website/`。旧 Pages 地址**不跳转，直接 404**（仓库页 URL 仍会重定向，Pages 不会）。CI 与构建脚本里没有仓库名字面量，改名对流水线是零改动。

以下外部资源**保留旧名**，不影响功能，看到不必困惑：

- 腾讯云子账号与自定义 COS 策略沿用旧名（策略只开该桶的读写）
- CloudBase 环境 ID `ucalc-8gcrvzxk48dd172e`（不可改；桶名见 `tcb hosting detail`）

## 目录

```
site/                 部署产物（CloudBase 部署 ./site 即站点根）
  index.html          门户（/）：单栏索引，每款产品一张等权卡 + 每款两张预览
  portal.css
  404.html  robots.txt  sitemap.xml
  xiaoermei/          产品页（/xiaoermei/）
    index.html  styles.css  main.js
    assets/brand/     logo、小程序码、分享图、favicon
    assets/shots/     12 张真实界面截图（WebP，828px）+ 2 张 preview-*.webp
  xiaoqingwa/         产品页（/xiaoqingwa/）：单页静态介绍 + 隐私政策
    index.html        落地页（SSG 产物：官方组件 SSR，浏览器零 React）
    privacy.html      隐私政策（noindex,follow，不进 sitemap）
    assets/           logo、小程序码、5 张界面图、OG 图、组件库 CSS、字体
scripts/gate.mjs      站点产物门禁（node:test，零依赖）
scripts/set-*.mjs     运维脚本：补 HTML charset、写桶静态网站配置（手工跑，不进 CI）
scripts/cache-rules.json  scripts/website-config.before-20261028.xml   CDN 缓存规则与桶配置快照
docs/
  DEVELOPMENT.md      本文件
  DESIGN.md           视觉契约与门禁读数
  2026-10-26-whinc-top-site.md   域名/证书/回滚/已知限制的正本
  搜一搜…             小程序商店物料（ai / sketch / pdf / png），不参与部署
```

新页面 = 新目录 `<slug>/`，与 `xiaoermei/` 平级；不要加 `/apps/` 层。

## 本地预览

站内引用全是相对路径，必须在站点根下预览：

```bash
python3 -m http.server 4174 --directory site
# http://localhost:4174/                          门户
# http://localhost:4174/xiaoermei/                产品页
# http://localhost:4174/xiaoqingwa/               产品页
# http://localhost:4174/xiaoqingwa/privacy.html   隐私政策
```

## 门禁

```bash
node scripts/gate.mjs
```

11 条断言（CI 的 gate job 跑的就是它）：扫描域覆盖、site/ 不放文档、无占位符、canonical 唯一且等于
`https://whinc.top` + 路径、og:url 同源同址、备案号恰好一次、sitemap 与可索引页一致、robots 只列本站
sitemap、**站内引用必须相对（404.html 除外）**、**跟踪文本不含凭据特征**。

最后一条是 2026-11-03 新增：`xiaoqingwa/index.html` 是外部 SSG 产物，重新生成会退回 `/xiaoqingwa/...`
根绝对路径，那样在 Pages 子路径下整页掉样式——门禁负责拦。

## 部署

push 到 `main` 自动部署（也可在 Actions 页 `workflow_dispatch` 手动触发）。`.github/workflows/deploy.yml`
三个 job：`gate` → `deploy-cloudbase` 与 `deploy-pages` 并行。

触发条件带 `paths` 过滤：只有 `site/**`、`scripts/gate.mjs`、`.github/workflows/deploy.yml` 变化才跑；
改 README、`docs/`、`.claude/` 不会触发一次生产部署。2026-11-05 用一条只改本文件的 push 实测过：
没有新的 workflow run 产生。

凭据是 GitHub Actions secrets `TCB_SECRET_ID` / `TCB_SECRET_KEY`，对应一个仅编程访问的腾讯云子账号
（权限：TCB 全读写 + CDN 只读 + 该共享桶的 COS 读写）。

手工部署（等价命令）：

```bash
npx --yes --package @cloudbase/cli@3.8.9 tcb hosting deploy ./site -e ucalc-8gcrvzxk48dd172e
```

- **不加 `--prune`**：桶根下还有别的前缀，prune 会一并删掉。
- 门户与 `/xiaoqingwa/` 必须同批部署，否则首页第二张卡是死链。
- Pages 产物在 CI 里组装 `_pages/` 时排除 `404.html`：它用的是根绝对路径（托管方会在任意深度回它，
  只能用绝对路径），放进子路径会整页掉资源，所以 Pages 走 GitHub 默认 404。

## 已知限制

- **CloudBase 的 404 是软 404**：不存在的路径返回 200 + `404.html` 正文（网关固定改写成 200，COS 侧
  `OriginalHttpStatus` 已开也没用）。页面自带 `noindex`，不会被收录。
- **无尾斜杠路径**：`https://whinc.top/xiaoermei`（不带 `/`）返回 200 但不跳转，此时相对路径按
  `/xiaoermei` 的父目录解析，CSS/图片会失效。站内链接、sitemap、canonical 全带斜杠，因此只有手敲 URL 会踩到。
- **HTML 响应头没有 charset**：`tcb hosting deploy` 只按扩展名写 `Content-Type: text/html`。页面内有
  `<meta charset="utf-8">`，浏览器渲染不受影响；要补 HTTP 头需在部署后用 COS `CopyObject` 改元数据
  （`scripts/set-html-charset.mjs` 可手工补，这一步没有纳入 CI）。
- `www.whinc.top` 不解析：CloudBase 个人版自定义域名上限 1 个，被裸域占满。

## 运维脚本（手工，不进 CI）

| 文件 | 用途 | 何时跑 |
|---|---|---|
| `scripts/set-html-charset.mjs` | 用 COS `CopyObject` 就地给 HTML 补 `Content-Type: text/html; charset=utf-8`（只改元数据，ETag 不变） | 每次 `tcb hosting deploy` 之后；先 `--dry-run` 看现状 |
| `scripts/set-error-document.mjs` | 写桶静态网站配置：错误页 `404.html` + `OriginalHttpStatus: Enabled`，并清掉遗留的 404 重定向规则 | 桶配置被改动或 404 行为异常时；`--dry-run` 只读 |
| `scripts/cache-rules.json` | CDN 缓存规则载荷：静态资源边缘 1 天 / 浏览器 10 分钟，HTML·sitemap 60 秒，目录首页 60 秒 | 需要重新应用缓存规则时（控制台按此填或走 API） |
| `scripts/website-config.before-20261028.xml` | 2026-10-28 改动前的桶静态网站配置快照（含导致 404 死循环的 `RoutingRules`） | 只有要回滚那次改动时才用 |

凭据与目标桶都走环境变量：`COS_BUCKET` 必填（桶名在 CloudBase 控制台复制），凭据优先 `COS_SECRET_ID` / `COS_SECRET_KEY`（可选 `COS_SESSION_TOKEN`），
没有则回退 `~/.tccli/default.credential`。**tccli 的 OAuth 临时凭据会被 COS 拒绝**
（`InvalidAccessKeyId`），那条回退路只在用永久密钥登录时可用。

## 改内容时要同步的位置

| 改什么 | 一起改 |
|---|---|
| 产品页工具名/描述 | 按钮 `data-*`、索引里的可点名称（与同名按钮同源）、JSON-LD `featureList` |
| FAQ | 可见 FAQ 与 JSON-LD `mainAnswer` 必须同义 |
| 门户产品卡 | `ItemList` JSON-LD、`sitemap.xml`、该产品在预览带的两张图（见 DESIGN「门户是索引」） |
| 门户预览带 | 每款两张、3:4 预裁（`preview-*.webp`），组内 12 / 组间 28 与卡片同栅格 |
| 备案号 | 各页面页脚的 `<a class="icp">`（门户、xiaoermei、xiaoqingwa、privacy 四处） |
| 小青蛙伴学文案 | `xiaoqingwa/index.html` 可见文案与 JSON-LD 同义；改数量/功能时连带 FAQ、`#trust`、页脚免责行 |
| 小青蛙伴学隐私页 | `xiaoqingwa/privacy.html`；启用任何统计前先改「第三方与 Cookie」段，再上线脚本 |
| 截图 | 用微信开发者工具模拟器（iPhone 12/13 Pro，390×844）逐页截取；只换 `assets/shots/` 同名 WebP：`magick in.png -resize 828x -strip -quality 82 out.webp` |
| 截图新鲜度 | 页面改版或工具下线后必须重拍；下线工具的截图、索引条目、chip 与 JSON-LD `featureList` 同轮删除 |
| 首屏搜索胶囊 | 文案「小而美工具」与小程序名、页尾 `#copy-name` 同源 |
| 预览高度 | `--screen-h: min(460px, 52svh - 26px, 100svh - 380px)`；调完复跑 390 截图确认整屏可见 |
| README 产品能力 | 只改能力词，不写数量与年级——精确数字留在产品页，见「对外口径」 |

## 设计门禁

```bash
S=~/.codebuddy/skills/design-taste-frontend/scripts
node $S/lint.mjs site/index.html site/portal.css \
  site/xiaoermei/index.html site/xiaoermei/styles.css site/xiaoermei/main.js \
  site/xiaoqingwa/index.html site/xiaoqingwa/privacy.html
node $S/inspect.mjs http://localhost:4174/
```

依赖 `~/.codebuddy/skills`，只在本机跑；CI 只跑零依赖的 `scripts/gate.mjs`。读数与辩护记录在
`docs/DESIGN.md`「门禁与辩护」，改版后更新那张表。

## 对外口径

README、GitHub 仓库描述、产品页 H1 不写工具数量、不写年级、不写路线目标——这些会过期，也容易被读成承诺。
精确数字只写产品页正文，依据见 `docs/DESIGN.md`「文案」。

## 历史

2026-11-03 站点迁入 `site/`，替换掉本仓原来的 Next.js 落地页（旧代码仍在 git 历史里，
`b560223` 之前）。域名、证书、回滚值见 `docs/2026-10-26-whinc-top-site.md`。

2026-11-05 仓库由 `ucalc-website` 更名为 `website`。
