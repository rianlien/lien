// セッション/参加者に対する純粋なビジネスロジック。
// 永続化方式（ローカルのJSONファイル／Vercel上のUpstash Redis）から独立させてあり、
// server.js（ローカル開発用）とapi/*.js（Vercelデプロイ用）の両方から同じロジックを呼ぶ。
// 引数のsessionはプレーンなJSオブジェクト（呼び出し側が読み書きする）。
"use strict";

const crypto = require("crypto");

const DEFAULT_REACH = 0.38;
// Upstash無料枠の1リクエストあたりの値サイズ上限に対する安全マージン（internal-design参照）。
const MAX_ARTWORK_BYTES = 900 * 1024;

function newId() {
  return crypto.randomBytes(6).toString("hex");
}

function serializeParticipant(p) {
  return { id: p.id, label: p.label, x: p.x, y: p.y, color: p.color, reach: p.reach, isSelf: !!p.isSelf, respondedAt: p.respondedAt || null };
}

function findSelf(session) {
  return Object.keys(session.participants)
    .map(function (k) { return session.participants[k]; })
    .filter(function (p) { return p.isSelf; })[0];
}

// 回答者ページ向け: 自分自身の情報＋発起人の色だけを追加する（発起人の位置・他の友達の情報は含めない）。
// completedはセッション全体が完成したかどうかの真偽値のみで、生の座標・色データは一切含めない
// （完成版アートはserializeForRespondentではなく専用のartworkエンドポイントからのみ取得する）。
function serializeForRespondent(session, p) {
  const self = findSelf(session);
  const out = serializeParticipant(p);
  out.initiatorColor = (self && self.color) || null;
  out.completed = !!session.completedAt;
  return out;
}

function createSession(body) {
  const sid = newId();
  const selfId = newId();
  const session = {
    id: sid,
    createdAt: new Date().toISOString(),
    participants: {}
  };
  session.participants[selfId] = {
    id: selfId, label: body.label || "自分", x: body.x, y: body.y,
    color: null, reach: DEFAULT_REACH, isSelf: true, respondedAt: null
  };
  return { sid: sid, selfId: selfId, session: session };
}

// 「完成」後はロスター変更を全面凍結する（完成版アートに使われた参加者構成と、その後のロスターが
// 食い違うと「スナップショット」の意味が崩れるため。session_completion internal-design参照）。
function addParticipant(session, body) {
  if (session.completedAt) return { status: 409, body: { error: "session completed" } };
  const pid = newId();
  session.participants[pid] = {
    id: pid, label: body.label || "友達", x: body.x, y: body.y,
    color: null, reach: DEFAULT_REACH, isSelf: false, respondedAt: null
  };
  return { status: 200, body: { participantId: pid } };
}

function listParticipants(session) {
  return Object.keys(session.participants).map(function (k) {
    return serializeParticipant(session.participants[k]);
  });
}

function getForRespondent(session, pid) {
  const p = session.participants[pid];
  if (!p) return null;
  return serializeForRespondent(session, p);
}

// 明示的に確定（confirm）した参加者は、発起人自身も含めて色・影響範囲・位置のいずれも変更できない。
// 「結果を見てから調整できてしまう」バイアスを防ぐための制約で、友達・発起人を区別しない。
// confirmは、色を設定しただけでは立たない（発起人が色を選んだ後も影響範囲を見て調整したり、色を
// 選び直したりする自然な試行錯誤を許すため）。confirm:trueを明示的に送ったときだけロックされる。
function patchParticipant(session, pid, body) {
  const p = session.participants[pid];
  if (!p) return { status: 404, body: { error: "participant not found" } };
  // 完成後はロスター全体を凍結する。未回答枠のconfirmも含めて拒否することが「未回答枠の自動締切」の実体
  // （個別に締め切る処理を別途作らず、既存の書き込みガードに乗せる。session_completion internal-design参照）。
  if (session.completedAt) return { status: 409, body: { error: "session completed" } };

  const locked = !!p.respondedAt;
  const touchesLockedField = typeof body.reach === "number" || typeof body.color === "string"
    || typeof body.x === "number" || typeof body.y === "number";
  if (locked && touchesLockedField) {
    return { status: 409, body: { error: "already responded", participant: serializeForRespondent(session, p) } };
  }

  if (typeof body.x === "number") p.x = body.x;
  if (typeof body.y === "number") p.y = body.y;
  if (typeof body.label === "string") p.label = body.label;
  if (typeof body.reach === "number") p.reach = body.reach;
  if (typeof body.color === "string") p.color = body.color;
  if (body.confirm === true && !p.respondedAt) {
    if (!p.color) return { status: 400, body: { error: "color is required before confirm" } };
    p.respondedAt = new Date().toISOString();
  }

  return { status: 200, body: serializeForRespondent(session, p) };
}

function deleteParticipant(session, pid) {
  const p = session.participants[pid];
  if (!p) return { status: 404, body: { error: "participant not found" } };
  if (p.isSelf) return { status: 400, body: { error: "cannot remove self" } };
  if (session.completedAt) return { status: 409, body: { error: "session completed" } };
  delete session.participants[pid];
  return { status: 200, body: { ok: true } };
}

function decodeArtwork(base64) {
  if (typeof base64 !== "string" || !base64) return { error: "artwork is required" };
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) return { error: "artwork is required" };
  if (buffer.length > MAX_ARTWORK_BYTES) return { error: "artwork too large" };
  return { buffer: buffer };
}

// 「完成」の事前条件（発起人自身のrespondedAtが済んでいること）と、渡された完成版アートの検証だけを行う。
// session.completedAtのスタンプ自体はmarkCompletedに分離してあり、呼び出し側（API層）で
// 「アート保存 → markCompleted → セッション保存」の順に実行することで、画像だけが欠けた中間状態を
// 作らない（session_completion internal-design参照）。
function prepareCompletion(session, artworkBase64) {
  if (session.completedAt) return { status: 409, body: { error: "already completed" } };
  const self = findSelf(session);
  if (!self || !self.respondedAt) {
    return { status: 400, body: { error: "confirm your own color before completing" } };
  }
  const decoded = decodeArtwork(artworkBase64);
  if (decoded.error) return { status: 400, body: { error: decoded.error } };
  return { status: 200, buffer: decoded.buffer };
}

function markCompleted(session) {
  session.completedAt = new Date().toISOString();
}

// 完成版アートの閲覧・ダウンロード可否の唯一の判定箇所。未回答のまま締め切られた枠には公開しない。
function canViewArtwork(session, pid) {
  if (!session.completedAt) return false;
  const p = session.participants[pid];
  if (!p) return false;
  return !!p.isSelf || !!p.respondedAt;
}

module.exports = {
  DEFAULT_REACH: DEFAULT_REACH,
  newId: newId,
  createSession: createSession,
  addParticipant: addParticipant,
  listParticipants: listParticipants,
  getForRespondent: getForRespondent,
  patchParticipant: patchParticipant,
  deleteParticipant: deleteParticipant,
  prepareCompletion: prepareCompletion,
  markCompleted: markCompleted,
  canViewArtwork: canViewArtwork
};
