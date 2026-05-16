export interface Config {
  templatePath?: string;
  outputDir?: string;
  timezone?: string;
}

export interface TokenStorage {
  github?: string;
  asana?: string;
  googleTasks?: string;
  trello?: string;
}

export interface GitCommit {
  message: string;
  date: Date;
  branch: string;
  repository: string;
  hash: string;
}

export interface GitHubCommit {
  message: string;
  date: Date;
  branch: string;
  branchUrl: string;
  repository: string;
  repositoryUrl: string;
  hash: string;
  commitUrl: string;
}

export interface GitHubPRComment {
  prTitle: string;
  prUrl: string;
  comment: string;
  commentUrl: string;
  date: Date;
}

export interface Task {
  title: string;
  url: string;
  completedAt?: Date;
  createdAt?: Date;
  parent?: TaskParent;
}

export interface TaskParent {
  title: string;
  url: string;
}

export interface TaskComment {
  taskTitle: string;
  taskUrl: string;
  comment: string;
  commentUrl: string;
  date: Date;
}

export interface DailyReportData {
  date: string;
  git: {
    commits: GitCommit[];
  };
  github: {
    commits: GitHubCommit[];
    prComments: GitHubPRComment[];
  };
  asana: {
    completedTasks: Task[];
    createdTasks: Task[];
    comments: TaskComment[];
  };
  googleTasks: {
    completedTasks: Task[];
    createdTasks: Task[];
  };
  trello: {
    completedTasks: Task[];
    createdTasks: Task[];
    comments: TaskComment[];
  };
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export interface DateRange {
  start: Date;
  end: Date;
}
