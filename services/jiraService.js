const axios = require('axios');
const cacheService = require('./cacheService');

class JiraService {
    constructor() {
        this.baseURL = process.env.JIRA_BASE_URL;
        this.email = process.env.JIRA_EMAIL;
        this.apiToken = process.env.JIRA_API_TOKEN;
        
        if (!this.baseURL || !this.email || !this.apiToken) {
            console.warn('Jira configuration is incomplete. Please check your .env file.');
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

    async getUserTickets(username, useCache = true) {
        const cacheKey = cacheService.generateKey('jira', 'user_tickets', username);
        
        // Check cache first
        if (useCache) {
            const cachedData = cacheService.get(cacheKey);
            if (cachedData) {
                console.log(`Cache hit for user tickets: ${username}`);
                return cachedData;
            }
        }

        try {
            console.log(`Fetching fresh data for user tickets: ${username}`);
            
            // Search for all tickets assigned to the user
            const jql = `assignee = "${username}" ORDER BY created DESC`;
            
            const response = await this.client.get('/rest/api/2/search', {
                params: {
                    jql: jql,
                    maxResults: 100,
                    fields: 'summary,status,priority,created,updated,issuetype,resolution,resolutiondate,assignee,reporter,project'
                }
            });

            const tickets = response.data.issues || [];
            
            // Separate current (open) and closed tickets
            const currentTickets = tickets.filter(ticket => 
                ticket.fields.status.statusCategory.key !== 'done'
            );
            
            const closedTickets = tickets.filter(ticket => 
                ticket.fields.status.statusCategory.key === 'done'
            );

            const result = {
                current: this.formatTickets(currentTickets),
                closed: this.formatTickets(closedTickets),
                stats: this.calculateStats(tickets)
            };

            // Cache the result
            cacheService.set(cacheKey, result);
            
            return result;
        } catch (error) {
            console.error('Error fetching Jira tickets:', error.response?.data || error.message);
            throw new Error(`Failed to fetch tickets: ${error.response?.data?.errorMessages?.[0] || error.message}`);
        }
    }

    formatTickets(tickets) {
        return tickets.map(ticket => ({
            key: ticket.key,
            summary: ticket.fields.summary,
            status: ticket.fields.status.name,
            statusCategory: ticket.fields.status.statusCategory.name,
            priority: ticket.fields.priority?.name || 'None',
            type: ticket.fields.issuetype.name,
            created: ticket.fields.created,
            updated: ticket.fields.updated,
            resolved: ticket.fields.resolutiondate,
            project: {
                key: ticket.fields.project.key,
                name: ticket.fields.project.name
            },
            assignee: ticket.fields.assignee?.displayName || ticket.fields.assignee?.name,
            reporter: ticket.fields.reporter?.displayName || ticket.fields.reporter?.name
        }));
    }

    calculateStats(tickets) {
        const totalTickets = tickets.length;
        const closedTickets = tickets.filter(t => t.fields.status.statusCategory.key === 'done').length;
        const openTickets = totalTickets - closedTickets;
        
        // Calculate tickets by priority
        const byPriority = {};
        tickets.forEach(ticket => {
            const priority = ticket.fields.priority?.name || 'None';
            byPriority[priority] = (byPriority[priority] || 0) + 1;
        });

        // Calculate tickets by type
        const byType = {};
        tickets.forEach(ticket => {
            const type = ticket.fields.issuetype.name;
            byType[type] = (byType[type] || 0) + 1;
        });

        // Calculate average resolution time for closed tickets
        const closedWithResolution = tickets.filter(t => t.fields.resolutiondate);
        let avgResolutionTime = 0;
        if (closedWithResolution.length > 0) {
            const totalTime = closedWithResolution.reduce((sum, ticket) => {
                const created = new Date(ticket.fields.created);
                const resolved = new Date(ticket.fields.resolutiondate);
                return sum + (resolved - created);
            }, 0);
            avgResolutionTime = totalTime / closedWithResolution.length;
        }

        return {
            total: totalTickets,
            open: openTickets,
            closed: closedTickets,
            completionRate: totalTickets > 0 ? ((closedTickets / totalTickets) * 100).toFixed(1) : 0,
            byPriority,
            byType,
            avgResolutionDays: avgResolutionTime > 0 ? Math.round(avgResolutionTime / (1000 * 60 * 60 * 24)) : 0
        };
    }

    async searchUsers(query, useCache = true) {
        const cacheKey = cacheService.generateKey('jira', 'search_users', query);
        
        // Check cache first
        if (useCache) {
            const cachedData = cacheService.get(cacheKey);
            if (cachedData) {
                console.log(`Cache hit for user search: ${query}`);
                return cachedData;
            }
        }

        try {
            console.log(`Fetching fresh data for user search: ${query}`);
            
            const response = await this.client.get('/rest/api/2/user/search', {
                params: {
                    query: query,
                    maxResults: 10
                }
            });
            
            const result = response.data.map(user => ({
                name: user.name,
                displayName: user.displayName,
                email: user.emailAddress,
                avatar: user.avatarUrls?.['48x48']
            }));

            // Cache the result (shorter TTL for search results)
            cacheService.set(cacheKey, result, 2 * 60 * 1000); // 2 minutes
            
            return result;
        } catch (error) {
            console.error('Error searching users:', error.response?.data || error.message);
            throw new Error(`Failed to search users: ${error.response?.data?.errorMessages?.[0] || error.message}`);
        }
    }
}

module.exports = new JiraService();