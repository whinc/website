#!/usr/bin/env node
/**
 * 配置 COS 静态网站文档：错误页 404.html + 真 404 状态码，并清掉遗留的 404 重定向规则。
 *
 * 背景：桶里原有一条 RoutingRule（404 → ReplaceKeyPrefixWith 'ucalc-website/' + URLRedirect），
 * 而该前缀不存在 → 404 再跳 404 → 网关报 STATIC_RESOURCE_TOO_MANY_REDIRECTS（HTTP 500）。
 *
 * 用法：
 *   node scripts/set-error-document.mjs --dry-run   # 只读当前配置
 *   node scripts/set-error-document.mjs             # 写入
 *
 * 凭据：优先环境变量 COS_SECRET_ID / COS_SECRET_KEY（可选 COS_SESSION_TOKEN），
 * 否则回退读 ~/.tccli/default.credential。tccli 的 OAuth 临时凭据会被 COS 拒绝
 * （InvalidAccessKeyId），回退路只在用永久密钥登录时可用。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REGION = process.env.COS_REGION || 'ap-shanghai';
const BUCKET = process.env.COS_BUCKET;
if (!BUCKET) throw new Error('缺少 COS_BUCKET：桶名在 CloudBase 控制台复制');
const HOST = `${BUCKET}.cos.${REGION}.myqcloud.com`;

const XML = `<WebsiteConfiguration>
  <IndexDocument>
    <Suffix>index.html</Suffix>
  </IndexDocument>
  <ErrorDocument>
    <Key>404.html</Key>
    <OriginalHttpStatus>Enabled</OriginalHttpStatus>
    <Charity404>Disabled</Charity404>
  </ErrorDocument>
  <AutoAddressing>
    <Status>Enabled</Status>
  </AutoAddressing>
</WebsiteConfiguration>`;

const dryRun = process.argv.includes('--dry-run');

function loadCredentials() {
  // 环境变量优先：长期密钥才能直接调 COS
  if (process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY) {
    return {
      secretId: process.env.COS_SECRET_ID,
      secretKey: process.env.COS_SECRET_KEY,
      token: process.env.COS_SESSION_TOKEN || '',
    };
  }
  const file = path.join(os.homedir(), '.tccli', 'default.credential');
  if (!fs.existsSync(file)) {
    throw new Error('缺少凭据：设置 COS_SECRET_ID / COS_SECRET_KEY，或先登录生成 ' + file);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha1', k).update(s).digest('hex');
const cred = loadCredentials();

async function call(method, query, body, extraHeaders = {}) {
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 3600}`;
  const headers = { host: HOST, ...extraHeaders };
  if (cred.token) headers['x-cos-security-token'] = cred.token;
  const lower = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
  const names = Object.keys(lower).sort();
  const qnames = Object.keys(query).sort();
  const headerList = names.map((k) => `${k}=${encodeURIComponent(lower[k])}`).join('&');
  const queryList = qnames.map((k) => `${k}=${encodeURIComponent(query[k])}`).join('&');
  const httpString = `${method.toLowerCase()}\n/\n${queryList}\n${headerList}\n`;
  const signKey = hmac(cred.secretKey, keyTime);
  const signature = hmac(signKey, `sha1\n${keyTime}\n${sha1(httpString)}\n`);
  const auth = [
    'q-sign-algorithm=sha1',
    `q-ak=${cred.secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${names.join(';')}`,
    `q-url-param-list=${qnames.join(';')}`,
    `q-signature=${signature}`,
  ].join('&');
  const url = `https://${HOST}/${queryList ? '?' + queryList : ''}`;
  return fetch(url, { method, headers: { ...headers, authorization: auth }, body });
}

const before = await call('GET', { website: '' });
console.log('--- 当前配置 ---');
console.log((await before.text()).trim());

if (dryRun) { console.log('\ndry-run，未写入'); process.exit(0); }

const res = await call('PUT', { website: '' }, XML, { 'content-type': 'application/xml' });
console.log('\n--- 写入结果 ---');
console.log('status', res.status);
const body = await res.text();
if (!res.ok) { console.log(body); process.exit(1); }

const after = await call('GET', { website: '' });
console.log('--- 写入后配置 ---');
console.log((await after.text()).trim());
