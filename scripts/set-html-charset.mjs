#!/usr/bin/env node
/**
 * 给静态托管里的 HTML 补 charset=utf-8。
 *
 * 背景：tcb hosting deploy 只按扩展名写 Content-Type（text/html），不带 charset；
 * 网关原样回源，所以线上响应头缺 charset=utf-8。
 * 这里用 COS CopyObject + x-cos-metadata-directive: Replaced 就地改元数据，
 * 不重新上传内容（ETag 不变）。
 *
 * 用法：
 *   node scripts/set-html-charset.mjs --dry-run   # 只 HEAD，看现在的 Content-Type
 *   node scripts/set-html-charset.mjs             # 实际写入
 *
 * 凭据：优先环境变量 COS_SECRET_ID / COS_SECRET_KEY（可选 COS_SESSION_TOKEN），
 * 否则回退读 ~/.tccli/default.credential。注意：tccli 的 OAuth 临时凭据会被 COS
 * 拒绝（InvalidAccessKeyId），回退路只在用永久密钥登录时可用。
 * 每次 tcb hosting deploy 之后都要重跑，因为上传会把 Content-Type 改回去。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REGION = process.env.COS_REGION || 'ap-shanghai';
const BUCKET = process.env.COS_BUCKET || '1a69-static-ucalc-8gcrvzxk48dd172e-1252521100';
const HOST = BUCKET + '.cos.' + REGION + '.myqcloud.com';

// 只处理本站自己的页面，不动桶根的 __auth / adminportal / cloud-admin 等内部前缀
const DEFAULT_KEYS = ['index.html', '404.html', 'xiaoermei/index.html', 'xiaoqingwa/index.html', 'xiaoqingwa/privacy.html'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keysArg = args.find((a) => a.startsWith('--keys='));
const keys = keysArg ? keysArg.slice('--keys='.length).split(',') : DEFAULT_KEYS;

const sha1hex = (s) => crypto.createHash('sha1').update(s).digest('hex');
const hmacHex = (key, s) => crypto.createHmac('sha1', key).update(s).digest('hex');
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function authorization(cred, method, pathname, headers) {
  const now = Math.floor(Date.now() / 1000);
  const keyTime = (now - 60) + ';' + (now + 3600);
  const signKey = hmacHex(cred.secretKey, keyTime);
  const headerNames = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const headerList = headerNames.map((k) => k + '=' + enc(headers[k])).join('&');
  const httpString = method.toLowerCase() + '\n' + pathname + '\n\n' + headerList + '\n';
  const stringToSign = 'sha1\n' + keyTime + '\n' + sha1hex(httpString) + '\n';
  const signature = hmacHex(signKey, stringToSign);
  return [
    'q-sign-algorithm=sha1',
    'q-ak=' + cred.secretId,
    'q-sign-time=' + keyTime,
    'q-key-time=' + keyTime,
    'q-header-list=' + headerNames.join(';'),
    'q-url-param-list=',
    'q-signature=' + signature,
  ].join('&');
}

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
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw.secretId || !raw.secretKey) throw new Error('缺少 secretId / secretKey');
  return raw;
}

async function call(cred, method, key, extraHeaders) {
  const pathname = '/' + key;
  const headers = Object.assign({ host: HOST }, extraHeaders || {});
  if (cred.token) headers['x-cos-security-token'] = cred.token;
  headers.authorization = authorization(cred, method, pathname, headers);
  return fetch('https://' + HOST + pathname, { method, headers });
}

const cred = loadCredentials();
let changed = 0;
for (const key of keys) {
  const head = await call(cred, 'HEAD', key);
  if (!head.ok) {
    console.log('SKIP ' + key + ' (' + head.status + ')');
    continue;
  }
  const current = head.headers.get('content-type') || '';
  if (dryRun) {
    console.log('HEAD ' + key + '  content-type=' + current);
    continue;
  }
  if (current.includes('charset')) {
    console.log('OK   ' + key + '  已有 charset');
    continue;
  }
  const res = await call(cred, 'PUT', key, {
    'content-type': 'text/html; charset=utf-8',
    'x-cos-copy-source': HOST + '/' + enc(key),
    'x-cos-metadata-directive': 'Replaced',
  });
  const after = res.ok ? (await call(cred, 'HEAD', key)).headers.get('content-type') : null;
  console.log((res.ok ? 'SET  ' : 'FAIL ') + key + ' -> ' + (after || res.status));
  if (res.ok && after && after.includes('charset')) changed += 1;
}
console.log(dryRun ? 'dry-run done' : 'done, ' + changed + ' file(s) updated');
