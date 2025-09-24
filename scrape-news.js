const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

async function scrapePage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Encoding': 'gzip, deflate',
      },
    });
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = response.data;
    const $ = cheerio.load(html);
    const posts = [];

    $(".grid-post-item").each((index, element) => {
      const $item = $(element);
      const $titleLink = $item.find("h1 a");
      const title = $titleLink.text().trim();
      const relativeHref = $titleLink.attr("href");
      const fullUrl = relativeHref ? new URL(relativeHref, "https://sumut.kemenag.go.id").href : null;
      const imageUrl = $item.find(".bg").attr("data-bg") || null;
      const category = $item.find(".post-category-marker").text().trim() || null;
      let date = $item.find(".post-date").text().trim();
      date = date.replace(/\s*far fa-clock\s*/i, "").trim();
      const excerpt = $item.find("p").first().text().trim() || null;
      let views = $item.find("li i.fal.fa-eye").parent().text().trim();
      views = views.replace(/\s*fal fa-eye\s*/i, "").trim() || null;

      posts.push({
        title,
        url: fullUrl,
        image_url: imageUrl,
        image: imageUrl,
        category,
        date,
        excerpt,
        views,
      });
    });

    const pagination = [];
    $(".pagination a, .pager a").each((index, element) => {
      const pagLink = $(element).attr("href");
      if (pagLink) {
        const fullPagUrl = new URL(pagLink, "https://sumut.kemenag.go.id").href;
        if (!pagination.includes(fullPagUrl) && !fullPagUrl.includes('page=1')) {
          pagination.push(fullPagUrl);
        }
      }
    });

    return { posts, pagination, total_posts: posts.length, scraped_url: url };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return { posts: [], pagination: [], total_posts: 0, scraped_url: url, error: error.message };
  }
}

async function fetchAllNews() {
  let baseUrl = "https://sumut.kemenag.go.id/beranda/list-pencarian?cari=batu+bara";
  let allPosts = [];
  let paginationLinks = [baseUrl];
  let seenUrls = new Set();

  while (paginationLinks.length > 0) {
    const url = paginationLinks.shift();
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    console.log(`Scraping: ${url}`);
    const { posts, pagination, error } = await scrapePage(url);
    if (error) {
      console.error(`Stopping due to error at ${url}`);
      break;
    }

    allPosts.push(...posts);
    paginationLinks.push(...pagination.filter(link => !seenUrls.has(link)));

    // Respect crawl delay (1 second)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Sort posts by date in descending order
  allPosts.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA; // Newest first
  });

  // Create data/ directory if it doesn't exist
  const dataDir = path.join(__dirname, '..', 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    console.error(`Error creating data directory: ${error.message}`);
  }

  // Save to data/news.json
  const output = {
    posts: allPosts,
    pagination: [],
    total_posts: allPosts.length,
    scraped_url: baseUrl,
  };

  const filePath = path.join(dataDir, 'news.json');
  try {
    await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Saved ${allPosts.length} posts to ${filePath}`);
  } catch (error) {
    console.error(`Error saving to ${filePath}: ${error.message}`);
  }
}

fetchAllNews().catch(error => console.error('Error in fetchAllNews:', error));