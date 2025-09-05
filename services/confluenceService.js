const axios = require('axios');

class ConfluenceService {
    constructor() {
        this.baseURL = process.env.CONFLUENCE_BASE_URL;
        this.email = process.env.CONFLUENCE_EMAIL;
        this.apiToken = process.env.CONFLUENCE_API_TOKEN;
        
        if (!this.baseURL || !this.email || !this.apiToken) {
            console.warn('Confluence configuration is incomplete. Please check your .env file.');
        }
        
        // Create axios instance with auth
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            auth: {
                username: this.email,
                password: this.apiToken
            }
        });
    }

    async getUserContent(username) {
        try {
            let accountId = username;
            
            // If the username looks like an email or username, try to find the account ID
            if (!username.includes(':')) {
                try {
                    // For simplicity, use the current authenticated user since user search is not working
                    const currentUserResponse = await this.client.get('/rest/api/user/current');
                    accountId = currentUserResponse.data.accountId;
                } catch (error) {
                    console.warn('Could not get current user, trying with original username:', error.message);
                }
            }
            
            // Search for all pages and blog posts created by the user
            const response = await this.client.get('/rest/api/content/search', {
                params: {
                    cql: `creator = "${accountId}"`,
                    limit: 100,
                    expand: 'version,space,history.lastUpdated,ancestors'
                }
            });

            const content = response.data.results || [];
            
            // Separate pages and blog posts
            const pages = content.filter(item => item.type === 'page');
            const blogPosts = content.filter(item => item.type === 'blogpost');

            return {
                pages: this.formatContent(pages),
                blogPosts: this.formatContent(blogPosts),
                stats: this.calculateStats(content)
            };
        } catch (error) {
            console.error('Error fetching Confluence content:', error.response?.data || error.message);
            throw new Error(`Failed to fetch content: ${error.response?.data?.message || error.message}`);
        }
    }

    formatContent(content) {
        return content.map(item => ({
            id: item.id,
            title: item.title,
            type: item.type,
            status: item.status,
            created: item.history.createdDate,
            updated: item.version.when,
            version: item.version.number,
            space: {
                key: item.space.key,
                name: item.space.name
            },
            url: `${this.baseURL}${item._links.webui}`,
            author: item.history.createdBy.displayName
        }));
    }

    calculateStats(content) {
        const totalContent = content.length;
        const pages = content.filter(item => item.type === 'page').length;
        const blogPosts = content.filter(item => item.type === 'blogpost').length;
        
        // Calculate content by space
        const bySpace = {};
        content.forEach(item => {
            const spaceName = item.space.name;
            bySpace[spaceName] = (bySpace[spaceName] || 0) + 1;
        });

        // Calculate content by type
        const byType = {};
        content.forEach(item => {
            const type = item.type;
            byType[type] = (byType[type] || 0) + 1;
        });

        // Calculate activity over time (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentContent = content.filter(item => {
            const created = new Date(item.history.createdDate);
            return created >= thirtyDaysAgo;
        });

        const recentUpdates = content.filter(item => {
            const updated = new Date(item.version.when);
            return updated >= thirtyDaysAgo;
        });

        return {
            total: totalContent,
            pages: pages,
            blogPosts: blogPosts,
            bySpace,
            byType,
            recentContent: recentContent.length,
            recentUpdates: recentUpdates.length,
            avgUpdatesPerContent: totalContent > 0 ? (content.reduce((sum, item) => sum + item.version.number, 0) / totalContent).toFixed(1) : 0
        };
    }

    async getSpaces() {
        try {
            const response = await this.client.get('/rest/api/space', {
                params: {
                    limit: 50,
                    expand: 'description.plain'
                }
            });
            
            return response.data.results.map(space => ({
                key: space.key,
                name: space.name,
                type: space.type,
                description: space.description?.plain?.value || ''
            }));
        } catch (error) {
            console.error('Error fetching spaces:', error.response?.data || error.message);
            throw new Error(`Failed to fetch spaces: ${error.response?.data?.message || error.message}`);
        }
    }

    async searchUsers(query) {
        try {
            const response = await this.client.get('/rest/api/user/search', {
                params: {
                    query: query,
                    limit: 10
                }
            });
            
            return response.data.results.map(user => ({
                name: user.username || user.accountId,
                displayName: user.displayName,
                email: user.email,
                avatar: user.profilePicture?.path
            }));
        } catch (error) {
            console.error('Error searching users:', error.response?.data || error.message);
            throw new Error(`Failed to search users: ${error.response?.data?.message || error.message}`);
        }
    }
}

module.exports = new ConfluenceService();