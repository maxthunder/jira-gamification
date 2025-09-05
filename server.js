const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const jiraRoutes = require('./routes/jira');
const confluenceRoutes = require('./routes/confluence');
const githubRoutes = require('./routes/github');

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
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});