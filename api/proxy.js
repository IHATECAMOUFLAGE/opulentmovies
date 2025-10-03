import axios from "axios";

export const config = { api: { bodyParser: false } };

function checkAuth(req) {
  const apiKey = process.env.PROXY_API_KEY || "";
  const provided = req.headers["x-proxy-key"] || "";
  if (!apiKey) return true;
  return provided === apiKey;
}

export default async function handler(req, res) {
  try {
    if (!checkAuth(req)) {
      res.status(401).send("Unauthorized");
      return;
    }

    let urlPath = (req.url || "").replace(/^\/api\/proxy\/?/, "");
    if (!urlPath) urlPath = "/";

    let targetUrl;
    try {
      targetUrl = new URL(urlPath);
    } catch {
      const UPSTREAM_BASE = process.env.UPSTREAM_BASE || "https://example.com";
      targetUrl = new URL(urlPath, UPSTREAM_BASE);
    }

    const axiosOptions = {
      method: req.method,
      url: targetUrl.href,
      responseType: "arraybuffer",
      maxRedirects: 0,
      headers: { ...req.headers, host: targetUrl.host },
      validateStatus: (status) => true,
    };

    const upstreamRes = await axios(axiosOptions);

    let headers = { ...upstreamRes.headers };
    delete headers["x-frame-options"];
    delete headers["content-security-policy"];
    delete headers["location"];

    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "GET,HEAD,OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Range,Content-Type,x-proxy-key";

    const contentType = headers["content-type"] || "";

    if (contentType.includes("text/html")) {
      let html = upstreamRes.data.toString("utf8");
      html = html.replace(/<script[^>]*>.*?<\/script>/gs, "");
      res.writeHead(200, headers);
      res.end(html);
    } else {
      res.writeHead(upstreamRes.status, headers);
      res.end(upstreamRes.data);
    }
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
}
