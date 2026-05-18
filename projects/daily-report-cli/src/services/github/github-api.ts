import { Octokit } from 'octokit';
import { GitHubCommit, GitHubPRComment, DateRange } from '../../types';

export class GitHubService {
  private octokit: Octokit;
  private username: string | null = null;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  private async getUsername(): Promise<string> {
    if (this.username) {
      return this.username;
    }

    const { data } = await this.octokit.rest.users.getAuthenticated();
    this.username = data.login;
    return this.username;
  }

  public async getCommits(dateRange: DateRange): Promise<GitHubCommit[]> {
    try {
      const username = await this.getUsername();
      const commits: GitHubCommit[] = [];

      const { data: searchResults } = await this.octokit.rest.search.commits({
        q: `author:${username} committer-date:${this.formatDate(dateRange.start)}..${this.formatDate(dateRange.end)}`,
        sort: 'committer-date',
        order: 'desc',
        per_page: 100,
      });

      for (const item of searchResults.items) {
        const repoFullName = item.repository.full_name;
        const [owner, repo] = repoFullName.split('/');

        // ブランチ情報を取得
        const branches = await this.getBranchesForCommit(owner, repo, item.sha);

        // 日付の取得（committerがnullの場合はauthorを使用）
        const commitDate = item.commit.committer?.date || item.commit.author?.date;
        if (!commitDate) continue;

        commits.push({
          message: item.commit.message,
          date: new Date(commitDate),
          branch: branches[0] || 'unknown',
          branchUrl: branches[0] 
            ? `https://github.com/${repoFullName}/tree/${branches[0]}`
            : '',
          repository: repo,
          repositoryUrl: item.repository.html_url,
          hash: item.sha,
          commitUrl: item.html_url,
        });
      }

      return commits;
    } catch (error) {
      console.error('Failed to get GitHub commits:', error);
      return [];
    }
  }

  private async getBranchesForCommit(
    owner: string,
    repo: string,
    sha: string
  ): Promise<string[]> {
    try {
      const { data } = await this.octokit.rest.repos.listBranchesForHeadCommit({
        owner,
        repo,
        commit_sha: sha,
      });

      return data.map(branch => branch.name);
    } catch (error) {
      return [];
    }
  }

  public async getPRComments(dateRange: DateRange): Promise<GitHubPRComment[]> {
    try {
      const username = await this.getUsername();
      const comments: GitHubPRComment[] = [];

      // Issue comments (PR comments are also issues)
      const { data: searchResults } = await this.octokit.rest.search.issuesAndPullRequests({
        q: `commenter:${username} is:pr created:${this.formatDate(dateRange.start)}..${this.formatDate(dateRange.end)}`,
        sort: 'created',
        order: 'desc',
        per_page: 100,
      });

      for (const pr of searchResults.items) {
        const repoFullName = pr.repository_url.split('/repos/')[1];
        const [owner, repo] = repoFullName.split('/');

        // PRのコメントを取得
        const { data: prComments } = await this.octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: pr.number,
          per_page: 100,
        });

        const userComments = prComments.filter(comment => {
          const commentDate = new Date(comment.created_at);
          return (
            comment.user?.login === username &&
            commentDate >= dateRange.start &&
            commentDate <= dateRange.end
          );
        });

        for (const comment of userComments) {
          comments.push({
            prTitle: pr.title,
            prUrl: pr.html_url,
            comment: comment.body || '',
            commentUrl: comment.html_url,
            date: new Date(comment.created_at),
          });
        }
      }

      return comments.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('Failed to get PR comments:', error);
      return [];
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.getUsername();
      return true;
    } catch {
      return false;
    }
  }
}
