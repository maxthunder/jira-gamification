const axios = require('axios');
const cacheService = require('./cacheService');

class GitHubService {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.token = process.env.GITHUB_TOKEN;
        this.organization = process.env.GITHUB_ORG || 'nextworld';
        
        if (!this.token) {
            console.warn('GitHub token is not configured. Please check your .env file.');
        }
        
        // Create axios instance with auth
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${this.token}`,
                'User-Agent': 'Gamification-Dashboard'
            }
        });
    }

    async getUserData(username, useCache = true) {
        const cacheKey = cacheService.generateKey('github', 'user_data', username);
        
        // Check cache first
        if (useCache) {
            const cachedData = cacheService.get(cacheKey);
            if (cachedData) {
                console.log(`Cache hit for GitHub user data: ${username}`);
                return cachedData;
            }
        }

        try {
            console.log(`Fetching fresh GitHub data for user: ${username}`);
            
            // Run all API calls in parallel for better performance
            const [pullRequests, reviews, commits] = await Promise.allSettled([
                this.getUserPullRequests(username),
                this.getUserReviews(username),
                this.getUserCommits(username)
            ]);

            // Extract results, using empty arrays for failed requests
            const prs = pullRequests.status === 'fulfilled' ? pullRequests.value : [];
            const reviewsData = reviews.status === 'fulfilled' ? reviews.value : [];
            const commitsData = commits.status === 'fulfilled' ? commits.value : [];
            
            // Log any failures but don't fail entirely
            if (pullRequests.status === 'rejected') {
                console.warn('Failed to fetch pull requests:', pullRequests.reason.message);
            }
            if (reviews.status === 'rejected') {
                console.warn('Failed to fetch reviews:', reviews.reason.message);
            }
            if (commits.status === 'rejected') {
                console.warn('Failed to fetch commits:', commits.reason.message);
            }
            
            const result = {
                pullRequests: this.formatPullRequests(prs),
                reviews: this.formatReviews(reviewsData),
                commits: this.formatCommits(commitsData),
                stats: this.calculateStats(prs, reviewsData, commitsData)
            };

            // Cache the result (longer TTL for GitHub data since it changes less frequently)
            cacheService.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes
            
            return result;
        } catch (error) {
            console.error('Error fetching GitHub data:', error.response?.data || error.message);
            throw new Error(`Failed to fetch GitHub data: ${error.response?.data?.message || error.message}`);
        }
    }

    async getUserPullRequests(username) {
        try {
            const response = await this.client.get(`/search/issues`, {
                params: {
                    q: `type:pr author:${username} org:${this.organization}`,
                    sort: 'created',
                    order: 'desc',
                    per_page: 100
                }
            });
            
            return response.data.items || [];
        } catch (error) {
            console.error('Error fetching pull requests:', error.message);
            return [];
        }
    }

    async getUserReviews(username) {
        try {
            // Search for PRs where user was involved in reviews
            const response = await this.client.get(`/search/issues`, {
                params: {
                    q: `type:pr involves:${username} org:${this.organization}`,
                    sort: 'updated',
                    order: 'desc',
                    per_page: 30 // Reduced to limit API calls
                }
            });
            
            const prs = response.data.items || [];
            const reviews = [];
            
            // Use Promise.allSettled to fetch reviews in parallel and handle failures gracefully
            const reviewPromises = prs.slice(0, 15).map(async pr => { // Further limit to reduce API calls
                try {
                    const reviewResponse = await this.client.get(`/repos/${pr.repository_url.split('/').slice(-2).join('/')}/pulls/${pr.number}/reviews`);
                    const userReviews = reviewResponse.data.filter(review => review.user.login === username);
                    return userReviews.map(review => ({ ...review, pr }));
                } catch (reviewError) {
                    console.warn(`Failed to fetch reviews for PR ${pr.number}:`, reviewError.message);
                    return [];
                }
            });
            
            const reviewResults = await Promise.allSettled(reviewPromises);
            
            // Collect all successful results
            reviewResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    reviews.push(...result.value);
                }
            });
            
            return reviews;
        } catch (error) {
            console.error('Error fetching reviews:', error.message);
            return [];
        }
    }

    async getUserCommits(username) {
        try {
            // Get organization repositories (cached for better performance)
            const reposCacheKey = cacheService.generateKey('github', 'org_repos', this.organization);
            let reposData = cacheService.get(reposCacheKey);
            
            if (!reposData) {
                const reposResponse = await this.client.get(`/orgs/${this.organization}/repos`, {
                    params: {
                        type: 'all',
                        sort: 'updated',
                        per_page: 50 // Reduced from 100
                    }
                });
                reposData = reposResponse.data;
                // Cache repos for 15 minutes since they don't change often
                cacheService.set(reposCacheKey, reposData, 15 * 60 * 1000);
            }
            
            const commits = [];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            // Limit to top 10 most recently updated repos for better performance
            const topRepos = reposData.slice(0, 10);
            
            // Use Promise.allSettled for parallel requests
            const commitPromises = topRepos.map(async repo => {
                try {
                    const commitResponse = await this.client.get(`/repos/${repo.full_name}/commits`, {
                        params: {
                            author: username,
                            since: thirtyDaysAgo.toISOString(),
                            per_page: 30 // Reduced from 50
                        }
                    });
                    
                    return commitResponse.data.map(commit => ({ ...commit, repository: repo }));
                } catch (commitError) {
                    console.warn(`Failed to fetch commits for repo ${repo.full_name}:`, commitError.message);
                    return [];
                }
            });
            
            const commitResults = await Promise.allSettled(commitPromises);
            
            // Collect all successful results
            commitResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    commits.push(...result.value);
                }
            });
            
            // Sort by date (most recent first)
            commits.sort((a, b) => new Date(b.commit.author.date) - new Date(a.commit.author.date));
            
            return commits;
        } catch (error) {
            console.error('Error fetching commits:', error.message);
            return [];
        }
    }

    formatPullRequests(pullRequests) {
        return pullRequests.map(pr => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            created: pr.created_at,
            updated: pr.updated_at,
            closed: pr.closed_at,
            merged: pr.pull_request?.merged_at,
            repository: {
                name: pr.repository_url.split('/').pop(),
                fullName: pr.repository_url.split('/').slice(-2).join('/')
            },
            url: pr.html_url,
            author: pr.user.login,
            labels: (pr.labels || []).map(label => label?.name).filter(Boolean),
            draft: pr.draft
        }));
    }

    formatReviews(reviews) {
        return reviews.map(review => ({
            id: review.id,
            state: review.state,
            submitted: review.submitted_at,
            body: review.body,
            pr: {
                number: review.pr.number,
                title: review.pr.title,
                repository: review.pr.repository_url.split('/').slice(-2).join('/'),
                url: review.pr.html_url
            }
        }));
    }

    formatCommits(commits) {
        return commits.map(commit => ({
            sha: commit.sha,
            message: commit.commit.message.split('\n')[0], // First line only
            date: commit.commit.author.date,
            repository: {
                name: commit.repository?.name || 'unknown',
                fullName: commit.repository?.full_name || 'unknown/unknown'
            },
            url: commit.html_url,
            additions: commit.stats?.additions || 0,
            deletions: commit.stats?.deletions || 0
        }));
    }

    calculateStats(pullRequests, reviews, commits) {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // PR stats
        const totalPRs = pullRequests.length;
        const openPRs = pullRequests.filter(pr => pr.state === 'open').length;
        const closedPRs = pullRequests.filter(pr => pr.state === 'closed').length;
        const mergedPRs = pullRequests.filter(pr => pr.merged_at).length;
        const draftPRs = pullRequests.filter(pr => pr.draft).length;
        
        // Recent PRs
        const recentPRs = pullRequests.filter(pr => {
            const created = new Date(pr.created_at);
            return created >= thirtyDaysAgo;
        }).length;

        // Review stats
        const totalReviews = reviews.length;
        const approvedReviews = reviews.filter(r => r.state === 'APPROVED').length;
        const requestedChanges = reviews.filter(r => r.state === 'CHANGES_REQUESTED').length;
        const commentReviews = reviews.filter(r => r.state === 'COMMENTED').length;
        
        // Recent reviews
        const recentReviews = reviews.filter(review => {
            const submitted = new Date(review.submitted_at);
            return submitted >= thirtyDaysAgo;
        }).length;

        // Commit stats
        const totalCommits = commits.length; // Already filtered to last 30 days
        const totalAdditions = commits.reduce((sum, commit) => sum + commit.additions, 0);
        const totalDeletions = commits.reduce((sum, commit) => sum + commit.deletions, 0);

        // Repository breakdown
        const prsByRepo = {};
        pullRequests.forEach(pr => {
            const repoName = pr.repository?.name || 'unknown';
            prsByRepo[repoName] = (prsByRepo[repoName] || 0) + 1;
        });

        const commitsByRepo = {};
        commits.forEach(commit => {
            const repoName = commit.repository?.name || 'unknown';
            commitsByRepo[repoName] = (commitsByRepo[repoName] || 0) + 1;
        });

        return {
            pullRequests: {
                total: totalPRs,
                open: openPRs,
                closed: closedPRs,
                merged: mergedPRs,
                draft: draftPRs,
                recent: recentPRs,
                mergeRate: totalPRs > 0 ? ((mergedPRs / totalPRs) * 100).toFixed(1) : 0
            },
            reviews: {
                total: totalReviews,
                approved: approvedReviews,
                changesRequested: requestedChanges,
                commented: commentReviews,
                recent: recentReviews
            },
            commits: {
                total: totalCommits,
                totalAdditions,
                totalDeletions,
                netLines: totalAdditions - totalDeletions,
                avgLinesPerCommit: totalCommits > 0 ? Math.round((totalAdditions + totalDeletions) / totalCommits) : 0
            },
            repositories: {
                prsByRepo,
                commitsByRepo,
                totalRepos: new Set([...Object.keys(prsByRepo), ...Object.keys(commitsByRepo)]).size
            }
        };
    }

    async getOrganizationRepos(useCache = true) {
        const cacheKey = cacheService.generateKey('github', 'org_repos_formatted', this.organization);
        
        // Check cache first
        if (useCache) {
            const cachedData = cacheService.get(cacheKey);
            if (cachedData) {
                console.log(`Cache hit for GitHub org repos: ${this.organization}`);
                return cachedData;
            }
        }

        try {
            console.log(`Fetching fresh GitHub org repos: ${this.organization}`);
            
            const response = await this.client.get(`/orgs/${this.organization}/repos`, {
                params: {
                    type: 'all',
                    sort: 'updated',
                    per_page: 50
                }
            });
            
            const result = response.data.map(repo => ({
                name: repo.name,
                fullName: repo.full_name,
                description: repo.description,
                language: repo.language,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                updated: repo.updated_at,
                url: repo.html_url
            }));

            // Cache for 15 minutes
            cacheService.set(cacheKey, result, 15 * 60 * 1000);
            
            return result;
        } catch (error) {
            console.error('Error fetching repositories:', error.response?.data || error.message);
            throw new Error(`Failed to fetch repositories: ${error.response?.data?.message || error.message}`);
        }
    }
}

module.exports = new GitHubService();