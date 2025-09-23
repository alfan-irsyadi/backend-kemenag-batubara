const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { HttpProxyAgent } = require("http-proxy-agent");
const UserAgent = require("user-agents");
const { ProxyFetcher } = require("./proxy-fetcher.js");

class IndonesianScraper {
  constructor() {
    this.userAgent = new UserAgent();
    this.proxyFetcher = new ProxyFetcher();
    this.proxies = []; // Add this line to initialize proxies array
    this.cache = new Map();
    this.CACHE_TTL = 300000;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
    };
  }

  async loadProxies(useFresh = false) {
    if (useFresh) {
      console.log("🔄 Fetching fresh proxies...");
      this.proxies = await this.proxyFetcher.getFreshProxies(); // Store in this.proxies
    } else {
      this.proxies = this.proxyFetcher.loadCachedProxies(); // Store in this.proxies
    }

    console.log(`✅ Loaded ${this.proxies.length} proxies`);
    return this.proxies;
  }

  getRandomUserAgent() {
    return this.userAgent.random().toString();
  }

  createAxiosInstance(proxyUrl = null) {
    const headers = {
      "User-Agent": this.getRandomUserAgent(),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    const config = {
      headers: headers,
      timeout: 15000,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    };

    if (proxyUrl) {
      try {
        const proxyAgent = new HttpsProxyAgent(proxyUrl);
        config.httpsAgent = proxyAgent;
        config.httpAgent = new HttpProxyAgent(proxyUrl);
      } catch (error) {
        console.log(`❌ Invalid proxy URL: ${proxyUrl}`);
        return null;
      }
    }

    return axios.create(config);
  }

  async testProxy(proxy) {
    this.stats.totalRequests++;
    try {
      const instance = this.createAxiosInstance(proxy.url);
      if (!instance) return false;

      const response = await instance.get("https://httpbin.org/ip", {
        timeout: 10000,
      });

      if (response.status === 200) {
        this.stats.successfulRequests++;
        console.log(`✅ Proxy alive: ${proxy.ip}:${proxy.port}`);
        return true;
      }
    } catch (error) {
      this.stats.failedRequests++;
      console.log(
        `❌ Proxy dead: ${proxy.ip}:${proxy.port} - ${error.message}`
      );
    }
    return false;
  }

  async scrapeWithProxy(targetUrl, proxy) {
    this.stats.totalRequests++;
    try {
      console.log(`🔍 Trying proxy: ${proxy.ip}:${proxy.port}`);

      const instance = this.createAxiosInstance(proxy.url);
      if (!instance) return null;

      const response = await instance.get(targetUrl);

      console.log(`📊 Status: ${response.status}`);
      console.log(
        `📏 Content length: ${response.data ? response.data.length : 0}`
      );

      if (response.status === 200 && response.data) {
        if (this.isBlocked(response.data)) {
          this.stats.blockedRequests++;
          console.log("❌ Blocked by anti-bot protection");
          return null;
        }

        if (response.data.length > 1000) {
          this.stats.successfulRequests++;
          console.log("✅ Success! Got valid content");
          return {
            content: response.data,
            proxy: proxy,
            status: response.status,
            length: response.data.length,
          };
        } else {
          console.log("⚠️ Suspiciously short content");
        }
      } else {
        console.log(`❌ HTTP ${response.status}`);
      }
    } catch (error) {
      this.stats.failedRequests++;
      console.log(`❌ Error: ${error.message}`);
    }

    return null;
  }

  isBlocked(content) {
    const blockIndicators = [
      "User Validation",
      "anti-bot",
      "captcha",
      "cloudflare",
      "access denied",
      "security check",
    ];

    const contentLower = content.toLowerCase();
    return blockIndicators.some((indicator) =>
      contentLower.includes(indicator.toLowerCase())
    );
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async scrapeWithRotation(targetUrl, maxAttempts = 3) {
    console.log(`🎯 Target URL: ${targetUrl}`);

    if (!this.proxies || this.proxies.length === 0) {
      await this.loadProxies(false); // Use cached proxies by default
    }

    // Test proxies first (quick check)
    const testedProxies = [];
    const testBatch = this.proxies.slice(0, Math.min(10, this.proxies.length));

    for (const proxy of testBatch) {
      const isAlive = await this.testProxy(proxy);
      if (isAlive) {
        testedProxies.push(proxy);
      }
      if (testedProxies.length >= maxAttempts) break;
      await this.delay(300);
    }

    console.log(`📊 ${testedProxies.length} proxies are alive`);

    // Try scraping with alive proxies - STOP ON FIRST SUCCESS
    for (const proxy of testedProxies.slice(0, maxAttempts)) {
      const result = await this.scrapeWithProxy(targetUrl, proxy);

      if (result) {
        return result; // Stop on first success
      }

      await this.delay(1000);
    }

    console.log("💥 All proxy attempts failed. Trying direct connection...");

    // Fallback to direct connection
    try {
      const instance = this.createAxiosInstance();
      const response = await instance.get(targetUrl);

      if (response.status === 200 && !this.isBlocked(response.data)) {
        console.log("✅ Direct connection successful!");
        return {
          content: response.data,
          proxy: null,
          status: response.status,
          length: response.data.length,
        };
      }
    } catch (error) {
      console.log(`❌ Direct connection failed: ${error.message}`);
    }

    return null;
  }

  async searchWithProxies(keyword, maxProxies = 3, freshProxies = false) {
    const startTime = Date.now();
    const targetUrl = `https://sumut.kemenag.go.id/beranda/list-pencarian?cari=${encodeURIComponent(
      keyword
    )}`;

    console.log(`🔍 Searching for: "${keyword}"`);

    const result = await this.scrapeWithRotation(targetUrl, maxProxies);

    if (!result || !result.content) {
      throw new Error("All scraping attempts failed");
    }

    const parsedResults = this.parseSearchResults(result.content, keyword);
    const processingTime = Date.now() - startTime;

    return {
      data: parsedResults,
      total: parsedResults.length,
      proxyUsed: result.proxy
        ? `${result.proxy.ip}:${result.proxy.port}`
        : "direct",
      processingTime: `${processingTime}ms`,
      stats: this.stats,
    };
  }

  parseSearchResults(html, keyword) {
    const cheerio = require("cheerio");
    const $ = cheerio.load(html);
    const results = [];

    $(".grid-post-item").each((index, element) => {
      try {
        const $element = $(element);
        const $titleLink = $element.find("h1 a");

        const title = $titleLink.text().trim();
        const url = $titleLink.attr("href");

        if (!title || !url) return;

        const fullUrl = url.startsWith("http")
          ? url
          : `https://sumut.kemenag.go.id${url}`;

        const date = $element.find(".post-date").text().trim();
        const excerpt = $element
          .find("p")
          .first()
          .text()
          .trim()
          .substring(0, 200);

        let image =
          $element.find(".bg").attr("data-bg") ||
          $element.find(".bg").data("bg") ||
          $element.find("img").attr("src");

        if (image && !image.startsWith("http")) {
          image = `https://sumut.kemenag.go.id${image}`;
        }

        const category = $element.find(".post-category-marker").text().trim();
        const viewsText = $element.find(".fa-eye").parent().text().trim();
        const views = parseInt(viewsText.replace(/\D/g, "")) || 0;

        results.push({
          title,
          url: fullUrl,
          date,
          excerpt,
          image,
          category,
          views,
        });
      } catch (elementError) {
        console.error(`Error parsing element ${index}:`, elementError.message);
      }
    });

    return results;
  }

  getStats() {
    return this.stats;
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new IndonesianScraper();
