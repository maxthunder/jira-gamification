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

let githubOrg = null;
let githubUsername = null;
let currentUsername = null;

// Detect hard reload (similar to Jira dashboard)
function isHardReload() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (!navigation) return false;
    
    const isReload = navigation.type === 'reload';
    const hasNoCacheHeader = document.cookie.includes('no-cache') || 
                            window.location.search.includes('no-cache');
    
    return isReload && (hasNoCacheHeader || navigation.loadEventEnd - navigation.loadEventStart < 100);
}

// Fetch configuration and auto-load user data on page load
async function initializeDashboard() {
    try {
        // Clear cache on hard reload
        if (isHardReload()) {
            console.log('Hard reload detected, clearing GitHub client cache');
            window.clientCache.clear();
        }

        // Fetch configuration
        const configResponse = await fetch('/api/github/config');
        const config = await configResponse.json();
        githubOrg = config.githubOrg;
        githubUsername = config.githubUsername;

        // Auto-load default user data
        if (githubUsername) {
            await loadUserData(githubUsername);
        } else {
            showError('No GitHub username configured. Please set GITHUB_USERNAME in .env file.');
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

    const cacheKey = window.clientCache.generateKey('github', 'user_data', username);
    
    // Try to get cached data first
    if (!forceRefresh) {
        const cachedData = window.clientCache.get(cacheKey);
        if (cachedData) {
            console.log('Using cached GitHub data for user:', username);
            displayResults(cachedData);
            calculateAchievements(cachedData.stats);
            document.querySelector('.section-title').textContent = `Developer Statistics - ${username}`;
            showCacheInfo(cacheKey, true);
            return;
        }
    }

    // Show loading and fetch fresh data
    showLoading(true);
    showCacheInfo(cacheKey, false);

    try {
        const url = forceRefresh ? 
            `/api/github/user/${encodeURIComponent(username)}/data?force=1` :
            `/api/github/user/${encodeURIComponent(username)}/data`;

        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch user data');
        }

        const data = await response.json();
        
        // Cache the fresh data (longer TTL for GitHub since it changes less frequently)
        window.clientCache.set(cacheKey, data, 10 * 60 * 1000); // 10 minutes
        
        displayResults(data);
        calculateAchievements(data.stats);

        // Update page title with username
        document.querySelector('.section-title').textContent = `Developer Statistics - ${username}`;
        
        console.log('Fetched and cached fresh GitHub data for user:', username);
    } catch (error) {
        showError(`Error fetching GitHub data: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayResults(data) {
    // Update main statistics
    document.getElementById('totalPRs').textContent = data.stats.pullRequests.total;
    document.getElementById('mergedPRs').textContent = data.stats.pullRequests.merged;
    document.getElementById('totalReviews').textContent = data.stats.reviews.total;
    document.getElementById('totalCommits').textContent = data.stats.commits.total;

    // Update PR stats
    document.getElementById('openPRs').textContent = data.stats.pullRequests.open;
    document.getElementById('mergeRate').textContent = `${data.stats.pullRequests.mergeRate}%`;
    document.getElementById('recentPRs').textContent = data.stats.pullRequests.recent;

    // Update review stats
    document.getElementById('approvedReviews').textContent = data.stats.reviews.approved;
    document.getElementById('changesRequested').textContent = data.stats.reviews.changesRequested;
    document.getElementById('recentReviews').textContent = data.stats.reviews.recent;

    // Update code impact stats
    document.getElementById('linesAdded').textContent = data.stats.commits.totalAdditions;
    document.getElementById('linesRemoved').textContent = data.stats.commits.totalDeletions;
    document.getElementById('netLines').textContent = data.stats.commits.netLines >= 0 ?
        `+${data.stats.commits.netLines}` : data.stats.commits.netLines;

    // Display repository breakdown
    displayRepositoryBreakdown(data.stats.repositories);

    // Display pull requests
    displayPullRequests(data.pullRequests);
    document.getElementById('prCount').textContent = data.pullRequests.length;

    // Display reviews
    displayReviews(data.reviews);
    document.getElementById('reviewCount').textContent = data.reviews.length;

    // Display commits
    displayCommits(data.commits);
    document.getElementById('commitCount').textContent = data.commits.length;

    // Show containers
    document.getElementById('userStats').classList.remove('hidden');
    document.getElementById('contentContainer').classList.remove('hidden');
}

function displayRepositoryBreakdown(repoStats) {
    const container = document.getElementById('repoBreakdown');
    container.innerHTML = '';

    // Combine PR and commit data
    const allRepos = new Set([...Object.keys(repoStats.prsByRepo), ...Object.keys(repoStats.commitsByRepo)]);

    Array.from(allRepos).slice(0, 10).forEach(repoName => {
        const prs = repoStats.prsByRepo[repoName] || 0;
        const commits = repoStats.commitsByRepo[repoName] || 0;
        const total = prs + commits;

        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `
            <span class="breakdown-label">${repoName}</span>
            <span class="breakdown-value">${prs} PRs, ${commits} commits</span>
        `;
        container.appendChild(item);
    });

    if (allRepos.size === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No repository activity found</p>';
    }
}

function displayPullRequests(pullRequests) {
    const container = document.getElementById('pullRequestsList');
    container.innerHTML = '';

    if (pullRequests.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No pull requests found</p>';
        return;
    }

    pullRequests.slice(0, 20).forEach(pr => {
        const card = document.createElement('div');
        card.className = 'ticket-card';

        const createdDate = new Date(pr.created).toLocaleDateString();
        const updatedDate = new Date(pr.updated).toLocaleDateString();

        const stateClass = pr.state === 'open' ? 'status-open' :
            pr.merged ? 'status-merged' : 'status-closed';
        const stateText = pr.state === 'open' ? 'Open' :
            pr.merged ? 'Merged' : 'Closed';

        card.innerHTML = `
            <div class="ticket-key">
                <a href="${pr.url}" target="_blank" style="color: inherit; text-decoration: none;">
                    #${pr.number}
                </a>
            </div>
            <div class="ticket-summary">${pr.title}</div>
            <div class="ticket-meta">
                <span class="ticket-badge ${stateClass}">${stateText}</span>
                <span class="ticket-badge">${pr.repository.name}</span>
                ${pr.draft ? '<span class="ticket-badge">Draft</span>' : ''}
                ${pr.labels.slice(0, 3).map(label => `<span class="ticket-badge">${label}</span>`).join('')}
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #999;">
                Created: ${createdDate} | Updated: ${updatedDate}
            </div>
        `;

        container.appendChild(card);
    });
}

function displayReviews(reviews) {
    const container = document.getElementById('reviewsList');
    container.innerHTML = '';

    if (reviews.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No reviews found</p>';
        return;
    }

    reviews.slice(0, 20).forEach(review => {
        const card = document.createElement('div');
        card.className = 'ticket-card';

        const submittedDate = new Date(review.submitted).toLocaleDateString();

        const stateClass = review.state === 'APPROVED' ? 'status-approved' :
            review.state === 'CHANGES_REQUESTED' ? 'status-changes' : 'status-commented';
        const stateText = review.state.replace('_', ' ');

        card.innerHTML = `
            <div class="ticket-key">
                <a href="${review.pr.url}" target="_blank" style="color: inherit; text-decoration: none;">
                    #${review.pr.number}
                </a>
            </div>
            <div class="ticket-summary">${review.pr.title}</div>
            <div class="ticket-meta">
                <span class="ticket-badge ${stateClass}">${stateText}</span>
                <span class="ticket-badge">${review.pr.repository.split('/')[1]}</span>
            </div>
            ${review.body ? `<div class="ticket-description">${review.body.substring(0, 100)}${review.body.length > 100 ? '...' : ''}</div>` : ''}
            <div style="margin-top: 10px; font-size: 11px; color: #999;">
                Submitted: ${submittedDate}
            </div>
        `;

        container.appendChild(card);
    });
}

function displayCommits(commits) {
    const container = document.getElementById('commitsList');
    container.innerHTML = '';

    if (commits.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No recent commits found</p>';
        return;
    }

    commits.slice(0, 20).forEach(commit => {
        const card = document.createElement('div');
        card.className = 'ticket-card';

        const commitDate = new Date(commit.date).toLocaleDateString();

        card.innerHTML = `
            <div class="ticket-key">
                <a href="${commit.url}" target="_blank" style="color: inherit; text-decoration: none;">
                    ${commit.sha.substring(0, 7)}
                </a>
            </div>
            <div class="ticket-summary">${commit.message}</div>
            <div class="ticket-meta">
                <span class="ticket-badge">${commit.repository.name}</span>
                ${commit.additions > 0 ? `<span class="ticket-badge status-approved">+${commit.additions}</span>` : ''}
                ${commit.deletions > 0 ? `<span class="ticket-badge status-closed">-${commit.deletions}</span>` : ''}
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #999;">
                Committed: ${commitDate}
            </div>
        `;

        container.appendChild(card);
    });
}

function calculateAchievements(stats) {
    const prStats = stats.pullRequests;
    const reviewStats = stats.reviews;
    const commitStats = stats.commits;

    const achievements = [
        {name: 'First PR', earned: prStats.total >= 1, description: 'Create your first pull request'},
        {name: 'Contributor', earned: prStats.total >= 5, description: 'Create 5 pull requests'},
        {name: 'Active Developer', earned: prStats.total >= 20, description: 'Create 20 pull requests'},
        {name: 'Prolific Coder', earned: prStats.total >= 50, description: 'Create 50 pull requests'},
        {name: 'Merge Master', earned: prStats.merged >= 10, description: 'Get 10 PRs merged'},
        {name: 'Merge Guru', earned: prStats.merged >= 25, description: 'Get 25 PRs merged'},
        {name: 'Code Review Hero', earned: reviewStats.total >= 10, description: 'Review 10 pull requests'},
        {name: 'Review Expert', earned: reviewStats.total >= 50, description: 'Review 50 pull requests'},
        {name: 'Quality Guardian', earned: reviewStats.changesRequested >= 5, description: 'Request changes 5 times'},
        {name: 'Team Player', earned: reviewStats.approved >= 20, description: 'Approve 20 pull requests'},
        {name: 'Daily Committer', earned: commitStats.total >= 30, description: '30+ commits in 30 days'},
        {name: 'Code Machine', earned: commitStats.total >= 60, description: '60+ commits in 30 days'},
        {name: 'Line Master', earned: commitStats.totalAdditions >= 1000, description: 'Add 1000+ lines of code'},
        {name: 'Refactor King', earned: commitStats.totalDeletions >= 500, description: 'Remove 500+ lines of code'},
        {name: 'High Merger', earned: parseFloat(prStats.mergeRate) >= 80, description: '80%+ merge rate'},
        {
            name: 'Perfect Merger',
            earned: parseFloat(prStats.mergeRate) === 100 && prStats.total >= 5,
            description: '100% merge rate (5+ PRs)'
        },
        {name: 'Multi-Repo', earned: stats.repositories.totalRepos >= 3, description: 'Contribute to 3+ repositories'},
        {
            name: 'Repository Explorer',
            earned: stats.repositories.totalRepos >= 5,
            description: 'Contribute to 5+ repositories'
        },
        {name: 'Recent Activity', earned: prStats.recent >= 3, description: '3+ PRs in last 30 days'},
        {
            name: 'Productivity Beast',
            earned: prStats.recent >= 10 && commitStats.total >= 20,
            description: '10+ PRs + 20+ commits in 30 days'
        }
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

// Cache management functions (same as Jira dashboard)
function showCacheInfo(cacheKey, fromCache) {
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
        cacheStatus.textContent = '🔄 Fetching GitHub data...';
        cacheStatus.style.background = '#2196F3';
        
        setTimeout(() => {
            if (cacheStatus.textContent.includes('Fetching')) {
                cacheStatus.textContent = '✅ Fresh data loaded';
                cacheStatus.style.background = '#4CAF50';
            }
        }, 1000);
    }
    
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

function addRefreshButton() {
    if (!document.getElementById('refreshButton')) {
        const refreshButton = document.createElement('button');
        refreshButton.id = 'refreshButton';
        refreshButton.textContent = '🔄 Refresh';
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
                loadUserData(currentUsername, false);
            }
        };
        
        document.body.appendChild(refreshButton);
    }
    
    if (!document.getElementById('forceRefreshButton')) {
        const forceRefreshButton = document.createElement('button');
        forceRefreshButton.id = 'forceRefreshButton';
        forceRefreshButton.textContent = '⚡ Force Refresh';
        forceRefreshButton.style.cssText = `
            position: fixed;
            top: 100px;
            right: 10px;
            padding: 8px 12px;
            background: #F44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            z-index: 1000;
        `;
        
        forceRefreshButton.onclick = () => {
            if (currentUsername) {
                loadUserData(currentUsername, true);
            }
        };
        
        document.body.appendChild(forceRefreshButton);
    }
}

// Add keyboard shortcuts for refresh
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (currentUsername) {
            if (e.shiftKey) {
                loadUserData(currentUsername, true);
            } else {
                loadUserData(currentUsername, false);
            }
        }
    }
});

// Initialize refresh button when page loads
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(addRefreshButton, 1000);
});