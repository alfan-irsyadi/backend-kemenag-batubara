// api/search.js (updated to load from data/news.json if ScrapingAnt fails)
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const allowedOrigins = [
  "https://kemenag-batubara.vercel.app",
  "http://localhost:5173",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Set CORS headers
  const origin = req.headers.origin || "https://kemenag-batubara.vercel.app";
  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Extract query parameters
  let { url, keyword } = req.query;

  // Use keyword if provided, else fall back to url or default
  if (keyword) {
    url = `https://sumut.kemenag.go.id/beranda/list-pencarian?cari=${encodeURIComponent(keyword)}`;
  } else if (!url) {
    url = "https://sumut.kemenag.go.id/beranda/list-pencarian?cari=batu+bara";
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL provided" });
  }

  const apiKey = process.env.SCRAPINGANT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ScrapingAnt API key is missing" });
  }
  const proxyType = "residential";
  const proxyCountry = "ID";
  const targetUrl = encodeURIComponent(url);
  const scrapingAntUrl = `https://api.scrapingant.com/v2/general?url=${targetUrl}&x-api-key=${apiKey}&proxy_type=${proxyType}&proxy_country=${proxyCountry}&output=raw_html`;

  try {
    const response = await fetch(scrapingAntUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" },
    });

    if (!response.ok) {
      throw new Error(`ScrapingAnt API responded with status: ${response.status}`);
    }

    const apiResponse = await response.text();
    if (!apiResponse) {
      throw new Error("Empty response body from ScrapingAnt");
    }

    console.log(`Received HTML length: ${apiResponse.length} characters`);

    if (!cheerio || !cheerio.load) {
      throw new Error("Cheerio module failed to load");
    }

    const $ = cheerio.load(apiResponse);
    const posts = [];
    $(".grid-post-item").each((index, element) => {
      const $item = $(element);
      const $titleLink = $item.find("h1 a");
      const title = $titleLink.text().trim();
      const relativeHref = $titleLink.attr("href");
      const fullUrl = relativeHref ? new URL(relativeHref, "https://sumut.kemenag.go.id").href : null;
      const imageUrl = $item.find(".bg").attr("data-bg") || null;
      const category = $item.find(".post-category-marker").text().trim() || null;
      let date = $item.find(".post-date").text().trim();
      date = date.replace(/\s*far fa-clock\s*/i, "").trim();
      const excerpt = $item.find("p").first().text().trim() || null;
      let views = $item.find("li i.fal.fa-eye").parent().text().trim();
      views = views.replace(/\s*fal fa-eye\s*/i, "").trim() || null;

      posts.push({
        title,
        url: fullUrl,
        image_url: imageUrl,
        image: imageUrl, // For frontend compatibility
        category,
        date,
        excerpt,
        views,
      });
    });

    const pagination = [];
    $(".pagination a, .pager a").each((index, element) => {
      const pagLink = $(element).attr("href");
      if (pagLink) {
        const fullPagUrl = new URL(pagLink, "https://sumut.kemenag.go.id").href;
        if (!pagination.includes(fullPagUrl)) {
          pagination.push(fullPagUrl);
        }
      }
    });

    res.status(200).json({
      posts,
      pagination,
      total_posts: posts.length,
      scraped_url: url,
    });
  } catch (error) {
    console.error("Error scraping with ScrapingAnt:", error);
    // Load backup from data/news.json
    try {
      const filePath = path.join(process.cwd(), 'data', 'news.json');
      if (fs.existsSync(filePath)) {
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        res.status(200).json(backupData);
      } else {
        res.status(500).json({ error: "Failed to scrape page and no backup available", details: error.message });
      }
    } catch (backupError) {
      res.status(500).json({ error: "Failed to load backup", details: backupError.message });
    }
  }
};