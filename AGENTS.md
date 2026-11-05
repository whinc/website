# website

主站 whinc.top 的静态产物与部署。README 是产品门面：技术内容、工具数量、年级、路线目标都不写在那里。

- 构建 / 部署 / 门禁 / 运维：docs/DEVELOPMENT.md
- 视觉契约、改版门禁读数：docs/DESIGN.md
- 域名、证书、回滚、已知限制：docs/2026-10-26-whinc-top-site.md
- 小程序源码在兄弟仓 `../ucalc`、`../uson`，不在本仓

## 改完跑什么

```bash
node scripts/gate.mjs
```

## 提交与推送

- `git add` 与 `git commit` 分两条命令跑：OCR 闸门在 commit 前读暂存区，连写会被拦。
- 被 OCR 闸门拦下是常态：看过规则后用 `OCR_GATE=ack git commit …` 重试。
- 改 `.github/` 下文件必须走 SSH 推送：`gh` 的 OAuth token 没有 `workflow` scope，HTTPS 会被拒。
- push 到 main 会部署生产站；只有 `site/**`、`scripts/gate.mjs`、workflow 自身变化才触发。
