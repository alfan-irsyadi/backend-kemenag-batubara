import axios from "axios";
import * as cheerio from "cheerio";

// Cache global untuk menyimpan hasil
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

// Daftar proxy services dengan fallback
const PROXY_SERVICES = [
    {
        name: 'allorigins',
        getUrl: (targetUrl) => `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        extractData: (response) => response.data.contents
    },
    {
        name: 'corsproxy',
        getUrl: (targetUrl) => `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        extractData: (response) => response.data
    },
    {
        name: 'thingproxy',
        getUrl: (targetUrl) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(targetUrl)}`,
        extractData: (response) => response.data
    },
    {
        name: 'direct',
        getUrl: (targetUrl) => targetUrl,
        extractData: (response) => response.data
    }
];

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { keyword } = req.query;
    
    if (!keyword) {
        return res.status(400).json({ error: "Keyword parameter is required" });
    }

    try {
        // Check cache
        const cacheKey = keyword.toLowerCase().trim();
        const cached = cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log('Cache hit for:', keyword);
            return res.status(200).json({
                success: true,
                data: cached.data,
                cached: true,
                timestamp: cached.timestamp
            });
        }

        const targetUrl = `https://sumut.kemenag.go.id/beranda/list-pencarian?cari=${encodeURIComponent(keyword)}`;
        let htmlData = null;
        let usedProxy = null;

        // Try each proxy service
        for (const proxy of PROXY_SERVICES) {
            try {
                console.log(`Trying ${proxy.name} proxy for keyword: ${keyword}`);
                
                const proxyUrl = proxy.getUrl(targetUrl);
                
                const config = {
                    method: 'GET',
                    url: proxyUrl,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache'
                    },
                    timeout: 8000, // 8 detik timeout per proxy
                    maxRedirects: 3,
                    validateStatus: function (status) {
                        return status >= 200 && status < 300;
                    }
                };

                const response = await axios(config);
                htmlData = proxy.extractData(response);
                usedProxy = proxy.name;
                
                if (htmlData && htmlData.length > 100) {
                    console.log(`Success with ${proxy.name} proxy`);
                    break;
                } else {
                    console.log(`${proxy.name} returned empty or invalid data`);
                    continue;
                }
                
            } catch (proxyError) {
                console.log(`${proxy.name} proxy failed:`, proxyError.message);
                continue;
            }
        }

        if (!htmlData) {
            throw new Error('All proxy services failed');
        }

        // Parse HTML dengan cheerio
        const $ = cheerio.load(htmlData);
        const results = [];

        // Scraping dengan error handling yang lebih baik
        $(".grid-post-item").each((index, element) => {
            try {
                const $element = $(element);
                const $titleLink = $element.find("h1 a");
                
                const title = $titleLink.text().trim();
                const url = $titleLink.attr("href");
                
                if (!title || !url) return;

                const fullUrl = url.startsWith('http') 
                    ? url 
                    : `https://sumut.kemenag.go.id${url}`;

                const date = $element.find(".post-date").text().trim();
                const excerpt = $element.find("p").first().text().trim().substring(0, 200);
                
                // Handle image URL
                let image = $element.find(".bg").attr("data-bg") || 
                           $element.find(".bg").data("bg") ||
                           $element.find("img").attr("src");
                
                if (image && !image.startsWith('http')) {
                    image = `https://sumut.kemenag.go.id${image}`;
                }

                const category = $element.find(".post-category-marker").text().trim();
                const viewsText = $element.find(".fa-eye").parent().text().trim();
                const views = parseInt(viewsText.replace(/\D/g, '')) || 0;

                results.push({
                    title,
                    url: fullUrl,
                    date,
                    excerpt,
                    image,
                    category,
                    views
                });
            } catch (elementError) {
                console.error(`Error parsing element ${index}:`, elementError.message);
            }
        });

        // Cache hasil
        cache.set(cacheKey, {
            data: results,
            timestamp: Date.now()
        });

        // Cleanup cache lama
        cleanupCache();

        console.log(`Successfully scraped ${results.length} results using ${usedProxy} proxy`);

        return res.status(200).json({
            success: true,
            data: results,
            total: results.length,
            keyword,
            proxy: usedProxy,
            cached: false,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('Scraping error:', {
            message: error.message,
            code: error.code,
            keyword
        });

        // Error handling yang lebih spesifik
        if (error.message === 'All proxy services failed') {
            return res.status(502).json({
                success: false,
                error: 'Proxy Services Unavailable',
                message: 'Semua layanan proxy tidak dapat diakses. Silakan coba lagi nanti.',
                code: 'PROXY_FAILED'
            });
        }

        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return res.status(408).json({
                success: false,
                error: 'Request Timeout',
                message: 'Permintaan terlalu lama. Silakan coba lagi.',
                code: 'TIMEOUT'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Terjadi kesalahan saat memproses permintaan.',
            code: 'INTERNAL_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

function cleanupCache() {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
    
    // Batasi ukuran cache maksimal 100 entries
    if (cache.size > 100) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
}