let jiraBaseUrl = null;
let defaultUser = null;
let currentUsername = null;

// Detect force reload (Ctrl+F5, Cmd+Shift+R, etc.)
function isHardReload() {
    // Check various indicators of a hard reload
    const navigation = performance.getEntriesByType('navigation')[0];
    return navigation && (
        navigation.type === 'reload' ||
        // Additional checks for hard reload
        (performance.navigation && performance.navigation.type === 1)
    );
}

// Fetch configuration and auto-load user data on page load
async function initializeDashboard() {
    try {
        // Clear cache on hard reload
        if (isHardReload()) {
            console.log('Hard reload detected, clearing client cache');
            window.clientCache.clear();
        }

        // Fetch configuration (always fresh, it's lightweight)
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

async function loadUserData(username, forceRefresh = false) {
    currentUsername = username;
    hideError();
    hideResults();

    const cacheKey = window.clientCache.generateKey('jira', 'user_tickets', username);
    
    // Try to get cached data first
    if (!forceRefresh) {
        const cachedData = window.clientCache.get(cacheKey);
        if (cachedData) {
            console.log('Using cached data for user:', username);
            displayResults(cachedData);
            calculateAchievements(cachedData.stats);
            document.querySelector('.section-title').textContent = `User Statistics - ${username}`;
            showCacheInfo(cacheKey, true);
            return;
        }
    }

    // Show loading and fetch fresh data
    showLoading(true);
    showCacheInfo(cacheKey, false);

    try {
        const url = forceRefresh ? 
            `/api/jira/user/${encodeURIComponent(username)}/tickets?force=1` :
            `/api/jira/user/${encodeURIComponent(username)}/tickets`;
            
        const response = await fetch(url);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch user data');
        }

        const data = await response.json();
        
        // Cache the fresh data
        window.clientCache.set(cacheKey, data);
        
        displayResults(data);
        calculateAchievements(data.stats);
        
        // Update page title with username
        document.querySelector('.section-title').textContent = `User Statistics - ${username}`;
        
        console.log('Fetched and cached fresh data for user:', username);
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

function showCacheInfo(cacheKey, fromCache) {
    // Add cache status to page
    let cacheStatus = document.getElementById('cacheStatus');
    if (!cacheStatus) {
        cacheStatus = document.createElement('div');
        cacheStatus.id = 'cacheStatus';
        cacheStatus.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 12px;
            background: ${fromCache ? '#4CAF50' : '#2196F3'};
            color: white;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            opacity: 0.8;
        `;
        document.body.appendChild(cacheStatus);
    }
    
    if (fromCache) {
        const cacheInfo = window.clientCache.getCacheInfo(cacheKey);
        const age = cacheInfo ? Math.round(cacheInfo.age / 1000) : 0;
        cacheStatus.textContent = `📦 Cached (${age}s ago)`;
        cacheStatus.style.background = '#4CAF50';
    } else {
        cacheStatus.textContent = '🔄 Fetching fresh data...';
        cacheStatus.style.background = '#2196F3';
        
        // Hide after fetch completes
        setTimeout(() => {
            if (cacheStatus.textContent.includes('Fetching')) {
                cacheStatus.textContent = '✅ Fresh data loaded';
                cacheStatus.style.background = '#4CAF50';
            }
        }, 1000);
    }
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (cacheStatus && document.body.contains(cacheStatus)) {
            cacheStatus.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(cacheStatus)) {
                    document.body.removeChild(cacheStatus);
                }
            }, 300);
        }
    }, 3000);
}

// Add refresh button functionality
function addRefreshButton() {
    if (!document.getElementById('refreshButton')) {
        const refreshButton = document.createElement('button');
        refreshButton.id = 'refreshButton';
        refreshButton.textContent = '🔄 Refresh Data';
        refreshButton.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            padding: 8px 12px;
            background: #FF9800;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            z-index: 1000;
        `;
        
        refreshButton.onclick = () => {
            if (currentUsername) {
                loadUserData(currentUsername, true);
            }
        };
        
        document.body.appendChild(refreshButton);
    }
}

// Add keyboard shortcut for refresh (Ctrl+R or Cmd+R)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        if (currentUsername) {
            loadUserData(currentUsername, true);
        }
    }
});

// Initialize refresh button when page loads
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(addRefreshButton, 1000); // Add after initial load
});

