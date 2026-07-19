const participants = require("../../../lib/participants");
const store = require("../../../lib/kv-store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const sid = req.query.sid;
  const session = await store.loadSession(sid);
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  const result = participants.completeSession(session, (req.body || {}).dataUrl);
  await store.saveSession(sid, session);
  res.status(result.status).json(result.body);
};
