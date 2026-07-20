const participants = require("../../lib/participants");
const store = require("../../lib/kv-store");
const { readJsonBody } = require("../../lib/read-json-body");

module.exports = async function handler(req, res) {
  // TEMP DEBUG (原因調査中、確認後に削除する): 本当に新しいコードが
  // 実行されているか一切の曖昧さなく確認するためのマーカー。
  res.status(299).json({ marker: "TOTALLY_NEW_CODE_V5", method: req.method });
  return;
};

async function _unused_original_handler(req, res) {
  console.log("[handler debug] entered. method=", req.method);
  res.setHeader("x-debug-handler-reached", "1");
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    // TEMP DEBUG (原因調査中、確認後に削除する)
    res.status(400).json({ error: "invalid json", debugMessage: e && e.message, debugRaw: e && e.debugRaw });
    return;
  }
  const created = participants.createSession(body);
  await store.saveSession(created.sid, created.session);
  res.status(200).json({ sessionId: created.sid, selfId: created.selfId });
};
