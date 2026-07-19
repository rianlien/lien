const participants = require("../../../../lib/participants");
const store = require("../../../../lib/kv-store");
const { readJsonBody } = require("../../../../lib/read-json-body");

module.exports = async function handler(req, res) {
  const sid = req.query.sid;
  const pid = req.query.pid;
  const session = await store.loadSession(sid);
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }

  if (req.method === "GET") {
    const out = participants.getForRespondent(session, pid);
    if (!out) {
      res.status(404).json({ error: "participant not found" });
      return;
    }
    res.status(200).json(out);
    return;
  }

  if (req.method === "PATCH") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      res.status(400).json({ error: "invalid json" });
      return;
    }
    const result = participants.patchParticipant(session, pid, body);
    await store.saveSession(sid, session);
    res.status(result.status).json(result.body);
    return;
  }

  if (req.method === "DELETE") {
    const result = participants.deleteParticipant(session, pid);
    await store.saveSession(sid, session);
    res.status(result.status).json(result.body);
    return;
  }

  res.status(405).json({ error: "method not allowed" });
};
