// test-local.js
const KemenagScraper = require('./api/search');

async function testScraper() {
    console.log('🧪 Testing Kemenag Scraper Locally\n');
    
    const scraper = new KemenagScraper();
    
    // Test dengan timeout lebih lama untuk proxy Indonesia
    console.log('1. Testing with longer timeout for Indonesian proxies...');
    
    const result = await scrapeWithRetry(scraper, "batu bara", 3);
    
    if (result.success) {
        console.log('✅ Search completed successfully!');
        console.log(`📊 Found ${result.count} results`);
        
        if (result.results.length > 0) {
            console.log('\n📝 First result:');
            console.log(`Title: ${result.results[0].title}`);
            console.log(`Date: ${result.results[0].date}`);
            console.log(`Category: ${result.results[0].category}`);
            console.log(`Excerpt: ${result.results[0].excerpt}`);
        }
    } else {
        console.log('❌ Search failed');
        console.log('Trying direct connection as fallback...');
        await testDirectConnection(scraper);
    }
}

async function scrapeWithRetry(scraper, keyword, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`\n🔄 Attempt ${attempt}/${maxRetries}`);
        
        try {
            const result = await scraper.scrapeSearchResults(keyword);
            if (result.success) {
                return result;
            }
        } catch (error) {
            console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        }
        
        if (attempt < maxRetries) {
            console.log('⏳ Waiting 3 seconds before retry...');
            await delay(3000);
        }
    }
    
    return { success: false, error: "All attempts failed" };
}

async function testDirectConnection(scraper) {
    console.log('\n🔗 Testing direct connection...');
    
    try {
        const instance = scraper.createAxiosInstance();
        const response = await instance.get('https://sumut.kemenag.go.id', { 
            timeout: 10000 
        });
        
        console.log(`✅ Direct connection status: ${response.status}`);
        console.log(`📏 Content length: ${response.data.length}`);
        
        // Test search dengan direct connection
        const searchUrl = `https://sumut.kemenag.go.id/beranda/list-pencarian?cari=batu+bara`;
        const searchResponse = await instance.get(searchUrl);
        
        if (searchResponse.status === 200) {
            const parsed = scraper.parseSearchResults(searchResponse.data);
            console.log(`🎯 Direct search found: ${parsed.results.length} results`);
            return parsed;
        }
        
    } catch (error) {
        console.log(`❌ Direct connection failed: ${error.message}`);
        
        // Cek jika error karena blocked oleh region
        if (error.message.includes('blocked') || error.message.includes('restricted')) {
            console.log('🚫 Website appears to be region-blocked');
            console.log('💡 Solution: Deploy to Indonesian server or use reliable Indonesian VPN');
        }
    }
    
    return null;
}

async function testProxiesIndividually(scraper) {
    console.log('\n🔍 Testing each proxy individually with longer timeout...');
    
    const workingProxies = [];
    
    for (const proxy of scraper.proxies) {
        console.log(`\nTesting ${proxy.ip}:${proxy.port}...`);
        
        try {
            // Test dengan timeout lebih lama
            const instance = scraper.createAxiosInstance(proxy);
            const response = await instance.get('https://httpbin.org/ip', { 
                timeout: 15000 
            });
            
            if (response.status === 200) {
                console.log(`✅ WORKING - ${proxy.ip}:${proxy.port}`);
                workingProxies.push(proxy);
                
                // Quick test dengan target website
                try {
                    const testResponse = await instance.get('https://sumut.kemenag.go.id', {
                        timeout: 10000
                    });
                    console.log(`   📊 Target site: ${testResponse.status}`);
                } catch (targetError) {
                    console.log(`   ❌ Target site: ${targetError.message}`);
                }
            }
        } catch (error) {
            console.log(`❌ FAILED - ${proxy.ip}:${proxy.port}: ${error.code || error.message}`);
        }
        
        await delay(1000);
    }
    
    console.log(`\n📊 Results: ${workingProxies.length}/${scraper.proxies.length} proxies working`);
    return workingProxies;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAllTests() {
    console.log('🚀 Starting Enhanced Kemenag Scraper Tests\n');
    
    try {
        const scraper = new KemenagScraper();
        
        // Test 1: Individual proxy testing
        const workingProxies = await testProxiesIndividually(scraper);
        
        if (workingProxies.length > 0) {
            console.log('\n🎯 Testing with working proxies...');
            // Test dengan proxy yang bekerja
            const result = await scrapeWithRetry(scraper, "batu bara");
            if (result.success) {
                console.log('✅ SUCCESS! Scraping working with proxies');
            }
        } else {
            console.log('\n💡 No working proxies found. Testing direct connection...');
            await testDirectConnection(scraper);
        }
        
    } catch (error) {
        console.error('\n💥 Test failed:', error);
    }
}

if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { testScraper, testProxiesIndividually, testDirectConnection };