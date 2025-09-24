// api/search.js
export default async function handler(req, res) {
  // Ensure the request method is GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract query parameters from the request
  const { url } = req.query;

  // Validate that the 'url' query parameter is provided
  if (!url) {
    return res.status(400).json({ error: 'URL query parameter is required' });
  }

  // ScrapingAnt API configuration
  const apiKey = process.env.SCRAPINGANT_API_KEY; // Store API key in environment variable
  const proxyType = 'residential';
  const proxyCountry = 'ID';
  const targetUrl = encodeURIComponent(url); // Encode the target URL
  const scrapingAntUrl = `https://api.scrapingant.com/v2/general?url=${targetUrl}&x-api-key=${apiKey}&proxy_type=${proxyType}&proxy_country=${proxyCountry}`;

  try {
    // Make the request to ScrapingAnt API
    const response = await fetch(scrapingAntUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`ScrapingAnt API responded with status: ${response.status}`);
    }

    // Parse the response data
    const data = await response.json();

    // Return the ScrapingAnt API response to the client
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching from ScrapingAnt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}