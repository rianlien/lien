const participants = require("../../../lib/participants");
const store = require("../../../lib/kv-store");

async function handler(req, res) {
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
  const body = req.body || {};
  const prep = participants.prepareCompletion(session, body.artwork);
  if (prep.status !== 200) {
    res.status(prep.status).json(prep.body);
    return;
  }
  await store.saveArtwork(sid, prep.buffer);
  participants.markCompleted(session);
  await store.saveSession(sid, session);
  res.status(200).json({ completedAt: session.completedAt });
}

module.exports = handler;
