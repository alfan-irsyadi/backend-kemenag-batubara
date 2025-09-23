const { testProxies } = require('./api/test');

async function runTests() {
    console.log('🚀 Running local tests...\n');

    // Test proxies
    console.log('=== Testing Proxies ===');
    const proxyResults = await testProxies();
    console.log('Proxy Test Results:', JSON.stringify(proxyResults, null, 2));

    // Test direct connection
    console.log('\n=== Testing Direct Connection ===');
    const scraper = require('./lib/scraper');
    const directResult = await scraper.scrapeWithProxy('https://sumut.kemenag.go.id', null);
    console.log('Direct Test Result:', directResult ? 'SUCCESS' : 'FAILED');

    // Test search
    console.log('\n=== Testing Search ===');
    try {
        const searchResult = await scraper.searchWithProxies('pendidikan', 2, false);
        console.log('Search Test Result:', {
            success: true,
            results: searchResult.total,
            proxyUsed: searchResult.proxyUsed
        });
    } catch (error) {
        console.log('Search Test Result: FAILED -', error.message);
    }
}

runTests().catch(console.error);