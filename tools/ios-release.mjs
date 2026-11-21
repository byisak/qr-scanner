#!/usr/bin/env node
// App Store 출시를 App Store Connect API로 (웹 로그인 없이).
// 순서: (EAS로 빌드·업로드한 뒤) 빌드 처리 대기 → 버전 만들기(없으면) → "이 버전에서 업그레이드된 사항" → 빌드 붙이기 → (--submit) 심사 제출
//
// 사용:
//   node tools/ios-release.mjs --whats-new "• 바뀐 점 1\n• 바뀐 점 2" [--submit] [--dry-run]
//   node tools/ios-release.mjs --whats-new-file notes.txt --submit
//   node tools/ios-release.mjs --whats-new-file notes.txt --submit --replace   (심사 대기 중인 이전 버전을 이 버전으로 교체)
// 버전·빌드 번호는 app.json(expo.version, expo.ios.buildNumber)에서 읽는다. --version / --build 로 바꿀 수 있음.
//
// 키: eas.json submit.production.ios 의 ascApiKeyPath·ascApiKeyId·ascApiKeyIssuerId·ascAppId (키 파일은 저장소 밖, 출력하지 않음)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(name);

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const asc = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')).submit?.production?.ios ?? {};
const VERSION = opt('--version') ?? app.version;
const BUILD = String(opt('--build') ?? app.ios?.buildNumber ?? '');
const DRY = flag('--dry-run');
const SUBMIT = flag('--submit');
// 심사 대기 중인 다른 버전이 있으면 그 제출을 취소하고 그 자리를 이 버전으로 바꾼다 (App Store는 준비 중인 버전이 하나뿐)
const REPLACE = flag('--replace');
let whatsNew = opt('--whats-new');
if (opt('--whats-new-file')) whatsNew = fs.readFileSync(opt('--whats-new-file'), 'utf8');
if (whatsNew) whatsNew = whatsNew.replace(/\\n/g, '\n').trim();

