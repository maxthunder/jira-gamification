const express = require('express');
const router = express.Router();
const jiraService = require('../services/jiraService');

// Get tickets for a specific user
router.get('/user/:username/tickets', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username is required' 
            });
        }

        const data = await jiraService.getUserTickets(username);
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
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const users = await jiraService.searchUsers(q);
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
        jiraBaseUrl: process.env.JIRA_BASE_URL || null
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