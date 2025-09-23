const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ProxyFetcher {
    constructor() {
        this.proxiesFile = path.join(process.cwd(), 'data', 'proxies.json');
        this.lastRefresh = 0;
    }

    async fetchProxies() {
        try {
            console.log('🌐 Fetching fresh proxies from fineproxy.org...');
            
            // Your proxy fetching logic here
            // This is a simplified version - add your actual implementation
            
            const mockProxies = [
                { ip: '116.80.61.94', port: '3172', country: 'ID', protocol: 'http' },
                { ip: '43.224.118.206', port: '8989', country: 'ID', protocol: 'http' }
            ];
            
            console.log(`✅ Fetched ${mockProxies.length} fresh proxies`);
            return this.formatProxies(mockProxies);

        } catch (error) {
            console.error('❌ Error fetching proxies:', error.message);
            return this.loadCachedProxies();
        }
    }

    formatProxies(proxyData) {
        return proxyData.map(proxy => ({
            ip: proxy.ip,
            port: proxy.port,
            url: `http://${proxy.ip}:${proxy.port}`,
            country: proxy.country,
            protocol: proxy.protocol,
            source: 'fineproxy',
            timestamp: Date.now()
        }));
    }

    loadCachedProxies() {
        try {
            if (fs.existsSync(this.proxiesFile)) {
                const cached = JSON.parse(fs.readFileSync(this.proxiesFile, 'utf8'));
                console.log(`📂 Loaded ${cached.length} cached proxies`);
                return cached;
            }
        } catch (error) {
            console.error('Error loading cached proxies:', error.message);
        }
        return [];
    }

    async saveProxies(proxies) {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.proxiesFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            fs.writeFileSync(this.proxiesFile, JSON.stringify(proxies, null, 2));
            console.log('💾 Proxies saved to', this.proxiesFile);
        } catch (error) {
            console.error('Error saving proxies:', error.message);
        }
    }

    async getFreshProxies() {
        const freshProxies = await this.fetchProxies();
        if (freshProxies.length > 0) {
            await this.saveProxies(freshProxies);
            this.lastRefresh = Date.now();
            return freshProxies;
        }
        
        return this.loadCachedProxies();
    }

    getLastRefreshTime() {
        return this.lastRefresh > 0 ? new Date(this.lastRefresh).toISOString() : 'Never';
    }
}

module.exports = { ProxyFetcher };