for (const k of ['ascAppId', 'ascApiKeyPath', 'ascApiKeyId', 'ascApiKeyIssuerId']) {
  if (!asc[k]) throw new Error(`eas.json submit.production.ios.${k} 가 없어요`);
}
const APP_ID = asc.ascAppId;
const KEY = fs.readFileSync(asc.ascApiKeyPath.replace(/^~/, process.env.HOME), 'utf8');

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: asc.ascApiKeyId, typ: 'JWT' });
  const body = b64({ iss: asc.ascApiKeyIssuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: KEY, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

async function api(method, url, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = json.errors?.map((x) => `${x.title}: ${x.detail ?? ''}`).join(' / ') ?? text;
    throw new Error(`${method} ${url} → ${res.status} ${e}`);
  }
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('·', ...a);

// 1) 빌드 찾기 (처리 끝날 때까지 기다림, 최대 30분)
async function findBuild() {
  const q = `/v1/builds?filter[app]=${APP_ID}&filter[version]=${encodeURIComponent(BUILD)}&filter[preReleaseVersion.version]=${encodeURIComponent(VERSION)}&limit=1`;
  const until = Date.now() + 30 * 60_000;
  for (;;) {
    const b = (await api('GET', q)).data?.[0];
    const state = b?.attributes?.processingState;
    if (b && state === 'VALID') return b;
    if (b && (state === 'FAILED' || state === 'INVALID')) throw new Error(`빌드 ${VERSION} (${BUILD}) 처리 실패: ${state}`);
    if (DRY || Date.now() > until) throw new Error(`빌드 ${VERSION} (${BUILD})가 아직 없거나 처리 중이에요 (${state ?? '없음'})`);
    log(`빌드 ${VERSION} (${BUILD}) 처리 대기 중 (${state ?? '아직 안 보임'})…`);
    await sleep(30_000);
  }
}

// 2) 버전 찾기·만들기
async function findOrCreateVersion() {
  const list = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${encodeURIComponent(VERSION)}&filter[platform]=IOS&limit=1`);
  const v = list.data?.[0];
  if (v) return { v, created: false };
  // 아직 출시 안 된 다른 버전(준비 중·심사 대기)이 있으면 새로 못 만든다 → 그 버전 번호를 바꿔 쓴다
  const inflight = ((await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`)).data ?? []).find((x) =>
    ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY', 'WAITING_FOR_REVIEW', 'READY_FOR_REVIEW'].includes(
      x.attributes.appStoreState ?? x.attributes.appVersionState,
    ),
  );
  if (inflight) {
    let st = inflight.attributes.appStoreState ?? inflight.attributes.appVersionState;
    log(`출시 전 버전 ${inflight.attributes.versionString}(${st})이 있어 그 자리를 ${VERSION}으로 바꿈`);
    if (DRY) return { v: null, created: false };
    if (st === 'WAITING_FOR_REVIEW' || st === 'READY_FOR_REVIEW') {
      if (!REPLACE) throw new Error(`버전 ${inflight.attributes.versionString}이 심사 대기 중이에요. 바꾸려면 --replace`);
      const subs = (await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=WAITING_FOR_REVIEW,READY_FOR_REVIEW&limit=5`)).data ?? [];
      for (const sb of subs) {
        await api('PATCH', `/v1/reviewSubmissions/${sb.id}`, { data: { type: 'reviewSubmissions', id: sb.id, attributes: { canceled: true } } });
        log(`심사 제출 취소: ${sb.id}`);
      }
      // 취소가 반영돼 편집 가능해질 때까지 기다림
      for (let i = 0; i < 40; i++) {
        st = (await api('GET', `/v1/appStoreVersions/${inflight.id}`)).data.attributes.appStoreState;
        if (!['WAITING_FOR_REVIEW', 'READY_FOR_REVIEW'].includes(st)) break;
        await sleep(15_000);
      }
      log(`취소 후 상태: ${st}`);
    }
    const renamed = await api('PATCH', `/v1/appStoreVersions/${inflight.id}`, {
      data: { type: 'appStoreVersions', id: inflight.id, attributes: { versionString: VERSION } },
    });
    return { v: renamed.data, created: false };
  }
  if (DRY) return { v: null, created: false };
  const made = await api('POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: VERSION, releaseType: 'AFTER_APPROVAL' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  return { v: made.data, created: true };
}

const build = await findBuild();
log(`빌드: ${VERSION} (${BUILD}) — ${build.attributes.processingState}`);
const { v, created } = await findOrCreateVersion();
if (!v) {
  log(`버전 ${VERSION}: 아직 없음 → 만들 예정 (--dry-run이라 멈춤)`);
  process.exit(0);
}
const state = v.attributes.appStoreState ?? v.attributes.appVersionState;
log(`버전 ${VERSION}: ${created ? '새로 만듦' : '이미 있음'} — 상태 ${state}`);
const editable = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'].includes(state);
if (!editable) {
  log(`이 상태에서는 고칠 수 없어요 (심사 중·출시됨). 끝.`);
  process.exit(0);
}

// 3) 이 버전에서 업그레이드된 사항 (모든 언어에 같은 글)
if (whatsNew) {
  const locs = (await api('GET', `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`)).data ?? [];
  for (const l of locs) {
    if (DRY) {
      log(`[dry-run] ${l.attributes.locale} 새 기능 문구 바꿀 예정`);
      continue;
    }
    await api('PATCH', `/v1/appStoreVersionLocalizations/${l.id}`, { data: { type: 'appStoreVersionLocalizations', id: l.id, attributes: { whatsNew } } });
    log(`${l.attributes.locale} 새 기능 문구 넣음`);
  }
} else {
  log('--whats-new가 없어 새 기능 문구는 그대로 둠 (첫 버전이 아니면 심사 제출에 필요)');
}

// 4) 빌드 붙이기
if (DRY) log(`[dry-run] 빌드 ${BUILD} 붙일 예정`);
else {
  await api('PATCH', `/v1/appStoreVersions/${v.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
  log(`빌드 ${BUILD} 붙임`);
}

// 5) 심사 제출
if (!SUBMIT) {
  log('심사 제출은 안 함 (--submit 으로 제출)');
  process.exit(0);
}
if (DRY) {
  log('[dry-run] 심사 제출할 예정');
  process.exit(0);
}
// 아직 안 낸 제출 묶음이 있으면 그걸 쓰고, 없으면 새로
const open = (await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW&limit=1`)).data?.[0];
const sub =
  open ??
  (
    await api('POST', '/v1/reviewSubmissions', {
      data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
    })
  ).data;
try {
  await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } },
      },
    },
  });
} catch (e) {
  // 이미 들어 있으면 그대로 진행
  if (!/already|ENTITY_ERROR\.RELATIONSHIP|duplicate/i.test(String(e.message))) throw e;
}
await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } });
log(`심사 제출함 — iOS ${VERSION} (${BUILD})`);
