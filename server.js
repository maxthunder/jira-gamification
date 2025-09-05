const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Load routes with error handling
let jiraRoutes, confluenceRoutes, githubRoutes;

try {
    jiraRoutes = require('./routes/jira');
    console.log('✓ Jira routes loaded successfully');
} catch (error) {
    console.error('✗ Failed to load Jira routes:', error.message);
    process.exit(1);
}

try {
    confluenceRoutes = require('./routes/confluence');
    console.log('✓ Confluence routes loaded successfully');
} catch (error) {
    console.error('✗ Failed to load Confluence routes:', error.message);
    process.exit(1);
}

try {
    githubRoutes = require('./routes/github');
    console.log('✓ GitHub routes loaded successfully');
} catch (error) {
    console.error('✗ Failed to load GitHub routes:', error.message);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Access key validation endpoint
app.post('/api/validate-key', (req, res) => {
    const { accessKey } = req.body;
    const validKey = process.env.ACCESS_KEY;

    if (!validKey) {
        return res.status(500).json({ error: 'ACCESS_KEY not configured' });
    }

    if (accessKey === validKey) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
});

// API Routes
app.use('/api/jira', jiraRoutes);
app.use('/api/confluence', confluenceRoutes);
app.use('/api/github', githubRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Serve the key entry page as default
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'key-entry.html'));
});

// Serve the homepage (after key validation)
app.get('/homepage.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

// Serve the Jira dashboard
app.get('/jira-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'jira-dashboard.html'));
});

// Serve the Confluence dashboard
app.get('/confluence-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'confluence-dashboard.html'));
});

// Serve the GitHub dashboard
app.get('/github-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'github-dashboard.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});