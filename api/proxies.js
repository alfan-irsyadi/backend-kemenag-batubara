const { ProxyFetcher } = require('../lib/proxy-fetcher');

module.exports = async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { action = 'status' } = request.query;

  try {
    const fetcher = new ProxyFetcher();

    switch (action) {
      case 'refresh':
        const proxies = await fetcher.getFreshProxies();
        response.status(200).json({
          success: true,
          action: 'refreshed',
          totalProxies: proxies.length,
          proxies: proxies.slice(0, 10)
        });
        break;

      case 'status':
        const cachedProxies = fetcher.loadCachedProxies();
        response.status(200).json({
          success: true,
          action: 'status',
          totalProxies: cachedProxies.length,
          lastRefresh: fetcher.getLastRefreshTime(),
          proxies: cachedProxies.slice(0, 5)
        });
        break;

      default:
        response.status(400).json({ 
          error: 'Invalid action', 
          validActions: ['status', 'refresh'] 
        });
    }

  } catch (error) {
    console.error('Proxies API error:', error);
    response.status(500).json({
      success: false,
      error: error.message
    });
  }
};