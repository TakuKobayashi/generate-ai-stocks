import Asana from 'asana';
import { Task, TaskComment, DateRange } from '../../types';

export class AsanaService {
  private client: Asana.ApiClient;

  constructor(token: string) {
    this.client = new Asana.ApiClient({
      defaultHeaders: { 'asana-enable': 'new_user_task_lists' },
      logAsanaChangeWarnings: false,
    }).useAccessToken(token);
  }

  public async getCompletedTasks(dateRange: DateRange): Promise<Task[]> {
    try {
      const me = await this.client.users.me();
      const workspaces = await this.client.workspaces.findAll();
      const tasks: Task[] = [];

      for await (const workspace of workspaces) {
        const completedTasks = await this.client.tasks.findAll({
          assignee: me.gid,
          workspace: workspace.gid,
          completed_since: dateRange.start.toISOString(),
          opt_fields: 'name,completed_at,permalink_url,parent.name,parent.permalink_url',
        });

        for await (const task of completedTasks) {
          const completedAt = task.completed_at ? new Date(task.completed_at) : null;
          
          if (completedAt && completedAt >= dateRange.start && completedAt <= dateRange.end) {
            tasks.push({
              title: task.name || '',
              url: task.permalink_url || '',
              completedAt: completedAt,
              parent: task.parent ? {
                title: task.parent.name || '',
                url: task.parent.permalink_url || '',
              } : undefined,
            });
          }
        }
      }

      return tasks.sort((a, b) => 
        (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
      );
    } catch (error) {
      console.error('Failed to get completed tasks from Asana:', error);
      return [];
    }
  }

  public async getCreatedTasks(dateRange: DateRange): Promise<Task[]> {
    try {
      const me = await this.client.users.me();
      const workspaces = await this.client.workspaces.findAll();
      const tasks: Task[] = [];

      for await (const workspace of workspaces) {
        const createdTasks = await this.client.tasks.findAll({
          assignee: me.gid,
          workspace: workspace.gid,
          opt_fields: 'name,created_at,permalink_url,parent.name,parent.permalink_url',
        });

        for await (const task of createdTasks) {
          const createdAt = task.created_at ? new Date(task.created_at) : null;
          
          if (createdAt && createdAt >= dateRange.start && createdAt <= dateRange.end) {
            tasks.push({
              title: task.name || '',
              url: task.permalink_url || '',
              createdAt: createdAt,
              parent: task.parent ? {
                title: task.parent.name || '',
                url: task.parent.permalink_url || '',
              } : undefined,
            });
          }
        }
      }

      return tasks.sort((a, b) => 
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      );
    } catch (error) {
      console.error('Failed to get created tasks from Asana:', error);
      return [];
    }
  }

  public async getComments(dateRange: DateRange): Promise<TaskComment[]> {
    try {
      const me = await this.client.users.me();
      const workspaces = await this.client.workspaces.findAll();
      const comments: TaskComment[] = [];

      for await (const workspace of workspaces) {
        const tasks = await this.client.tasks.findAll({
          assignee: me.gid,
          workspace: workspace.gid,
          opt_fields: 'name,permalink_url',
        });

        for await (const task of tasks) {
          const stories = await this.client.stories.findByTask(task.gid, {
            opt_fields: 'created_at,created_by,text,type',
          });

          for await (const story of stories) {
            if (
              story.type === 'comment' &&
              story.created_by?.gid === me.gid &&
              story.created_at
            ) {
              const createdAt = new Date(story.created_at);
              
              if (createdAt >= dateRange.start && createdAt <= dateRange.end) {
                comments.push({
                  taskTitle: task.name || '',
                  taskUrl: task.permalink_url || '',
                  comment: story.text || '',
                  commentUrl: task.permalink_url || '',
                  date: createdAt,
                });
              }
            }
          }
        }
      }

      return comments.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('Failed to get comments from Asana:', error);
      return [];
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.client.users.me();
      return true;
    } catch {
      return false;
    }
  }
}
