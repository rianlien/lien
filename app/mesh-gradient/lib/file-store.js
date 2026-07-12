// ローカル開発用の永続化（personal-scale前提のシンプルなJSONファイルストア）。
// セッションごとに1ファイルにしてあるのは、Vercel上のKVストア（lib/kv-store.js）と
// 同じ「1セッション単位でload/save」というインタフェースに揃えるため。
"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data", "sessions");

function loadSession(sid) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, sid + ".json"), "utf8"));
  } catch (e) {
    return null;
  }
}

function saveSession(sid, session) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, sid + ".json"), JSON.stringify(session, null, 2));
}

module.exports = { loadSession: loadSession, saveSession: saveSession };
