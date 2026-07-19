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

// 完成版アートはセッション本体のJSONとは別ファイルに保存する（JSONに埋め込むとデバッグ時に画像
// ビューアで直接開けなくなる上、セッションの読み書きのたびに巨大な文字列を運ぶことになるため）。
// ライフサイクルはセッションと同一（session_completion internal-design参照）。
function artworkPath(sid) {
  return path.join(DATA_DIR, sid + ".artwork.jpg");
}

function loadArtwork(sid) {
  try {
    return fs.readFileSync(artworkPath(sid));
  } catch (e) {
    return null;
  }
}

function saveArtwork(sid, buffer) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(artworkPath(sid), buffer);
}

module.exports = {
  loadSession: loadSession,
  saveSession: saveSession,
  loadArtwork: loadArtwork,
  saveArtwork: saveArtwork
};
