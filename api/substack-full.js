module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ error: "Invalid slug" });
  }

  const authCookie = process.env.SUBSTACK_AUTH_COOKIE;
  if (!authCookie) {
    return res.status(500).json({
      error: "Missing SUBSTACK_AUTH_COOKIE",
      detail: "Configure SUBSTACK_AUTH_COOKIE in Vercel environment variables.",
    });
  }

  const articleUrl = `https://www.whitepaper.mx/p/${encodeURIComponent(slug)}?r=8kmud2`;
  const upstream = await fetch(articleUrl, {
    headers: {
      Cookie: authCookie,
      "User-Agent": "Mozilla/5.0 (compatible; WhitepaperLandingBot/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!upstream.ok) {
    return res.status(502).json({
      error: "Failed fetching Substack post",
      status: upstream.status,
    });
  }

  const html = await upstream.text();
  const bodyMatch = html.match(/"body_html":"((?:\\.|[^"\\])*)"/);
  if (!bodyMatch) {
    return res.status(502).json({ error: "Could not parse Substack body_html" });
  }

  const titleMatch =
    html.match(/property="og:title" content="([^"]+)"/) ||
    html.match(/name="twitter:title" content="([^"]+)"/);

  const decodeEscaped = (value) => JSON.parse(`"${value.replace(/"/g, '\\"')}"`);

  const bodyHtml = decodeEscaped(bodyMatch[1]).replace(/<script[\s\S]*?<\/script>/gi, "");
  const title = titleMatch ? titleMatch[1] : "Whitepaper, hoy";

  if (bodyHtml.length < 400) {
    return res.status(424).json({
      error: "Substack returned preview only",
      detail: "Authenticated access did not return full body_html for this post.",
    });
  }

  return res.status(200).json({ title, bodyHtml, slug, sourceUrl: articleUrl });
};
