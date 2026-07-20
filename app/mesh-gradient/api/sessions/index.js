const participants = require("../../lib/participants");
const store = require("../../lib/kv-store");
const { readJsonBody } = require("../../lib/read-json-body");

module.exports = async function handler(req, res) {
  // TEMP DEBUG (原因調査中、確認後に削除する): ハンドラー自体に到達しているか、
  // req.bodyがVercel側で既に(自動)パース済みかを無条件で確認する。
  console.log("[handler debug] entered. method=", req.method, "req.body type=", typeof req.body);
  res.setHeader("x-debug-handler-reached", "1");
  res.setHeader("x-debug-req-body-type", typeof req.body);
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    // TEMP DEBUG (原因調査中、確認後に削除する)
    res.status(400).json({ error: "invalid json", debugMessage: e && e.message, debugRaw: e && e.debugRaw, debugReqBodyType: typeof req.body, debugReqBody: req.body });
    return;
  }
  const created = participants.createSession(body);
  await store.saveSession(created.sid, created.session);
  res.status(200).json({ sessionId: created.sid, selfId: created.selfId });
};
