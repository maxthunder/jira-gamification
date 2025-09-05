const express = require('express');
const router = express.Router();
const confluenceService = require('../services/confluenceService');

// Get content for a specific user
router.get('/user/:username/content', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username is required' 
            });
        }

        const data = await confluenceService.getUserContent(username);
        res.json(data);
    } catch (error) {
        console.error('Error in /user/:username/content:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to fetch user content' 
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

        const users = await confluenceService.searchUsers(q);
        res.json(users);
    } catch (error) {
        console.error('Error in /users/search:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to search users' 
        });
    }
});

// Get spaces
router.get('/spaces', async (req, res) => {
    try {
        const spaces = await confluenceService.getSpaces();
        res.json(spaces);
    } catch (error) {
        console.error('Error in /spaces:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to fetch spaces' 
        });
    }
});

// Get configuration
router.get('/config', (req, res) => {
    res.json({ 
        confluenceBaseUrl: process.env.CONFLUENCE_BASE_URL || null,
        defaultUser: process.env.DEFAULT_USER || null
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Confluence API is running',
        configured: !!(process.env.CONFLUENCE_BASE_URL && process.env.CONFLUENCE_EMAIL && process.env.CONFLUENCE_API_TOKEN)
    });
});

module.exports = router;