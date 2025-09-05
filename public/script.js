let jiraBaseUrl = null;
let defaultUser = null;

// Fetch configuration and auto-load user data on page load
async function initializeDashboard() {
    try {
        // Fetch configuration
        const configResponse = await fetch('/api/jira/config');
        const config = await configResponse.json();
        jiraBaseUrl = config.jiraBaseUrl;
        defaultUser = config.defaultUser;
        
        // Auto-load default user data
        if (defaultUser) {
            await loadUserData(defaultUser);
        } else {
            showError('No default user configured. Please set DEFAULT_USER in .env file.');
            showLoading(false);
        }
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        showError('Failed to initialize dashboard. Please check your configuration.');
        showLoading(false);
    }
}

// Initialize dashboard on page load
window.addEventListener('DOMContentLoaded', initializeDashboard);

async function loadUserData(username) {
    hideError();
    showLoading(true);
    hideResults();

    try {
        const response = await fetch(`/api/jira/user/${encodeURIComponent(username)}/tickets`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch user data');
        }

        const data = await response.json();
        displayResults(data);
        calculateAchievements(data.stats);
        
        // Update page title with username
        document.querySelector('.section-title').textContent = `User Statistics - ${username}`;
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function displayResults(data) {
    // Update statistics
    document.getElementById('totalTickets').textContent = data.stats.total;
    document.getElementById('openTickets').textContent = data.stats.open;
    document.getElementById('closedTickets').textContent = data.stats.closed;
    document.getElementById('completionRate').textContent = data.stats.completionRate + '%';

    // Display priority breakdown
    const priorityBreakdown = document.getElementById('priorityBreakdown');
    priorityBreakdown.innerHTML = '';
    Object.entries(data.stats.byPriority).forEach(([priority, count]) => {
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `
            <span class="breakdown-label">${priority}</span>
            <span class="breakdown-value">${count}</span>
        `;
        priorityBreakdown.appendChild(item);
    });

    // Display type breakdown
    const typeBreakdown = document.getElementById('typeBreakdown');
    typeBreakdown.innerHTML = '';
    Object.entries(data.stats.byType).forEach(([type, count]) => {
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `
            <span class="breakdown-label">${type}</span>
            <span class="breakdown-value">${count}</span>
        `;
        typeBreakdown.appendChild(item);
    });

    // Display current tickets
    displayTickets('currentTickets', data.current);
    document.getElementById('currentCount').textContent = data.current.length;

    // Display closed tickets
    displayTickets('closedTicketsList', data.closed);
    document.getElementById('closedCount').textContent = data.closed.length;

    // Show containers
    document.getElementById('userStats').classList.remove('hidden');
    document.getElementById('ticketsContainer').classList.remove('hidden');
}

function displayTickets(containerId, tickets) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (tickets.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No tickets found</p>';
        return;
    }

    tickets.forEach(ticket => {
        const card = document.createElement('div');
        card.className = 'ticket-card';
        
        const priorityClass = ticket.priority ? 
            `priority-${ticket.priority.toLowerCase().replace(' ', '-')}` : '';

        const createdDate = new Date(ticket.created).toLocaleDateString();
        const updatedDate = new Date(ticket.updated).toLocaleDateString();

        const ticketKeyHtml = jiraBaseUrl 
            ? `<div class="ticket-key"><a href="${jiraBaseUrl.replace(/\/$/, '')}/browse/${ticket.key}" target="_blank" style="color: inherit; text-decoration: none; hover: text-decoration: underline;">${ticket.key}</a></div>`
            : `<div class="ticket-key">${ticket.key}</div>`;
        
        card.innerHTML = `
            ${ticketKeyHtml}
            <div class="ticket-summary">${ticket.summary}</div>
            <div class="ticket-meta">
                <span class="ticket-badge status">${ticket.status}</span>
                <span class="ticket-badge ${priorityClass}">${ticket.priority}</span>
                <span class="ticket-badge type">${ticket.type}</span>
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #999;">
                Created: ${createdDate} | Updated: ${updatedDate}
            </div>
        `;
        
        container.appendChild(card);
    });
}

function calculateAchievements(stats) {
    const achievements = [
        { name: 'First Steps', earned: stats.total >= 1, description: 'Complete your first ticket' },
        { name: 'Getting Started', earned: stats.total >= 10, description: 'Handle 10 tickets' },
        { name: 'Contributor', earned: stats.total >= 25, description: 'Handle 25 tickets' },
        { name: 'Team Player', earned: stats.total >= 50, description: 'Handle 50 tickets' },
        { name: 'Expert', earned: stats.total >= 100, description: 'Handle 100 tickets' },
        { name: 'Master', earned: stats.total >= 200, description: 'Handle 200 tickets' },
        { name: 'Closer', earned: stats.closed >= 10, description: 'Close 10 tickets' },
        { name: 'Finisher', earned: stats.closed >= 50, description: 'Close 50 tickets' },
        { name: 'High Performer', earned: parseFloat(stats.completionRate) >= 80, description: '80% completion rate' },
        { name: 'Perfect Score', earned: parseFloat(stats.completionRate) >= 95, description: '95% completion rate' },
        { name: 'Bug Hunter', earned: (stats.byType['Bug'] || 0) >= 20, description: 'Handle 20 bug tickets' },
        { name: 'Feature Builder', earned: (stats.byType['Story'] || 0) >= 10, description: 'Complete 10 story tickets' },
        { name: 'Priority Master', earned: (stats.byPriority['Highest'] || 0) >= 5, description: 'Handle 5 highest priority tickets' },
        { name: 'Speed Demon', earned: stats.avgResolutionDays > 0 && stats.avgResolutionDays <= 3, description: 'Average resolution under 3 days' }
    ];

    const achievementsContainer = document.getElementById('achievements');
    achievementsContainer.innerHTML = '';

    achievements.forEach(achievement => {
        const badge = document.createElement('div');
        badge.className = `achievement ${achievement.earned ? 'earned' : ''}`;
        badge.title = achievement.description;
        badge.textContent = achievement.name;
        achievementsContainer.appendChild(badge);
    });
}

function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (show) {
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

function hideResults() {
    document.getElementById('userStats').classList.add('hidden');
    document.getElementById('ticketsContainer').classList.add('hidden');
}

