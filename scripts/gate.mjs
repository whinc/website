#!/usr/bin/env node
/**
 * 站点产物门禁（node:test，零依赖）。
 *
 * 从 ucalc 的 src/__tests__/websiteGate.test.ts 迁出：站点不再住在 ucalc 里，
 * 门禁跟着站点走，CI 的 gate job 直接跑这一个文件。
 *
 * 锚定 docs/2026-10-26-whinc-top-site.md（域名与路径模型、SEO 口径），断言：
 * - 每页 canonical 唯一，等于 https://whinc.top + 该页路径，og:url 与之相同；
 * - 每页备案号恰好一次，且链接 beian.miit.gov.cn；
 * - 发布产物不含占位符与本地路径；
 * - sitemap 的 <loc> 集合 == 有 canonical 的页面集合；
 * - robots.txt 只列该 sitemap；
 * - 站内引用必须相对（404.html 除外）；
 * - README 引用的仓库相对资源都存在。
 *
 * 边界：只校验产物文本。线上是否可达、证书是否有效、CDN 缓存是否刷新都不在本门范围。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_DIR = path.join(REPO_ROOT, "site");
const ORIGIN = "https://whinc.top";
const ICP_NUMBER = "琼ICP备2023011144号";
const ICP_HREF = "https://beian.miit.gov.cn/";
const SITEMAP_URL = ORIGIN + "/sitemap.xml";

/** 会被部署到托管的文件类型 */
const SHIPPED_EXT = /\.(html|css|js|xml|txt)$/;
/** 根绝对引用豁免：404.html 由托管方在任意深度路径回给用户，只能用根绝对 */
const ROOT_ABS_EXEMPT = new Set(["site/404.html"]);
const PLACEHOLDERS = [
  "待补充",
  "TODO",
  "FIXME",
  "example.com",
  "localhost",
  "127.0.0.1",
  "/Users/",
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    out.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
  }
  return out;
}

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/** site/index.html → "/"；site/xiaoermei/index.html → "/xiaoermei/" */
function routeOf(rel) {
  return "/" + rel.replace(/^site\//, "").replace(/index\.html$/, "");
}

function canonicalsIn(html) {
  const re = /<link rel="canonical" href="([^"]+)"\s*\/?>/g;
  return Array.from(html.matchAll(re), (m) => m[1]);
}

function ogUrlIn(html) {
  const re = /<meta property="og:url" content="([^"]+)"\s*\/?>/g;
  return Array.from(html.matchAll(re), (m) => m[1]);
}

/** 站内引用 = href/src 以单个 "/" 开头（"//" 是协议相对，不属此列） */
function rootAbsoluteRefs(html) {
  const re = /(?:href|src)="(\/[^/][^"]*)"/g;
  return Array.from(html.matchAll(re), (m) => m[1]);
}

const indexable = () => {
  const pages = shipped.filter((rel) => rel.endsWith(".html"));
  return pages.filter((rel) => !/name="robots" content="noindex/.test(read(rel)));
};

const shipped = walk(SITE_DIR)
  .filter((rel) => SHIPPED_EXT.test(rel))
  .sort();
const pages = shipped.filter((rel) => rel.endsWith(".html"));

test("扫描域覆盖整个站点，且确实抓到了页面", () => {
  assert.ok(shipped.length >= 8, "shipped 文件数 = " + shipped.length);
  assert.ok(indexable().length >= 2, "可索引页面数 = " + indexable().length);
  assert.ok(indexable().includes("site/index.html"));
  assert.ok(indexable().includes("site/xiaoermei/index.html"));
});

test("site/ 只放要发布的产物，不放文档", () => {
  const stray = ["site/README.md", "site/DESIGN.md"].filter((rel) =>
    fs.existsSync(path.join(REPO_ROOT, rel)),
  );
  assert.deepEqual(stray, []);
});

test("发布产物不含占位符与本地路径", () => {
  const hits = [];
  for (const rel of shipped) {
    const text = read(rel);
    for (const token of PLACEHOLDERS) {
      if (text.includes(token)) hits.push(rel + " 含 " + token);
    }
  }
  assert.deepEqual(hits, []);
});

test("每页 canonical 唯一且等于 whinc.top + 该页路径", () => {
  const wrong = [];
  for (const rel of indexable()) {
    const found = canonicalsIn(read(rel));
    const want = ORIGIN + routeOf(rel);
    if (found.length !== 1) {
      wrong.push(rel + " canonical 数量 = " + found.length);
    } else if (found[0] !== want) {
      wrong.push(rel + " canonical = " + found[0] + "，期望 " + want);
    }
  }
  assert.deepEqual(wrong, []);
});

test("og:url 与 canonical 同源同址", () => {
  const wrong = [];
  for (const rel of indexable()) {
    const html = read(rel);
    const canon = canonicalsIn(html);
    const og = ogUrlIn(html);
    if (og.length !== 1 || og[0] !== canon[0]) {
      wrong.push(rel + " og:url = " + og.join("|") + "，canonical = " + canon.join("|"));
    }
  }
  assert.deepEqual(wrong, []);
});

test("每页备案号恰好一次，且链接 beian.miit.gov.cn", () => {
  const wrong = [];
  for (const rel of pages) {
    const html = read(rel);
    const count = html.split(ICP_NUMBER).length - 1;
    if (count !== 1) wrong.push(rel + " 备案号出现 " + count + " 次");
    if (!html.includes(ICP_HREF)) wrong.push(rel + " 缺少 " + ICP_HREF + " 链接");
  }
  assert.deepEqual(wrong, []);
});

test("sitemap 的 loc 集合与可索引页面集合一致", () => {
  const xml = read("site/sitemap.xml");
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1]);
  const want = indexable().map((rel) => ORIGIN + routeOf(rel)).sort();
  assert.deepEqual(locs.slice().sort(), want);
});

test("robots.txt 只指向本站 sitemap", () => {
  const txt = read("site/robots.txt");
  const sitemaps = txt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^Sitemap:/i.test(line));
  assert.deepEqual(sitemaps, ["Sitemap: " + SITEMAP_URL]);
});

test("站内引用必须相对（404.html 除外）", () => {
  const wrong = [];
  for (const rel of pages) {
    if (ROOT_ABS_EXEMPT.has(rel)) continue;
    for (const ref of rootAbsoluteRefs(read(rel))) {
      wrong.push(rel + " 引用 " + ref);
    }
  }
  assert.deepEqual(wrong, []);
});

test("README 引用的仓库相对资源都存在", () => {
  const md = read("README.md");
  const refs = [
    ...md.matchAll(/<img[^>]+src="([^"]+)"/g),
    ...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g),
  ]
    .map((m) => m[1])
    .filter((src) => !/^(?:https?:)?\/\//.test(src));
  assert.ok(refs.length > 0, "README 缺少小程序码图片");
  for (const src of refs) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, src)), "README 引用的 " + src + " 不存在");
  }
});
