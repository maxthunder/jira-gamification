const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const jiraRoutes = require('./routes/jira');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.use('/api/jira', jiraRoutes);

// Serve the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

// Serve the Jira dashboard
app.get('/jira-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'jira-dashboard.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});