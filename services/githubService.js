const axios = require('axios');

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

    async getUserData(username) {
        try {
            // Get user's pull requests from organization repositories
            const pullRequests = await this.getUserPullRequests(username);
            
            // Get user's review activities
            const reviews = await this.getUserReviews(username);
            
            // Get user's commits
            const commits = await this.getUserCommits(username);
            
            return {
                pullRequests: this.formatPullRequests(pullRequests),
                reviews: this.formatReviews(reviews),
                commits: this.formatCommits(commits),
                stats: this.calculateStats(pullRequests, reviews, commits)
            };
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
                    per_page: 50
                }
            });
            
            const reviews = [];
            for (const pr of response.data.items || []) {
                try {
                    // Get review details for each PR
                    const reviewResponse = await this.client.get(`/repos/${pr.repository_url.split('/').slice(-2).join('/')}/pulls/${pr.number}/reviews`);
                    const userReviews = reviewResponse.data.filter(review => review.user.login === username);
                    reviews.push(...userReviews.map(review => ({ ...review, pr })));
                } catch (reviewError) {
                    // Continue if we can't get review details for a specific PR
                    continue;
                }
            }
            
            return reviews;
        } catch (error) {
            console.error('Error fetching reviews:', error.message);
            return [];
        }
    }

    async getUserCommits(username) {
        try {
            // Get organization repositories
            const reposResponse = await this.client.get(`/orgs/${this.organization}/repos`, {
                params: {
                    type: 'all',
                    per_page: 100
                }
            });
            
            const commits = [];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            // Get commits from each repository (limited to recent commits to avoid rate limiting)
            for (const repo of reposResponse.data.slice(0, 20)) { // Limit to first 20 repos to avoid rate limiting
                try {
                    const commitResponse = await this.client.get(`/repos/${repo.full_name}/commits`, {
                        params: {
                            author: username,
                            since: thirtyDaysAgo.toISOString(),
                            per_page: 50
                        }
                    });
                    
                    commits.push(...commitResponse.data.map(commit => ({ ...commit, repository: repo })));
                } catch (commitError) {
                    // Continue if we can't get commits for a specific repo
                    continue;
                }
            }
            
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

    async getOrganizationRepos() {
        try {
            const response = await this.client.get(`/orgs/${this.organization}/repos`, {
                params: {
                    type: 'all',
                    sort: 'updated',
                    per_page: 50
                }
            });
            
            return response.data.map(repo => ({
                name: repo.name,
                fullName: repo.full_name,
                description: repo.description,
                language: repo.language,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                updated: repo.updated_at,
                url: repo.html_url
            }));
        } catch (error) {
            console.error('Error fetching repositories:', error.response?.data || error.message);
            throw new Error(`Failed to fetch repositories: ${error.response?.data?.message || error.message}`);
        }
    }
}

module.exports = new GitHubService();