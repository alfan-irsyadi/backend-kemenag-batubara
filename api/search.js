const scraper = require('../lib/scraper');

module.exports = async function handler(request, response) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { keyword, maxProxies = '3', freshProxies = 'false' } = request.query;

  if (!keyword) {
    return response.status(400).json({ 
      error: 'Keyword parameter is required',
      example: '/api/search?keyword=pendidikan'
    });
  }

  try {
    console.log(`🔍 Searching for: "${keyword}"`);
    
    const result = await scraper.searchWithProxies(
      keyword, 
      parseInt(maxProxies),
      freshProxies === 'true'
    );

    response.status(200).json({
      success: true,
      data: result.data,
      meta: {
        keyword,
        totalResults: result.total,
        proxyUsed: result.proxyUsed,
        processingTime: result.processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    
    response.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'INTERNAL_ERROR'
    });
  }
};