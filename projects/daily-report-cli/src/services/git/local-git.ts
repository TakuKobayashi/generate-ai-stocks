import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import { GitCommit, DateRange } from '../../types';

export class LocalGitService {
  private git: SimpleGit;

  constructor(private repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  private async getRepositoryName(): Promise<string> {
    try {
      const remotes = await this.git.getRemotes(true);
      if (remotes.length > 0 && remotes[0].refs.fetch) {
        const url = remotes[0].refs.fetch;
        const match = url.match(/\/([^\/]+?)(\.git)?$/);
        if (match) {
          return match[1];
        }
      }
    } catch (error) {
      // リモートがない場合
    }

    return path.basename(this.repoPath);
  }

  public async getCommits(dateRange: DateRange): Promise<GitCommit[]> {
    try {
      const repositoryName = await this.getRepositoryName();
      
      const log: LogResult = await this.git.log({
        '--since': dateRange.start.toISOString(),
        '--until': dateRange.end.toISOString(),
        '--all': null,
      });

      const commits: GitCommit[] = [];

      for (const commit of log.all) {
        const branchesContaining = await this.git.raw([
          'branch',
          '-a',
          '--contains',
          commit.hash,
        ]);

        const branches = branchesContaining
          .split('\n')
          .map(b => b.trim().replace(/^\* /, '').replace(/^remotes\/origin\//, ''))
          .filter(b => b && !b.includes('HEAD'));

        const branch = branches[0] || 'unknown';

        commits.push({
          message: commit.message,
          date: new Date(commit.date),
          branch: branch,
          repository: repositoryName,
          hash: commit.hash,
        });
      }

      return commits;
    } catch (error) {
      console.error('Failed to get commits from local git:', error);
      return [];
    }
  }

  public async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }
}

export class MultiRepoGitService {
  private repos: LocalGitService[] = [];

  constructor(private basePath: string = process.cwd()) {
    this.scanRepositories();
  }

  private scanRepositories(): void {
    // カレントディレクトリがGitリポジトリかチェック
    const currentRepo = new LocalGitService(this.basePath);
    this.repos.push(currentRepo);
  }

  public addRepository(repoPath: string): void {
    this.repos.push(new LocalGitService(repoPath));
  }

  public async getAllCommits(dateRange: DateRange): Promise<GitCommit[]> {
    const allCommits: GitCommit[] = [];

    for (const repo of this.repos) {
      if (await repo.isGitRepository()) {
        const commits = await repo.getCommits(dateRange);
        allCommits.push(...commits);
      }
    }

    return allCommits.sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}
