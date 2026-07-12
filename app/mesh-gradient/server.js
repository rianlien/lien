const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "sessions.json");
const PORT = 8743;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const DEFAULT_REACH = 0.38; // public/mesh-render.js の既定値と合わせてある

// ---- 永続化（personal-scale前提のシンプルなJSONファイルストア。同時書き込みの排他制御はしていない） ----
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}
function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}
function newId() {
  return crypto.randomBytes(6).toString("hex");
}

// ---- 静的ファイル配信 ----
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

// ---- 参加者の外部表現 ----
function serializeParticipant(p) {
  return { id: p.id, label: p.label, x: p.x, y: p.y, color: p.color, reach: p.reach, isSelf: !!p.isSelf, respondedAt: p.respondedAt || null };
}
function findSelf(session) {
  return Object.keys(session.participants)
    .map(function (k) { return session.participants[k]; })
    .filter(function (p) { return p.isSelf; })[0];
}
// 回答者ページ向け: 自分自身の情報＋発起人の色だけを追加する（発起人の位置・他の友達の情報は含めない）
function serializeForRespondent(session, p) {
  var self = findSelf(session);
  var out = serializeParticipant(p);
  out.initiatorColor = (self && self.color) || null;
  return out;
}

http.createServer(function (req, res) {
  const url = new URL(req.url, "http://localhost");
  const segs = url.pathname.split("/").filter(Boolean);

  // POST /api/sessions
  if (req.method === "POST" && segs.length === 2 && segs[0] === "api" && segs[1] === "sessions") {
    readJsonBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "invalid json" }); return; }
      var db = loadDb();
      var sid = newId();
      var selfId = newId();
      db[sid] = {
        id: sid,
        createdAt: new Date().toISOString(),
        participants: {}
      };
      db[sid].participants[selfId] = {
        id: selfId, label: body.label || "自分", x: body.x, y: body.y,
        color: null, reach: DEFAULT_REACH, isSelf: true, respondedAt: null
      };
      saveDb(db);
      sendJson(res, 200, { sessionId: sid, selfId: selfId });
    });
    return;
  }

  // POST /api/sessions/:sid/participants  → segs = ["api","sessions",":sid","participants"]
  if (req.method === "POST" && segs.length === 4 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "participants") {
    var sidAdd = segs[2];
    readJsonBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "invalid json" }); return; }
      var db = loadDb();
      var session = db[sidAdd];
      if (!session) { sendJson(res, 404, { error: "session not found" }); return; }
      var pid = newId();
      session.participants[pid] = {
        id: pid, label: body.label || "友達", x: body.x, y: body.y,
        color: null, reach: DEFAULT_REACH, isSelf: false, respondedAt: null
      };
      saveDb(db);
      sendJson(res, 200, { participantId: pid });
    });
    return;
  }

  // GET /api/sessions/:sid  → segs = ["api","sessions",":sid"]
  if (req.method === "GET" && segs.length === 3 && segs[0] === "api" && segs[1] === "sessions") {
    var sidGet = segs[2];
    var db1 = loadDb();
    var session1 = db1[sidGet];
    if (!session1) { sendJson(res, 404, { error: "session not found" }); return; }
    var participants = Object.keys(session1.participants).map(function (k) {
      return serializeParticipant(session1.participants[k]);
    });
    sendJson(res, 200, { sessionId: sidGet, participants: participants });
    return;
  }

  // GET /api/sessions/:sid/participants/:pid  → segs = ["api","sessions",":sid","participants",":pid"]
  if (req.method === "GET" && segs.length === 5 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "participants") {
    var sidGetP = segs[2], pidGet = segs[4];
    var db2 = loadDb();
    var session2 = db2[sidGetP];
    var p2 = session2 && session2.participants[pidGet];
    if (!p2) { sendJson(res, 404, { error: "participant not found" }); return; }
    sendJson(res, 200, serializeForRespondent(session2, p2));
    return;
  }

  // PATCH /api/sessions/:sid/participants/:pid  → segs = ["api","sessions",":sid","participants",":pid"]
  if (req.method === "PATCH" && segs.length === 5 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "participants") {
    var sidPatch = segs[2], pidPatch = segs[4];
    readJsonBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "invalid json" }); return; }
      var db3 = loadDb();
      var session3 = db3[sidPatch];
      var p3 = session3 && session3.participants[pidPatch];
      if (!p3) { sendJson(res, 404, { error: "participant not found" }); return; }
      // 明示的に確定（confirm）した参加者は、発起人自身も含めて色・影響範囲・位置のいずれも変更できない。
      // 「結果を見てから調整できてしまう」バイアスを防ぐための制約で、友達・発起人を区別しない。
      var locked = !!p3.respondedAt;
      var touchesLockedField = typeof body.reach === "number" || typeof body.color === "string"
        || typeof body.x === "number" || typeof body.y === "number";
      if (locked && touchesLockedField) {
        sendJson(res, 409, { error: "already responded", participant: serializeForRespondent(session3, p3) });
        return;
      }
      if (typeof body.x === "number") p3.x = body.x;
      if (typeof body.y === "number") p3.y = body.y;
      if (typeof body.label === "string") p3.label = body.label;
      if (typeof body.reach === "number") p3.reach = body.reach;
      if (typeof body.color === "string") p3.color = body.color;
      // confirmは色・影響範囲・位置を確定させる、明示的な1回限りの操作。色を設定しただけでは確定しない
      // （発起人は色を選んだ後も影響範囲を見て調整したり、色を選び直したりする自然な試行錯誤がありうるため）。
      // 友達（回答者）は「送信する」ボタンが { color, confirm: true } を1回で送るので体験は変わらない。
      if (body.confirm === true && !p3.respondedAt) {
        if (!p3.color) { sendJson(res, 400, { error: "color is required before confirm" }); return; }
        p3.respondedAt = new Date().toISOString();
      }
      saveDb(db3);
      sendJson(res, 200, serializeForRespondent(session3, p3));
    });
    return;
  }

  // DELETE /api/sessions/:sid/participants/:pid  → segs = ["api","sessions",":sid","participants",":pid"]
  if (req.method === "DELETE" && segs.length === 5 && segs[0] === "api" && segs[1] === "sessions" && segs[3] === "participants") {
    var sidDel = segs[2], pidDel = segs[4];
    var db4 = loadDb();
    var session4 = db4[sidDel];
    if (!session4 || !session4.participants[pidDel]) { sendJson(res, 404, { error: "participant not found" }); return; }
    if (session4.participants[pidDel].isSelf) { sendJson(res, 400, { error: "cannot remove self" }); return; }
    delete session4.participants[pidDel];
    saveDb(db4);
    sendJson(res, 200, { ok: true });
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
