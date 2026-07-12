const participants = require("../../../lib/participants");
const store = require("../../../lib/kv-store");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const sid = req.query.sid;
  const session = await store.loadSession(sid);
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  res.status(200).json({ sessionId: sid, participants: participants.listParticipants(session) });
};
