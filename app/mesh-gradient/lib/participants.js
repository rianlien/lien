// セッション/参加者に対する純粋なビジネスロジック。
// 永続化方式（ローカルのJSONファイル／Vercel上のUpstash Redis）から独立させてあり、
// server.js（ローカル開発用）とapi/*.js（Vercelデプロイ用）の両方から同じロジックを呼ぶ。
// 引数のsessionはプレーンなJSオブジェクト（呼び出し側が読み書きする）。
"use strict";

const crypto = require("crypto");

const DEFAULT_REACH = 0.38;

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

// 回答者ページ向け: 自分自身の情報＋発起人の色だけを追加する（発起人の位置・他の友達の情報は含めない）
function serializeForRespondent(session, p) {
  const self = findSelf(session);
  const out = serializeParticipant(p);
  out.initiatorColor = (self && self.color) || null;
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

function addParticipant(session, body) {
  const pid = newId();
  session.participants[pid] = {
    id: pid, label: body.label || "友達", x: body.x, y: body.y,
    color: null, reach: DEFAULT_REACH, isSelf: false, respondedAt: null
  };
  return pid;
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
  delete session.participants[pid];
  return { status: 200, body: { ok: true } };
}

module.exports = {
  DEFAULT_REACH: DEFAULT_REACH,
  newId: newId,
  createSession: createSession,
  addParticipant: addParticipant,
  listParticipants: listParticipants,
  getForRespondent: getForRespondent,
  patchParticipant: patchParticipant,
  deleteParticipant: deleteParticipant
};
