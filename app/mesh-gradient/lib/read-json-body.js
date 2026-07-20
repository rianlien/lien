// Vercel Node.js runtimeの`req.body`自動パースヘルパーは本番でのみ失敗するケースがあり
// （getterへのアクセス時に例外を投げ、ハンドラーに到達する前に400 "invalid json"が返る）、
// api/*.jsからは`req.body`に一切触れず、常にこの関数でstreamを直接読んでパースする。
"use strict";

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (c) { chunks.push(c); });
    req.on("end", function () {
      if (chunks.length === 0) { resolve({}); return; }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

module.exports = { readJsonBody: readJsonBody };
