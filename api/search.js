// api/search.js
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const UserAgent = require('user-agents');
const cheerio = require('cheerio');

class KemenagScraper {
    constructor() {
        this.userAgent = new UserAgent();
        this.proxies = require('../data/proxy.json');
    }

    getRandomUserAgent() {
        return this.userAgent.random().toString();
    }

    createAxiosInstance(proxy = null) {
        const headers = {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };

        const config = {
            headers: headers,
            timeout: 15000,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        };

        if (proxy) {
            const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
            const proxyAgent = new HttpsProxyAgent(proxyUrl);
            config.httpsAgent = proxyAgent;
            config.httpAgent = new HttpProxyAgent(proxyUrl);
        }

        return axios.create(config);
    }

    async testProxy(proxy) {
        try {
            const instance = this.createAxiosInstance(proxy);
            const response = await instance.get('https://httpbin.org/ip', { timeout: 10000 });
            
            if (response.status === 200) {
                console.log(`✅ Proxy alive: ${proxy.ip}:${proxy.port}`);
                return true;
            }
        } catch (error) {
            console.log(`❌ Proxy dead: ${proxy.ip}:${proxy.port} - ${error.message}`);
        }
        return false;
    }

    async scrapeWithProxy(targetUrl, proxy, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔍 Attempt ${attempt} with proxy: ${proxy.ip}:${proxy.port}`);
                
                const instance = this.createAxiosInstance(proxy);
                const response = await instance.get(targetUrl);

                console.log(`📊 Status: ${response.status}`);
                console.log(`📏 Content length: ${response.data ? response.data.length : 0}`);

                if (response.status === 200 && response.data) {
                    if (this.isBlocked(response.data)) {
                        console.log('❌ Blocked by anti-bot protection');
                        return null;
                    }

                    if (response.data.length > 1000) {
                        console.log('✅ Success! Got valid content');
                        return {
                            content: response.data,
                            proxy: proxy,
                            status: response.status,
                            length: response.data.length
                        };
                    } else {
                        console.log('⚠️ Suspiciously short content');
                    }
                } else {
                    console.log(`❌ HTTP ${response.status}`);
                }

            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
                
                if (attempt === maxRetries) {
                    return null;
                }
                
                await this.delay(2000);
            }
        }
        return null;
    }

    isBlocked(content) {
        const blockIndicators = [
            'User Validation',
            'anti-bot',
            'captcha',
            'cloudflare',
            'access denied',
            'security check'
        ];

        const contentLower = content.toLowerCase();
        return blockIndicators.some(indicator => 
            contentLower.includes(indicator.toLowerCase())
        );
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async scrapeSearchResults(keyword = "batu bara") {
        const targetUrl = `https://sumut.kemenag.go.id/beranda/list-pencarian?cari=${encodeURIComponent(keyword)}`;
        console.log(`🎯 Target URL: ${targetUrl}`);

        // Test proxies and use the first working one
        for (const proxy of this.proxies) {
            console.log(`\n🧪 Testing proxy: ${proxy.ip}:${proxy.port}`);
            
            const isAlive = await this.testProxy(proxy);
            if (isAlive) {
                const result = await this.scrapeWithProxy(targetUrl, proxy);
                if (result) {
                    console.log('✅ Found working proxy, stopping rotation');
                    return this.parseSearchResults(result.content);
                }
            }
            
            await this.delay(1000);
        }

        // Fallback to direct connection if no proxy works
        console.log('\n💥 All proxies failed. Trying direct connection...');
        try {
            const instance = this.createAxiosInstance();
            const response = await instance.get(targetUrl);
            
            if (response.status === 200 && !this.isBlocked(response.data)) {
                console.log('✅ Direct connection successful!');
                return this.parseSearchResults(response.data);
            }
        } catch (error) {
            console.log(`❌ Direct connection failed: ${error.message}`);
        }

        return { success: false, error: "All scraping attempts failed" };
    }

    parseSearchResults(html) {
        const $ = cheerio.load(html);
        const results = [];

        // Select all grid-post-item elements
        $('.grid-post-item').each((index, element) => {
            const $item = $(element);
            
            const title = $item.find('h1 a').text().trim();
            const link = $item.find('h1 a').attr('href');
            const image = $item.find('.bg').data('bg');
            const category = $item.find('.post-category-marker').text().trim();
            const date = $item.find('.post-date').text().replace('<i class="far fa-clock"></i>', '').trim();
            const excerpt = $item.find('p').text().trim();
            const views = $item.find('.fa-eye').parent().text().trim();

            // Construct full URL if relative
            const fullLink = link && link.startsWith('http') ? link : `https://sumut.kemenag.go.id${link}`;
            const fullImage = image && image.startsWith('http') ? image : `https://sumut.kemenag.go.id${image}`;

            if (title) {
                results.push({
                    title,
                    link: fullLink || '',
                    image: fullImage || '',
                    category: category || '',
                    date: date || '',
                    excerpt: excerpt || '',
                    views: parseInt(views) || 0,
                    index
                });
            }
        });

        return {
            success: true,
            count: results.length,
            keyword: 'batu bara',
            results: results,
            scrapedAt: new Date().toISOString()
        };
    }
}

// CORS configuration
const allowedOrigins = [
    "http://localhost:5173",
    "https://kemenag-batubara.vercel.app",
    "https://backend-kemenag-batubara.vercel.app"
];

// API Handler function
async function searchHandler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        try {
            const { keyword = "batu bara" } = req.query;
            
            console.log(`🔍 Starting search for: ${keyword}`);
            
            // PERBAIKAN: Gunakan new untuk instansiasi class
            const scraper = new KemenagScraper();
            const results = await scraper.scrapeSearchResults(keyword);

            res.status(200).json(results);
        } catch (error) {
            console.error('❌ Error:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                message: "Internal server error"
            });
        }
    } else {
        res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }
}

// Export handler function, bukan class
module.exports = searchHandler;