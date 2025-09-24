// api/search.js
import cheerio from 'cheerio';

export default async function handler(req, res) {
  // Ensure the request method is GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract query parameters from the request
  let { url } = req.query;

  // Default to the batu bara search URL if not provided
  if (!url) {
    url = 'https://sumut.kemenag.go.id/beranda/list-pencarian?cari=batu+bara';
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  // ScrapingAnt API configuration
  const apiKey = process.env.SCRAPINGANT_API_KEY; // Store API key in environment variable
  const proxyType = 'residential';
  const proxyCountry = 'ID';
  const targetUrl = encodeURIComponent(url);
  const scrapingAntUrl = `https://api.scrapingant.com/v2/general?url=${targetUrl}&x-api-key=${apiKey}&proxy_type=${proxyType}&proxy_country=${proxyCountry}&output=raw_html`;

  try {
    // Make the request to ScrapingAnt API for raw HTML
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

    // Parse the response data (ScrapingAnt returns HTML in the response body for raw_html)
    const apiResponse = await response.text(); // Use .text() for raw HTML
    const $ = cheerio.load(apiResponse);

    // Extract all grid-post-item elements
    const posts = [];
    $('.grid-post-item').each((index, element) => {
      const $item = $(element);

      // Title and link
      const $titleLink = $item.find('h1 a');
      const title = $titleLink.text().trim();
      const relativeHref = $titleLink.attr('href');
      const fullUrl = relativeHref ? new URL(relativeHref, 'https://sumut.kemenag.go.id').href : null;

      // Image URL
      const imageUrl = $item.find('.bg').attr('data-bg') || null;

      // Category
      const category = $item.find('.post-category-marker').text().trim() || null;

      // Date (strip icon text)
      let date = $item.find('.post-date').text().trim();
      date = date.replace(/\s*far fa-clock\s*/i, '').trim(); // Remove icon class text if present

      // Excerpt
      const excerpt = $item.find('p').first().text().trim() || null;

      // Views (strip icon text)
      let views = $item.find('li i.fal.fa-eye').parent().text().trim();
      views = views.replace(/\s*fal fa-eye\s*/i, '').trim() || null;

      posts.push({
        title,
        url: fullUrl,
        image_url: imageUrl,
        category,
        date,
        excerpt,
        views,
      });
    });

    // Extract pagination links (adjust selector based on actual HTML, e.g., '.pagination a')
    const pagination = [];
    $('.pagination a, .pager a').each((index, element) => { // Common classes; customize if needed
      const pagLink = $(element).attr('href');
      if (pagLink) {
        const fullPagUrl = new URL(pagLink, 'https://sumut.kemenag.go.id').href;
        if (!pagination.includes(fullPagUrl)) {
          pagination.push(fullPagUrl);
        }
      }
    });

    // Return structured data
    res.status(200).json({
      posts,
      pagination,
      total_posts: posts.length,
      scraped_url: url,
    });
  } catch (error) {
    console.error('Error scraping:', error);
    res.status(500).json({ error: 'Failed to scrape page', details: error.message });
  }
}