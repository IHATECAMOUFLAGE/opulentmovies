import http from "http";
import https from "https";
import { URL } from "url";

export const config = { api: { bodyParser: false } };

function sanitizeHeaders(headers) {
  const banned = [
    "connection", "upgrade", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade-insecure-requests",
    "x-frame-options", "content-security-policy"
  ];
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (!banned.includes(k.toLowerCase())) {
      h[k] = v;
    }
  }
  return h;
}

function checkAuth(req) {
  const apiKey = process.env.PROXY_API_KEY || "";
  const provided = req.headers["x-proxy-key"] || "";
  if (!apiKey) return true;
  return provided === apiKey;
}

export default async function handler(req, res) {
  try {
    if (!checkAuth(req)) {
      res.writeHead(401, { "content-type": "text/plain" });
      res.end("Unauthorized");
      return;
    }

    let incomingPath = (req.url || "").replace(/^\/api\/proxy\/?/, "");
    if (!incomingPath) incomingPath = "/";

    let upstreamUrl;
    try {
      upstreamUrl = new URL(incomingPath);
    } catch {
      const UPSTREAM_BASE = process.env.UPSTREAM_BASE || "https://example.com";
      upstreamUrl = new URL(incomingPath, UPSTREAM_BASE);
    }

    const isHttps = upstreamUrl.protocol === "https:";
    const client = isHttps ? https : http;
    const options = { method: req.method, headers: sanitizeHeaders(req.headers) };
    options.headers["host"] = upstreamUrl.host;

    const upstreamReq = client.request(upstreamUrl, options, (upstreamRes) => {
      const respHeaders = sanitizeHeaders(upstreamRes.headers);
      respHeaders["Access-Control-Allow-Origin"] = process.env.CORS_ORIGIN || "*";
      respHeaders["Access-Control-Allow-Methods"] = "GET,HEAD,OPTIONS";
      respHeaders["Access-Control-Allow-Headers"] = "Range,Content-Type,x-proxy-key";

      if ((respHeaders["content-type"] || "").includes("text/html")) {
        let html = "";
        upstreamRes.on("data", chunk => html += chunk.toString());
        upstreamRes.on("end", () => {
          // Strip scripts that redirect or break embedding
          html = html.replace(/<script[^>]*>.*?<\/script>/gs, "");
          res.writeHead(200, respHeaders);
          res.end(html);
        });
      } else {
        res.writeHead(upstreamRes.statusCode || 200, respHeaders);
        upstreamRes.pipe(res);
      }
    });

    upstreamReq.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
      res.end("Bad Gateway");
    });

    req.pipe(upstreamReq);
  } catch {
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal Server Error");
  }
}
