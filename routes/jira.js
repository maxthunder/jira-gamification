const express = require('express');
const router = express.Router();
const jiraService = require('../services/jiraService');
const cacheService = require('../services/cacheService');

// Get tickets for a specific user
router.get('/user/:username/tickets', async (req, res) => {
    try {
        const { username } = req.params;
        const { nocache, force } = req.query;
        
        if (!username) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username is required' 
            });
        }

        // Check if cache should be bypassed
        const useCache = !nocache && !force;
        
        // If force is specified, clear the cache for this user first
        if (force) {
            const cacheKey = cacheService.generateKey('jira', 'user_tickets', username);
            cacheService.delete(cacheKey);
        }

        const data = await jiraService.getUserTickets(username, useCache);
        res.json(data);
    } catch (error) {
        console.error('Error in /user/:username/tickets:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to fetch user tickets' 
        });
    }
});

// Search for users
router.get('/users/search', async (req, res) => {
    try {
        const { q, nocache } = req.query;
        
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const useCache = !nocache;
        const users = await jiraService.searchUsers(q, useCache);
        res.json(users);
    } catch (error) {
        console.error('Error in /users/search:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to search users' 
        });
    }
});

// Get configuration
router.get('/config', (req, res) => {
    res.json({ 
        jiraBaseUrl: process.env.JIRA_BASE_URL || null,
        defaultUser: process.env.DEFAULT_USER || null
    });
});

// Clear cache endpoint
router.post('/cache/clear', (req, res) => {
    cacheService.clear();
    res.json({ 
        success: true, 
        message: 'Cache cleared successfully' 
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Jira API is running',
        configured: !!(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN)
    });
});

module.exports = router;