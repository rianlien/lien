// セッション/参加者に対する純粋なビジネスロジック。
// 永続化方式（ローカルのJSONファイル／Vercel上のUpstash Redis）から独立させてあり、
// server.js（ローカル開発用）とapi/*.js（Vercelデプロイ用）の両方から同じロジックを呼ぶ。
// 引数のsessionはプレーンなJSオブジェクト（呼び出し側が読み書きする）。
"use strict";

const crypto = require("crypto");

const DEFAULT_REACH = 0.38;
// 完成版アートのdataURL文字列長の上限。Upstash Redis無料プランのREST APIリクエスト1MB制限に
// JSONラッパー等の余白を残して収まるよう抑える（fable-advisor相談で確認した制約）。
const MAX_FINAL_ART_LENGTH = 900000;

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
// 完成版アート（finalArtDataUrl）は、セッションが完成済み かつ 自分が回答済みの場合のみ含める
// （未回答のまま締め切られた枠には渡さない。回答済みの友達との非対称は要件で明示済み）。
function serializeForRespondent(session, p) {
  const self = findSelf(session);
  const out = serializeParticipant(p);
  out.initiatorColor = (self && self.color) || null;
  out.completedAt = session.completedAt || null;
  out.finalArtDataUrl = (session.completedAt && p.respondedAt) ? (session.finalArtDataUrl || null) : null;
  return out;
}

// 発起人ページ向け: 参加者一覧に加えて、セッション全体の完成状態を返す。
// 発起人は自分自身が完成させた本人なので、respondedAtの有無に関わらず完成版アートを見られる。
function serializeSessionForInitiator(session) {
  return {
    participants: listParticipants(session),
    completedAt: session.completedAt || null,
    finalArtDataUrl: session.completedAt ? (session.finalArtDataUrl || null) : null
  };
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

// 「完成」後の全操作拒否を1箇所にまとめる（addParticipant/patchParticipant/deleteParticipantで共有）。
// participantを渡すと、拒否レスポンスにその参加者の最新状態を添える（クライアントが再同期に使える）。
function completedRejection(session, participant) {
  const body = { error: "session completed" };
  if (participant) body.participant = serializeForRespondent(session, participant);
  return { status: 409, body: body };
}

// 「完成」後は新しい友達枠の追加ができない（要件: 新規招待リンクの発行はできない）。
function addParticipant(session, body) {
  if (session.completedAt) {
    return completedRejection(session);
  }
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

  // 「完成」はセッション全体のスナップショット確定。完成後は発起人自身も含めて一切のフィールドを
  // 変更できない（参加者個別のrespondedAtロックとは別レイヤーで、全参加者に一律にかかる）。
  if (session.completedAt) {
    return completedRejection(session, p);
  }

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
  if (session.completedAt) return completedRejection(session, p);
  delete session.participants[pid];
  return { status: 200, body: { ok: true } };
}

// 発起人による「完成」確定。completedAtのセットとfinalArtDataUrlの保存を1回の呼び出しで行う
// （呼び出し側は結果をそのままstore.saveSessionする1回の保存に乗せる。「完成したが画像が無い」
// という中間状態を作らないため）。不可逆operationのため、既に完成済みなら409で拒否する。
function completeSession(session, dataUrl) {
  if (session.completedAt) {
    // 既に完成済み（例: 別タブ/デバイスからのレースで先に完成させた後の再試行）。
    // completedAt/finalArtDataUrlを添えて返すことで、呼び出し側が「実は完成済み」と正しく判定できるようにする。
    return { status: 409, body: { error: "already completed", completedAt: session.completedAt, finalArtDataUrl: session.finalArtDataUrl || null } };
  }
  if (typeof dataUrl !== "string" || dataUrl.indexOf("data:image/png;base64,") !== 0) {
    return { status: 400, body: { error: "dataUrl must be a base64-encoded PNG data URL" } };
  }
  if (dataUrl.length > MAX_FINAL_ART_LENGTH) {
    return { status: 413, body: { error: "final art image is too large" } };
  }
  session.completedAt = new Date().toISOString();
  session.finalArtDataUrl = dataUrl;
  return { status: 200, body: { completedAt: session.completedAt, finalArtDataUrl: session.finalArtDataUrl } };
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
  completeSession: completeSession,
  serializeSessionForInitiator: serializeSessionForInitiator
};
