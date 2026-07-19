const participants = require("../../../../../lib/participants");
const store = require("../../../../../lib/kv-store");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const sid = req.query.sid;
  const pid = req.query.pid;
  const session = await store.loadSession(sid);
  if (!session || !participants.canViewArtwork(session, pid)) {
    res.status(404).end();
    return;
  }
  const buffer = await store.loadArtwork(sid);
  if (!buffer) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "image/jpeg");
  if (req.query.download) {
    res.setHeader("Content-Disposition", "attachment; filename=\"mesh-gradient-" + sid + ".jpg\"");
  }
  res.status(200).send(buffer);
};
