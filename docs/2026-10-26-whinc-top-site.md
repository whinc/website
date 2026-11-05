# whinc.top 站点与域名（决策正本）

2026-10-26 定案并上线。记录「为什么这样切」，运行命令见 `docs/DEVELOPMENT.md`，视觉契约见 `docs/DESIGN.md`。

2026-11-05：仓库由 `ucalc-website` 更名为 `website`，Pages 备用地址变为 `https://whinc.github.io/website/`；下文出现的旧地址与旧名是当时的记录，不改写。

2026-11-04 起站点从 `ucalc` 仓的 `website/` 迁到本仓 `site/`，部署改由 GitHub Actions 驱动（gate → CloudBase 与 Pages 并行）。

## 站点模型

- 一个主域 `whinc.top`，一份静态站，路径分区：`/` 门户，`/<product-slug>/` 产品页（`xiaoermei` 已上线，`xiaoqingwa` 已建待部署）。
- **门户是索引，不是招牌**（2026-10-27 定）：每款产品一张等权卡、每款两张预览、整卡可点；不给任何一款加按钮、加图或放大字号。
- 不做 `/apps/` 中间层，不做子域名。理由：产品区与未来的 `/blog/`、`/about/` 平级，加产品不动已有 URL。
- 每页一份独立 HTML，不用 SPA，浏览器端不跑框架运行时。`xiaoqingwa/index.html` 是官方组件库 SSR 的**构建产物**（源在本仓外），改文案直接改产物、改完重跑门禁；`xiaoermei/` 与门户是手写。

## 域名与证书

| 项 | 值 |
|---|---|
| 环境 | `ucalc-8gcrvzxk48dd172e`（个人版 `baas_personal`，至 2028-06-27） |
| 自定义域名上限 | **1 个**（套餐硬限制，预检 `QUOTA_EXCEEDED`） |
| 绑定 | `whinc.top`，AccessType=CDN，路由 `/` → `STATIC_STORE staticstore` |
| 证书 | `b5kgiPpD`（TrustAsia 免费 DV，覆盖 `whinc.top` + `www.whinc.top`，2026-09-26 → 2026-12-25） |
| DNS | `@` CNAME → `whinc.top.cdn.dnsv1.com`（TTL 600）；归属权 TXT `_cloudbase-challenge` = 环境 ID |

**域名上限 1 是这套方案的关键约束**：换域名时必须先解绑旧域名，中间存在空窗；两个域名并存需要升级套餐。`www` 因此无法绑定。

## 旧域名处置

- `ucalc.whinc.top`：**下线**。删路由 → 解绑 → 删 DNS（RecordId 2236246150）。无 301 —— 网关路由只支持 `pathRewrite`，没有 redirect；CDN 控制台里也没有该域名可配。旧链接直接失效，不做迁移。
- `xiaoermei.whinc.top`：不绑。证书 `bsWZxEPL`（至 2027-01-24）闲置，到期自然作废。
- `www.whinc.top`：不解析。启用需要升级套餐，或在 DNSPod 控制台手加「显性 URL」（DNSPod API 不接受 URL 记录类型）。

## SEO

- 唯一 canonical：门户 `https://whinc.top/`，产品页 `https://whinc.top/xiaoermei/`、`https://whinc.top/xiaoqingwa/`。og:url / og:image / JSON-LD 的 `@id` 与 `url` 全部指向同一组 URL。
- `robots.txt` 只列 `https://whinc.top/sitemap.xml`；sitemap 收录 `/`（0.8）、`/xiaoermei/`（1.0）、`/xiaoqingwa/`（1.0）。
- 百度统计两个 ID 只在 `whinc.top` / `www.whinc.top` 加载（`xiaoermei/main.js` 末尾），本地与默认域名不计。
- 备案号已补齐（琼ICP备2023011144号，各页面页脚 `a.icp` 均链接 https://beian.miit.gov.cn/），搜索引擎提交不再被阻塞；canonical 已上线，不再有「指向未解析域名」的风险。
- `/xiaoqingwa/privacy.html` 是 `noindex,follow`，**不进 sitemap**；启用任何统计前必须先改它的「第三方与 Cookie」段。

## 已知限制

