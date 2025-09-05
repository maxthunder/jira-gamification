class ClientCache {
    constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes default
        this.defaultTTL = defaultTTL;
    }

    set(key, value, ttl = this.defaultTTL) {
        const expiresAt = Date.now() + ttl;
        const item = {
            value,
            expiresAt,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    get(key) {
        try {
            const item = localStorage.getItem(key);
            if (!item) {
                return null;
            }

            const parsed = JSON.parse(item);
            if (Date.now() > parsed.expiresAt) {
                localStorage.removeItem(key);
                return null;
            }

            return parsed.value;
        } catch (error) {
            console.warn('Failed to retrieve cached data:', error);
            return null;
        }
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('Failed to delete cached data:', error);
        }
    }

    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.warn('Failed to clear cache:', error);
        }
    }

    // Clear expired entries
    cleanup() {
        const keys = Object.keys(localStorage);
        const now = Date.now();
        
        keys.forEach(key => {
            try {
                const item = localStorage.getItem(key);
                if (item) {
                    const parsed = JSON.parse(item);
                    if (parsed.expiresAt && now > parsed.expiresAt) {
                        localStorage.removeItem(key);
                    }
                }
            } catch (error) {
                // Invalid JSON, remove it
                localStorage.removeItem(key);
            }
        });
    }

    // Generate cache key
    generateKey(prefix, ...params) {
        return `cache:${prefix}:${params.join(':')}`;
    }

    // Get cache info
    getCacheInfo(key) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            
            const parsed = JSON.parse(item);
            return {
                exists: true,
                isExpired: Date.now() > parsed.expiresAt,
                age: Date.now() - parsed.timestamp,
                ttl: parsed.expiresAt - parsed.timestamp
            };
        } catch (error) {
            return null;
        }
    }
}

// Create global cache instance
window.clientCache = new ClientCache();

// Cleanup expired entries when the page loads
window.addEventListener('load', () => {
    window.clientCache.cleanup();
});

// Check for force reload (Ctrl+F5, Cmd+Shift+R)
window.addEventListener('beforeunload', (e) => {
    // This will be handled by the reload detection in the main scripts
});

// Detect hard reload and clear cache
(function() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation && navigation.type === 'reload') {
        // Check if it was a hard reload by looking at the cache control
        const now = Date.now();
        const lastReload = parseInt(localStorage.getItem('lastHardReload') || '0');
        
        // If reload happened within 1 second and cache was recently cleared, assume hard reload
        if (now - lastReload < 1000) {
            console.log('Hard reload detected, clearing cache');
            window.clientCache.clear();
        }
        
        localStorage.setItem('lastHardReload', now.toString());
    }
})();