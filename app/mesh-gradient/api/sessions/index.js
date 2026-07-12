const participants = require("../../lib/participants");
const store = require("../../lib/kv-store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const body = req.body || {};
  const created = participants.createSession(body);
  await store.saveSession(created.sid, created.session);
  res.status(200).json({ sessionId: created.sid, selfId: created.selfId });
};
