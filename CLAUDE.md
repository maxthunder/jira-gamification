# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Jira Gamification application - a Node.js Express server that fetches Jira ticket data and presents it with gamification elements and achievements. The application provides a web interface to view user statistics and achievements based on their Jira ticket activity.

## Tech Stack

- **Backend**: Node.js with Express.js (CommonJS modules)
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **API Integration**: Jira REST API v2
- **Dependencies**: axios, cors, dotenv, express

## Commands

```bash
# Install dependencies
npm install

# Start the server (development and production)
npm start
# or
npm run dev

# Both start commands run: node server.js
```

## Architecture

### Backend Structure
- `server.js`: Express server entry point, serves static files and API routes
- `routes/jira.js`: API endpoints for Jira data (`/api/jira/*`)
- `services/jiraService.js`: Jira API client and data processing logic

### API Endpoints
- `GET /api/jira/user/:username/tickets`: Fetches user's tickets with stats
- `GET /api/jira/users/search?q={query}`: Searches for Jira users
- `GET /api/jira/health`: Health check endpoint

### Frontend
- `public/index.html`: Main application UI
- `public/script.js`: Client-side JavaScript for API calls and UI updates
- `public/styles.css`: Application styling

## Configuration

Required environment variables in `.env`:
- `JIRA_BASE_URL`: Your Jira instance URL (e.g., https://yourcompany.atlassian.net)
- `JIRA_EMAIL`: Jira account email
- `JIRA_API_TOKEN`: Jira API token (generate at https://id.atlassian.com/manage-profile/security/api-tokens)
- `PORT`: Server port (default: 3000)

## Key Implementation Details

The `jiraService.js` handles:
- Authentication using Basic Auth with email/API token
- JQL queries to fetch tickets by assignee
- Ticket categorization (current vs closed)
- Statistics calculation (completion rate, priority/type breakdown, resolution time)
- User search functionality

The frontend displays:
- User statistics dashboard
- Current and closed tickets
- Achievement badges based on ticket metrics
- Priority and type breakdowns