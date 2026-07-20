// ローカル開発用サーバー。ルーティング・HTTP周りだけを担当し、業務ロジック（lib/participants.js）と
// 永続化（lib/file-store.js）は、Vercelデプロイ用のapi/*.jsと共有している。
const http = require("http");
const fs = require("fs");
const path = require("path");

const participants = require("./lib/participants");
const store = require("./lib/file-store");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = 8743;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function serveStatic(req, res, reqPath) {
  const filePath = path.join(PUBLIC_DIR, reqPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function readJsonBody(req, cb) {
  var chunks = [];
  req.on("data", function (c) { chunks.push(c); });
  req.on("end", function () {
    if (chunks.length === 0) { cb(null, {}); return; }
    try {
      cb(null, JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (e) {
      cb(e);
    }
  });
}
function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

http.createServer(function (req, res) {
  const url = new URL(req.url, "http://localhost");
  const segs = url.pathname.split("/").filter(Boolean);

  // POST /api/sessions
  if (req.method === "POST" && segs.length === 2 && segs[0] === "api" && segs[1] === "sessions") {
    readJsonBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "invalid json" }); return; }
      var created = participants.createSession(body);
      store.saveSession(created.sid, created.session);
      sendJson(res, 200, { sessionId: created.sid, selfId: created.selfId });
    });
    return;
  }

  // POST /api/sessions/:sid/participants
  if (req.method === "POST" && segs.length === 4 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "participants") {
    var sidAdd = segs[2];
    readJsonBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "invalid json" }); return; }
      var sessionAdd = store.loadSession(sidAdd);
      if (!sessionAdd) { sendJson(res, 404, { error: "session not found" }); return; }
      var addResult = participants.addParticipant(sessionAdd, body);
      store.saveSession(sidAdd, sessionAdd);
      sendJson(res, addResult.status, addResult.body);
    });
    return;
  }

  // POST /api/sessions/:sid/complete
  if (req.method === "POST" && segs.length === 4 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "complete") {
    var sidComplete = segs[2];
    readJsonBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "invalid json" }); return; }
      var sessionComplete = store.loadSession(sidComplete);
      if (!sessionComplete) { sendJson(res, 404, { error: "session not found" }); return; }
      var completeResult = participants.completeSession(sessionComplete, body.dataUrl);
      store.saveSession(sidComplete, sessionComplete);
      sendJson(res, completeResult.status, completeResult.body);
    });
    return;
  }

  // GET /api/sessions/:sid
  if (req.method === "GET" && segs.length === 3 && segs[0] === "api" && segs[1] === "sessions") {
    var sidGet = segs[2];
    var sessionGet = store.loadSession(sidGet);
    if (!sessionGet) { sendJson(res, 404, { error: "session not found" }); return; }
    var summary = participants.serializeSessionForInitiator(sessionGet);
    sendJson(res, 200, { sessionId: sidGet, participants: summary.participants, completedAt: summary.completedAt, finalArtDataUrl: summary.finalArtDataUrl });
    return;
  }

  // GET /api/sessions/:sid/participants/:pid
  if (req.method === "GET" && segs.length === 5 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "participants") {
    var sidGetP = segs[2], pidGet = segs[4];
    var sessionGetP = store.loadSession(sidGetP);
    if (!sessionGetP) { sendJson(res, 404, { error: "session not found" }); return; }
    var out = participants.getForRespondent(sessionGetP, pidGet);
    if (!out) { sendJson(res, 404, { error: "participant not found" }); return; }
    sendJson(res, 200, out);
    return;
  }

  // PATCH /api/sessions/:sid/participants/:pid
  if (req.method === "PATCH" && segs.length === 5 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "participants") {
    var sidPatch = segs[2], pidPatch = segs[4];
    readJsonBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "invalid json" }); return; }
      var sessionPatch = store.loadSession(sidPatch);
      if (!sessionPatch) { sendJson(res, 404, { error: "session not found" }); return; }
      var result = participants.patchParticipant(sessionPatch, pidPatch, body);
      store.saveSession(sidPatch, sessionPatch);
      sendJson(res, result.status, result.body);
    });
    return;
  }

  // DELETE /api/sessions/:sid/participants/:pid
  if (req.method === "DELETE" && segs.length === 5 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "participants") {
    var sidDel = segs[2], pidDel = segs[4];
    var sessionDel = store.loadSession(sidDel);
    if (!sessionDel) { sendJson(res, 404, { error: "session not found" }); return; }
    var resultDel = participants.deleteParticipant(sessionDel, pidDel);
    store.saveSession(sidDel, sessionDel);
    sendJson(res, resultDel.status, resultDel.body);
    return;
  }

  // static files
  if (req.method === "GET") {
    serveStatic(req, res, url.pathname === "/" ? "/index.html" : url.pathname);
    return;
  }

  res.writeHead(404);
  res.end("not found");
}).listen(PORT, function () {
  console.log("listening on " + PORT);
});
