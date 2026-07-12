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

module.exports = { loadSession: loadSession, saveSession: saveSession };
