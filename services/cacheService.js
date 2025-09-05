class CacheService {
    constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes default
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
    }

    set(key, value, ttl = this.defaultTTL) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, {
            value,
            expiresAt
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    // Clean up expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    // Generate cache key
    generateKey(prefix, ...params) {
        return `${prefix}:${params.join(':')}`;
    }
}

// Create singleton instance
const cacheService = new CacheService();

// Cleanup expired entries every 10 minutes
setInterval(() => {
    cacheService.cleanup();
}, 10 * 60 * 1000);

module.exports = cacheService;