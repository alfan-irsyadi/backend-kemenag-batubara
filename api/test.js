const scraper = require('../lib/scraper');
const { ProxyFetcher } = require('../lib/proxy-fetcher');

async function testProxies() {
    console.log('🧪 Testing Indonesian Proxies\n');
    
    const testResults = {
        total: 0,
        alive: 0,
        dead: 0,
        working: 0,
        successfulProxy: null,
        stats: null
    };

    try {
        // Load proxies through the scraper
        await scraper.loadProxies(false); // Use cached proxies
        testResults.total = scraper.proxies ? scraper.proxies.length : 0;

        console.log(`📊 Total proxies available: ${testResults.total}`);

        if (testResults.total === 0) {
            return {
                ...testResults,
                error: 'No proxies available for testing'
            };
        }

        // Test first 5 proxies - STOP ON FIRST SUCCESS
        const testBatch = scraper.proxies.slice(0, 5);
        
        for (const proxy of testBatch) {
            console.log(`\nTesting ${proxy.ip}:${proxy.port}...`);
            
            const isAlive = await scraper.testProxy(proxy);
            if (isAlive) {
                testResults.alive++;
                
                // Test with target website - STOP ON FIRST SUCCESS
                console.log(`Testing with target website...`);
                const result = await scraper.scrapeWithProxy('https://sumut.kemenag.go.id', proxy);
                
                if (result) {
                    testResults.working++;
                    testResults.successfulProxy = {
                        ip: proxy.ip,
                        port: proxy.port,
                        url: proxy.url
                    };
                    console.log('✅ Proxy works with target website!');
                    break; // STOP HERE - don't test other proxies
                } else {
                    console.log('❌ Proxy connected but failed to fetch target website');
                }
            } else {
                testResults.dead++;
            }
            
            await scraper.delay(1000);
        }

        testResults.stats = scraper.getStats();

    } catch (error) {
        console.error('Test error:', error);
        testResults.error = error.message;
    }

    return testResults;
}

// API handler
module.exports = async function handler(request, response) {
    // Set CORS headers
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { action = 'proxies' } = request.query;

    try {
        let result;

        switch (action) {
            case 'proxies':
                result = await testProxies();
                break;

            case 'direct':
                // Test direct connection without proxies
                console.log('🧪 Testing direct connection...');
                const directResult = await scraper.scrapeWithProxy('https://sumut.kemenag.go.id', null);
                
                result = {
                    success: !!directResult,
                    method: 'direct',
                    status: directResult ? 'SUCCESS' : 'FAILED',
                    contentLength: directResult ? directResult.length : 0,
                    timestamp: new Date().toISOString()
                };
                break;

            case 'search':
                // Test search functionality
                console.log('🧪 Testing search functionality...');
                const searchResult = await scraper.searchWithProxies('test', 2, false);
                
                result = {
                    success: true,
                    method: 'search',
                    keyword: 'test',
                    results: searchResult.total,
                    proxyUsed: searchResult.proxyUsed,
                    processingTime: searchResult.processingTime,
                    dataSample: searchResult.data.slice(0, 2) // First 2 results only
                };
                break;

            default:
                return response.status(400).json({
                    success: false,
                    error: 'Invalid action',
                    validActions: ['proxies', 'direct', 'search']
                });
        }

        response.status(200).json({
            success: true,
            action: action,
            timestamp: new Date().toISOString(),
            ...result
        });

    } catch (error) {
        console.error('Test API error:', error);
        
        response.status(500).json({
            success: false,
            error: error.message,
            action: action,
            timestamp: new Date().toISOString()
        });
    }
};

// Export for local testing
module.exports.testProxies = testProxies;