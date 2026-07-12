const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 8743;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

http.createServer(function (req, res) {
  const reqPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(ROOT, reqPath);
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
}).listen(PORT, function () {
  console.log("listening on " + PORT);
});
