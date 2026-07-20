const participants = require("../../lib/participants");
const store = require("../../lib/kv-store");
const { readJsonBody } = require("../../lib/read-json-body");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    res.status(400).json({ error: "invalid json" });
    return;
  }
  const created = participants.createSession(body);
  await store.saveSession(created.sid, created.session);
  res.status(200).json({ sessionId: created.sid, selfId: created.selfId });
};
