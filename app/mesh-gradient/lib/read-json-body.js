// Vercel Node.js runtimeの`req.body`自動パースヘルパーは本番でのみ失敗するケースがあり
// （getterへのアクセス時に例外を投げ、ハンドラーに到達する前に400 "invalid json"が返る）、
// api/*.jsからは`req.body`に一切触れず、常にこの関数でstreamを直接読んでパースする。
"use strict";

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    // TEMP DEBUG (原因調査中、確認後に削除する): req.bodyには触れない
    // （getterアクセス自体が例外の原因になりうるため、意図的に除外する）。
    console.log("[readJsonBody debug] headers=", JSON.stringify(req.headers));
    console.log("[readJsonBody debug] readableEnded=", req.readableEnded, "complete=", req.complete);

    var chunks = [];
    req.on("data", function (c) {
      console.log("[readJsonBody debug] data chunk len=", c.length);
      chunks.push(c);
    });
    req.on("end", function () {
      var raw = chunks.length === 0 ? "" : Buffer.concat(chunks).toString("utf8");
      console.log("[readJsonBody debug] end. chunks=", chunks.length, "raw=", JSON.stringify(raw));
      if (chunks.length === 0) { resolve({}); return; }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        e.debugRaw = raw;
        reject(e);
      }
    });
    req.on("error", function (e) {
      console.log("[readJsonBody debug] error event=", e && e.message);
      reject(e);
    });
  });
}

module.exports = { readJsonBody: readJsonBody };
