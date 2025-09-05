/*
 * NEXTWORLD CONFIDENTIAL
 *
 * Nextworld
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Nextworld and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Nextworld
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Nextworld.
 *
 * Copyright 2017 (c) Nextworld - All rights reserved.
 */

const express = require('express');
const router = express.Router();
const githubService = require('../services/githubService');
const cacheService = require('../services/cacheService');

// Get GitHub data for a specific user
router.get('/user/:username/data', async (req, res) => {
    try {
        const {username} = req.params;
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
            const cacheKey = cacheService.generateKey('github', 'user_data', username);
            cacheService.delete(cacheKey);
        }

        const data = await githubService.getUserData(username, useCache);
        res.json(data);
    } catch (error) {
        console.error('Error in /user/:username/data:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch user data'
        });
    }
});

// Get organization repositories
router.get('/repos', async (req, res) => {
    try {
        const { nocache } = req.query;
        const repos = await githubService.getOrganizationRepos(!nocache);
        res.json(repos);
    } catch (error) {
        console.error('Error in /repos:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch repositories'
        });
    }
});

// Get configuration
router.get('/config', (req, res) => {
    res.json({
        githubOrg: process.env.GITHUB_ORG || 'nextworld',
        githubUsername: process.env.GITHUB_USERNAME || null
    });
});

// Clear cache endpoint
router.post('/cache/clear', (req, res) => {
    cacheService.clear();
    res.json({ 
        success: true, 
        message: 'GitHub cache cleared successfully' 
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'GitHub API is running',
        configured: !!(process.env.GITHUB_TOKEN && process.env.GITHUB_ORG)
    });
});

module.exports = router;