- 缺失路径：2026-10-26 观察为 **500**（环境级行为，非本站引入，`404.html` 不被自动使用）；2026-11-02 复测返回 **200 + `404.html` 正文**（桶级 ErrorDocument 已生效，但状态码仍是 200，属软 404）。
- 默认域名 `*.tcloudbaseapp.com` 会先弹腾讯云「页面测试域名」拦截页，验收一律用自有域名。
- 同一份内容也存在于默认域名上；它带拦截页、且不在 sitemap，暂不处理。

## 回滚

现场快照在 `.scratch/landing-page-2026-10/rollback/`（不随仓库分发，重取方法见下）：

| 文件 | 内容 | 重取 |
|---|---|---|
| `root-index.before.html` | 上线前桶根入口（旧 Next 站） | `tcb hosting download index.html <path>` |
| `domains-before.json` | 域名 + 路由 + 证书原值 | `tcb domains ls -e <env> --json` |
| `dns-before.json` | 上线前 18 条 DNS | `tccli dnspod DescribeRecordList --Domain whinc.top --Limit 200` |

- 撤站：把 `root-index.before.html` 传回根 `index.html`，删除 `xiaoermei/`、`portal.css`、`404.html`、`robots.txt`、`sitemap.xml`。
- 撤域名：`tcb routes delete whinc.top -p /` → `tcb domains rm whinc.top` → 删 `@` CNAME。
- 恢复 ucalc（如需）：`tcb domains add ucalc.whinc.top --certid amh2c2b7 --access-type CDN` → 路由 `/` → `STATIC_STORE staticstore` → CNAME `ucalc.whinc.top.cdn.dnsv1.com`。

## 发布记录

2026-11-04：站点迁入本仓 `site/`，CI 上线。`gate`（9 条产物门禁，含新增「站内引用必须相对，404 除外」）→ `deploy-cloudbase`（`tcb hosting deploy ./site`）与 `deploy-pages`（排除 `404.html` 组装 `_pages/`）并行。首轮 CloudBase 部署被 COS 拒绝（`Access Denied`，51 个文件全失败）：`QcloudTCBFullAccess` 只覆盖 `tcb:*`，而静态托管落在**共享桶** `1a69-static-<envId>-<appid>`（不是环境云存储桶），需要单独的 COS 策略。已建自定义策略 `ucalc-website-hosting-cos`（`cos:HeadBucket/GetBucket/GetObject/HeadObject/PutObject`，资源限定该桶 `/*`）并挂到子用户 `ucalc-website-ci`，重跑通过（cloudbase 56s / pages 16s）。

验收：`whinc.top` 与 `whinc.github.io/ucalc-website` 各 64 条路径（页面 + 全部站内相对引用）全 200；6 个关键文件字节与本地一致；`https://whinc.top/__nope__` 仍为 200 + 404.html 正文（软 404，延续 2026-11-02 结论）；Pages 的 `404.html` 按设计不发布（子路径下根绝对路径会失效），走 GitHub 默认 404。**新增已知限制**：HTML 响应头不再带 charset —— `tcb hosting deploy` 只按扩展名写 `Content-Type: text/html`，原先手工跑的 `set-html-charset.mjs` 未纳入 CI（页面内有 `<meta charset>`，渲染不受影响）。

2026-11-02：`xiaoqingwa/` 落地页与隐私政策随门户同批上线（54 个文件，`--ignore README.md,DESIGN.md`）。`whinc.top` 实测 `/`、`/xiaoermei/`、`/xiaoqingwa/`、`/xiaoqingwa/privacy.html`、`robots.txt`、`sitemap.xml` 与抽样静态资源均 200 且字节数与本地一致；门户含「小青蛙伴学」卡，sitemap 三条 `<loc>` 正确。同轮修 `websiteGate` 两处过期判据：canonical / og:url 允许自闭合标签；可索引页面按 `robots` meta 动态排除，不再硬编码 `404.html`。

2026-10-27：门户改为等权索引，新增「小青蛙伴学」卡与两组预览；`ItemList`、sitemap 各加一条。同日 `/xiaoqingwa/` 落地页与 `privacy.html` 落成（本地验收通过，与原型 A 像素一致、有/无 JS 同帧 AE=0）。**尚未部署**：门户与落地页须同批上传，否则首页第二张卡是 500 死链。

2026-10-26：门户 + 产品页上线；`/`、`/xiaoermei/`、robots、sitemap、静态资源实测 200，证书 `CN=whinc.top` 有效，公共 DNS 解析正常；`/preview/` 旧副本删除。
