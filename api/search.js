import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

export default async function handler(req, res) {
    try {
        const keyword = req.query.keyword;
        if (!keyword) {
            return res.status(400).json({ error: "Keyword parameter is required" });
        }
        const response = await axios.get(`https://sumut.kemenag.go.id/beranda/list-pencarian?cari=${encodeURIComponent(keyword)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(response.data);
        const results = [];
        $(".grid-post-item").each((_, element) => {
            const title = $(element).find("h1 a").text().trim();
            const url = $(element).find("h1 a").attr("href");
            const date = $(element).find(".post-date").text().trim();
            const excerpt = $(element).find("p").text().trim();
            const image = $(element).find(".bg").data("bg");
            const category = $(element).find(".post-category-marker").text().trim();
            const viewsText = $(element).find(".fa-eye").parent().text().trim();
            if (title && url) {
                results.push({
                    title,
                    url: `https://sumut.kemenag.go.id${url}`,
                    date,
                    excerpt,
                    image,
                    category,
                    views: parseInt(viewsText) || 0,
                });
            }
        });
        res.json(results);
    }
    catch (error) {
        console.error("Error scraping data:", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
}