import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

const allowedOrigins = [
    "http://localhost:5173",
    "https://kemenag-batubara.vercel.app",
    "https://backend-kemenag-batubara.vercel.app"
];

const corsMiddleware = cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            const isAllowed = allowedOrigins.some(allowedOrigin => 
                origin.endsWith(allowedOrigin.replace("https://", "").replace("http://", ""))
            );
            if (isAllowed) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
});

// Cache to store recent searches (in-memory, resets on cold start)
const searchCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
    // Apply CORS middleware
    await new Promise((resolve, reject) => {
        corsMiddleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const keyword = req.query.keyword;
        if (!keyword) {
            return res.status(400).json({ error: "Keyword parameter is required" });
        }

        // Check cache first
        const cacheKey = keyword.toLowerCase();
        const cached = searchCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('Returning cached results for:', keyword);
            return res.json(cached.data);
        }

        // Set timeout for the entire operation
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 8000); // 8 second timeout
        });

        const searchPromise = axios.get(
            `https://sumut.kemenag.go.id/beranda/list-pencarian?cari=${encodeURIComponent(keyword)}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
                    "Cache-Control": "no-cache",
                    "Accept-Encoding": "gzip, deflate, br"
                },
                timeout: 7000 // 7 second axios timeout
            }
        );

        const response = await Promise.race([searchPromise, timeoutPromise]);
        const $ = cheerio.load(response.data);
        const results = [];

        // More efficient selector targeting
        $(".grid-post-item").each((_, element) => {
            try {
                const $element = $(element);
                const title = $element.find("h1 a").text().trim();
                const url = $element.find("h1 a").attr("href");
                
                if (!title || !url) return;

                const date = $element.find(".post-date").text().trim();
                const excerpt = $element.find("p").text().trim().substring(0, 200); // Limit excerpt length
                const image = $element.find(".bg").data("bg");
                const category = $element.find(".post-category-marker").text().trim();
                const viewsText = $element.find(".fa-eye").parent().text().trim();

                results.push({
                    title,
                    url: url.startsWith('http') ? url : `https://sumut.kemenag.go.id${url}`,
                    date,
                    excerpt,
                    image,
                    category,
                    views: parseInt(viewsText.replace(/\D/g, '')) || 0,
                });
            } catch (error) {
                console.error('Error parsing element:', error);
                // Continue with next element
            }
        });

        // Cache the results
        searchCache.set(cacheKey, {
            data: results,
            timestamp: Date.now()
        });

        // Clean up old cache entries
        cleanupCache();

        res.json(results);

    } catch (error) {
        console.error("Error scraping data:", error.message);
        
        if (error.message === 'Request timeout' || error.code === 'ECONNABORTED') {
            res.status(408).json({ 
                error: "Request timeout",
                message: "Search took too long. Please try a different keyword or try again later."
            });
        } else if (error.response) {
            res.status(502).json({ 
                error: "Upstream server error",
                message: "The target website is not responding properly."
            });
        } else {
            res.status(500).json({ 
                error: "Failed to fetch data",
                message: "Please try again later."
            });
        }
    }
}

function cleanupCache() {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            searchCache.delete(key);
        }
    }
}