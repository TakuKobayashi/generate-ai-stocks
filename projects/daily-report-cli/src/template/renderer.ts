import Handlebars from 'handlebars';
import * as fs from 'fs';
import { DailyReportData } from '../types';
import { format } from 'date-fns';

export class TemplateRenderer {
  private template: HandlebarsTemplateDelegate;

  constructor(templatePath: string) {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    this.registerHelpers();
    this.template = Handlebars.compile(templateContent);
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('formatDate', (date: Date, formatStr: string) => {
      if (!date) return '';
      return format(new Date(date), formatStr || 'yyyy-MM-dd HH:mm:ss');
    });

    Handlebars.registerHelper('firstLine', (text: string) => {
      if (!text) return '';
      return text.split('\n')[0];
    });

    Handlebars.registerHelper('link', (url: string, text: string) => {
      if (!url) return text || '';
      return `[${text || url}](${url})`;
    });

    Handlebars.registerHelper('hasItems', function(array: any[]) {
      return array && array.length > 0;
    });

    Handlebars.registerHelper('taskHierarchy', function(task: any) {
      if (task.parent) {
        return `  - ${task.parent.title}\n    - ${task.title}`;
      }
      return `- ${task.title}`;
    });
  }

  public render(data: DailyReportData): string {
    return this.template(data);
  }
}

export function createDefaultTemplate(outputPath: string): void {
  const defaultTemplate = `# 日報 - {{date}}

## Git コミット

{{#if (hasItems git.commits)}}
{{#each git.commits}}
- [{{repository}}] {{firstLine message}}
  - ブランチ: {{branch}}
  - 日時: {{formatDate date "yyyy-MM-dd HH:mm"}}
  - ハッシュ: {{hash}}
{{/each}}
{{else}}
本日のコミットはありません。
{{/if}}

## GitHub

### コミット

{{#if (hasItems github.commits)}}
{{#each github.commits}}
- {{{link commitUrl (firstLine message)}}}
  - リポジトリ: {{{link repositoryUrl repository}}}
  - ブランチ: {{{link branchUrl branch}}}
  - 日時: {{formatDate date "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日のGitHubコミットはありません。
{{/if}}

### プルリクエストコメント

{{#if (hasItems github.prComments)}}
{{#each github.prComments}}
- {{{link prUrl prTitle}}}
  - コメント: {{comment}}
  - 日時: {{formatDate date "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日のPRコメントはありません。
{{/if}}

## タスク管理

### Asana

#### 完了したタスク

{{#if (hasItems asana.completedTasks)}}
{{#each asana.completedTasks}}
{{taskHierarchy this}}
  - URL: {{url}}
  - 完了日時: {{formatDate completedAt "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日完了したタスクはありません。
{{/if}}

#### 作成したタスク

{{#if (hasItems asana.createdTasks)}}
{{#each asana.createdTasks}}
{{taskHierarchy this}}
  - URL: {{url}}
  - 作成日時: {{formatDate createdAt "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日作成したタスクはありません。
{{/if}}

#### コメント

{{#if (hasItems asana.comments)}}
{{#each asana.comments}}
- タスク: {{{link taskUrl taskTitle}}}
  - コメント: {{comment}}
  - 日時: {{formatDate date "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日のコメントはありません。
{{/if}}

### Google Tasks

#### 完了したタスク

{{#if (hasItems googleTasks.completedTasks)}}
{{#each googleTasks.completedTasks}}
{{taskHierarchy this}}
  - URL: {{url}}
  - 完了日時: {{formatDate completedAt "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日完了したタスクはありません。
{{/if}}

#### 作成したタスク

{{#if (hasItems googleTasks.createdTasks)}}
{{#each googleTasks.createdTasks}}
{{taskHierarchy this}}
  - URL: {{url}}
  - 作成日時: {{formatDate createdAt "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日作成したタスクはありません。
{{/if}}

### Trello

#### 完了したタスク

{{#if (hasItems trello.completedTasks)}}
{{#each trello.completedTasks}}
- {{{link url title}}}
  - 完了日時: {{formatDate completedAt "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日完了したタスクはありません。
{{/if}}

#### 作成したタスク

{{#if (hasItems trello.createdTasks)}}
{{#each trello.createdTasks}}
- {{{link url title}}}
  - 作成日時: {{formatDate createdAt "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日作成したタスクはありません。
{{/if}}

#### コメント

{{#if (hasItems trello.comments)}}
{{#each trello.comments}}
- タスク: {{{link taskUrl taskTitle}}}
  - コメント: {{comment}}
  - 日時: {{formatDate date "yyyy-MM-dd HH:mm"}}
{{/each}}
{{else}}
本日のコメントはありません。
{{/if}}
`;

  fs.writeFileSync(outputPath, defaultTemplate, 'utf-8');
}
