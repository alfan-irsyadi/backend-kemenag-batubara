const scraper = require('./scraper.js')

async function testLocal() {
  console.log('🧪 Testing scraper locally...');
  
  try {
    const result = await scraper.searchWithProxies('pendidikan', 3, false);
    console.log('✅ Success:', result);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLocal();