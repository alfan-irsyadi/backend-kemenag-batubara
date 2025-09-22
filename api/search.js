import axios from "axios";
import * as cheerio from "cheerio";

// Cache global untuk menyimpan hasil
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

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

        // Konfigurasi request yang lebih kompatibel
        const config = {
            method: 'GET',
            url: `https://sumut.kemenag.go.id/beranda/list-pencarian?cari=${encodeURIComponent(keyword)}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            },
            timeout: 10000, // 10 detik timeout
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 300;
            }
        };

        console.log('Fetching data for keyword:', keyword);
        
        const response = await axios(config);
        
        if (!response.data) {
            throw new Error('No data received from target website');
        }

        const $ = cheerio.load(response.data);
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
                const image = $element.find(".bg").attr("data-bg") || $element.find("img").attr("src");
                const category = $element.find(".post-category-marker").text().trim();
                const viewsText = $element.find(".fa-eye").parent().text().trim();
                const views = parseInt(viewsText.replace(/\D/g, '')) || 0;

                results.push({
                    title,
                    url: fullUrl,
                    date,
                    excerpt,
                    image: image && !image.startsWith('http') 
                        ? `https://sumut.kemenag.go.id${image}` 
                        : image,
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

        console.log(`Successfully scraped ${results.length} results for keyword: ${keyword}`);

        return res.status(200).json({
            success: true,
            data: results,
            total: results.length,
            keyword,
            cached: false,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('Scraping error:', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            keyword
        });

        // Error handling yang lebih spesifik
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return res.status(408).json({
                success: false,
                error: 'Request Timeout',
                message: 'Permintaan terlalu lama. Silakan coba lagi.',
                code: 'TIMEOUT'
            });
        }

        if (error.response) {
            const status = error.response.status;
            if (status === 403) {
                return res.status(403).json({
                    success: false,
                    error: 'Access Forbidden',
                    message: 'Akses ke website target diblokir.',
                    code: 'FORBIDDEN'
                });
            }
            if (status === 404) {
                return res.status(404).json({
                    success: false,
                    error: 'Not Found',
                    message: 'Halaman tidak ditemukan.',
                    code: 'NOT_FOUND'
                });
            }
        }

        if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            return res.status(502).json({
                success: false,
                error: 'Network Error',
                message: 'Tidak dapat terhubung ke website target.',
                code: 'NETWORK_ERROR'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Terjadi kesalahan saat memproses permintaan.',
            code: 'INTERNAL_ERROR'
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
}