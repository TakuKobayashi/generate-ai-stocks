import * as Asana from 'asana';
import { Task, TaskComment, DateRange } from '../../types';

export class AsanaService {
  private client: any;

  constructor(token: string) {
    this.client = Asana.ApiClient.instance;
    const token_auth = this.client.authentications['token'];
    token_auth.accessToken = token;
  }

  public async getCompletedTasks(dateRange: DateRange): Promise<Task[]> {
    try {
      const usersApi = new Asana.UsersApi();
      const workspacesApi = new Asana.WorkspacesApi();
      const tasksApi = new Asana.TasksApi();
      
      const me = await usersApi.getUser('me');
      const workspaces = await workspacesApi.getWorkspaces();
      const tasks: Task[] = [];

      for (const workspace of workspaces.data) {
        const opts = {
          assignee: me.gid,
          workspace: workspace.gid,
          completed_since: dateRange.start.toISOString(),
          opt_fields: 'name,completed_at,permalink_url,parent.name,parent.permalink_url',
        };

        const completedTasks = await tasksApi.getTasks(opts);

        for (const task of completedTasks.data) {
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
      const usersApi = new Asana.UsersApi();
      const workspacesApi = new Asana.WorkspacesApi();
      const tasksApi = new Asana.TasksApi();
      
      const me = await usersApi.getUser('me');
      const workspaces = await workspacesApi.getWorkspaces();
      const tasks: Task[] = [];

      for (const workspace of workspaces.data) {
        const opts = {
          assignee: me.gid,
          workspace: workspace.gid,
          opt_fields: 'name,created_at,permalink_url,parent.name,parent.permalink_url',
        };

        const createdTasks = await tasksApi.getTasks(opts);

        for (const task of createdTasks.data) {
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
      const usersApi = new Asana.UsersApi();
      const workspacesApi = new Asana.WorkspacesApi();
      const tasksApi = new Asana.TasksApi();
      const storiesApi = new Asana.StoriesApi();
      
      const me = await usersApi.getUser('me');
      const workspaces = await workspacesApi.getWorkspaces();
      const comments: TaskComment[] = [];

      for (const workspace of workspaces.data) {
        const opts = {
          assignee: me.gid,
          workspace: workspace.gid,
          opt_fields: 'name,permalink_url',
        };

        const tasks = await tasksApi.getTasks(opts);

        for (const task of tasks.data) {
          const storiesOpts = {
            opt_fields: 'created_at,created_by,text,type',
          };
          
          const stories = await storiesApi.getStoriesForTask(task.gid, storiesOpts);

          for (const story of stories.data) {
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
      const usersApi = new Asana.UsersApi();
      await usersApi.getUser('me');
      return true;
    } catch {
      return false;
    }
  }
}
