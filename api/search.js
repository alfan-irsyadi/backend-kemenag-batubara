const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const allowedOrigins = [
  "http://localhost:5173",
  "https://kemenag-batubara.vercel.app",
  "https://backend-kemenag-batubara.vercel.app"
];

const corsMiddleware = cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
});

module.exports = async function handler(req, res) {
  return corsMiddleware(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let { url, keyword } = req.query;

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
          image: imageUrl,
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
  });
};