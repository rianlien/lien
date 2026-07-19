// Vercelデプロイ用の永続化。@vercel/kvは非推奨（2024年12月にUpstash Redisへ統合された）ため、
// 後継の@upstash/redisを直接使う。Vercelのダッシュボードで「Upstash」インテグレーションを
// プロジェクトに接続すると、Redis.fromEnv()が読む環境変数（KV_REST_API_URL / KV_REST_API_TOKEN、
// もしくはUPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN）が自動的に設定される。
"use strict";

const { Redis } = require("@upstash/redis");

const redis = Redis.fromEnv();

async function loadSession(sid) {
  const session = await redis.get("session:" + sid);
  return session || null;
}

async function saveSession(sid, session) {
  await redis.set("session:" + sid, session);
}

// 完成版アートはセッション本体と別キーに保存する（既存の3秒間隔ポーリングがセッション本体を
// 読むたびに巨大なbase64を運ぶことになるのを避けるため。session_completion internal-design参照）。
// ライフサイクルはセッションと同一（セッションが消えるときはこのキーも一緒に消す）。
async function loadArtwork(sid) {
  const value = await redis.get("session:" + sid + ":artwork");
  if (!value) return null;
  return Buffer.from(value, "base64");
}

async function saveArtwork(sid, buffer) {
  await redis.set("session:" + sid + ":artwork", buffer.toString("base64"));
}

module.exports = {
  loadSession: loadSession,
  saveSession: saveSession,
  loadArtwork: loadArtwork,
  saveArtwork: saveArtwork
};
