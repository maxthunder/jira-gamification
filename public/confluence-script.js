let confluenceBaseUrl = null;
let defaultUser = null;

// Fetch configuration and auto-load user data on page load
async function initializeDashboard() {
    try {
        // Fetch configuration
        const configResponse = await fetch('/api/confluence/config');
        const config = await configResponse.json();
        confluenceBaseUrl = config.confluenceBaseUrl;
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
        const response = await fetch(`/api/confluence/user/${encodeURIComponent(username)}/content`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch user content');
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
    document.getElementById('totalContent').textContent = data.stats.total;
    document.getElementById('totalPages').textContent = data.stats.pages;
    document.getElementById('totalBlogPosts').textContent = data.stats.blogPosts;
    document.getElementById('recentUpdates').textContent = data.stats.recentUpdates;

    // Display space breakdown
    const spaceBreakdown = document.getElementById('spaceBreakdown');
    spaceBreakdown.innerHTML = '';
    Object.entries(data.stats.bySpace).forEach(([space, count]) => {
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `
            <span class="breakdown-label">${space}</span>
            <span class="breakdown-value">${count}</span>
        `;
        spaceBreakdown.appendChild(item);
    });

    // Display type breakdown
    const typeBreakdown = document.getElementById('typeBreakdown');
    typeBreakdown.innerHTML = '';
    Object.entries(data.stats.byType).forEach(([type, count]) => {
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `
            <span class="breakdown-label">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
            <span class="breakdown-value">${count}</span>
        `;
        typeBreakdown.appendChild(item);
    });

    // Display pages
    displayContent('pagesList', data.pages);
    document.getElementById('pagesCount').textContent = data.pages.length;

    // Display blog posts
    displayContent('blogPostsList', data.blogPosts);
    document.getElementById('blogPostsCount').textContent = data.blogPosts.length;

    // Show containers
    document.getElementById('userStats').classList.remove('hidden');
    document.getElementById('contentContainer').classList.remove('hidden');
}

function displayContent(containerId, content) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (content.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No content found</p>';
        return;
    }

    content.forEach(item => {
        const card = document.createElement('div');
        card.className = 'ticket-card';
        
        const createdDate = new Date(item.created).toLocaleDateString();
        const updatedDate = new Date(item.updated).toLocaleDateString();

        const titleHtml = item.url 
            ? `<div class="ticket-key"><a href="${item.url}" target="_blank" style="color: inherit; text-decoration: none; hover: text-decoration: underline;">${item.title}</a></div>`
            : `<div class="ticket-key">${item.title}</div>`;
        
        card.innerHTML = `
            ${titleHtml}
            <div class="ticket-summary">${item.title}</div>
            <div class="ticket-meta">
                <span class="ticket-badge status">${item.status}</span>
                <span class="ticket-badge type">${item.type}</span>
                <span class="ticket-badge">${item.space.name}</span>
                <span class="ticket-badge">v${item.version}</span>
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
        { name: 'First Page', earned: stats.pages >= 1, description: 'Create your first page' },
        { name: 'Author', earned: stats.total >= 5, description: 'Create 5 pieces of content' },
        { name: 'Contributor', earned: stats.total >= 10, description: 'Create 10 pieces of content' },
        { name: 'Prolific Writer', earned: stats.total >= 25, description: 'Create 25 pieces of content' },
        { name: 'Content Master', earned: stats.total >= 50, description: 'Create 50 pieces of content' },
        { name: 'Documentation Expert', earned: stats.total >= 100, description: 'Create 100 pieces of content' },
        { name: 'Blogger', earned: stats.blogPosts >= 5, description: 'Write 5 blog posts' },
        { name: 'Blog Master', earned: stats.blogPosts >= 20, description: 'Write 20 blog posts' },
        { name: 'Multi-Space', earned: Object.keys(stats.bySpace).length >= 3, description: 'Contribute to 3+ spaces' },
        { name: 'Space Expert', earned: Object.keys(stats.bySpace).length >= 5, description: 'Contribute to 5+ spaces' },
        { name: 'Active Creator', earned: stats.recentContent >= 5, description: '5+ new content in 30 days' },
        { name: 'Busy Bee', earned: stats.recentUpdates >= 10, description: '10+ updates in 30 days' },
        { name: 'Perfectionist', earned: parseFloat(stats.avgUpdatesPerContent) >= 3, description: 'Average 3+ updates per content' },
        { name: 'Knowledge Sharer', earned: stats.pages >= 20 && stats.blogPosts >= 5, description: '20 pages + 5 blog posts' }
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
    document.getElementById('contentContainer').classList.add('hidden');
}