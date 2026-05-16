import axios from 'axios';
import { Task, DateRange } from '../../types';

interface GoogleTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  completed?: string;
  updated?: string;
  parent?: string;
}

interface GoogleTaskList {
  id: string;
  title: string;
}

export class GoogleTasksService {
  private baseUrl = 'https://tasks.googleapis.com/tasks/v1';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async getTaskLists(): Promise<GoogleTaskList[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/users/@me/lists`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return response.data.items || [];
    } catch (error) {
      console.error('Failed to get task lists:', error);
      return [];
    }
  }

  public async getCompletedTasks(dateRange: DateRange): Promise<Task[]> {
    try {
      const taskLists = await this.getTaskLists();
      const tasks: Task[] = [];

      for (const list of taskLists) {
        const response = await axios.get(
          `${this.baseUrl}/lists/${list.id}/tasks`,
          {
            headers: { Authorization: `Bearer ${this.token}` },
            params: { showCompleted: true, showHidden: true },
          }
        );

        const tasksData: GoogleTask[] = response.data.items || [];
        const taskMap = new Map(tasksData.map(t => [t.id, t]));

        for (const task of tasksData) {
          if (task.status === 'completed' && task.completed) {
            const completedAt = new Date(task.completed);

            if (completedAt >= dateRange.start && completedAt <= dateRange.end) {
              let parent;
              if (task.parent) {
                const parentTask = taskMap.get(task.parent);
                if (parentTask) {
                  parent = {
                    title: parentTask.title,
                    url: this.buildTaskUrl(list.id, parentTask.id),
                  };
                }
              }

              tasks.push({
                title: task.title,
                url: this.buildTaskUrl(list.id, task.id),
                completedAt,
                parent,
              });
            }
          }
        }
      }

      return tasks.sort((a, b) => 
        (b.completedAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      );
    } catch (error) {
      console.error('Failed to get completed tasks from Google Tasks:', error);
      return [];
    }
  }

  public async getCreatedTasks(dateRange: DateRange): Promise<Task[]> {
    try {
      const taskLists = await this.getTaskLists();
      const tasks: Task[] = [];

      for (const list of taskLists) {
        const response = await axios.get(
          `${this.baseUrl}/lists/${list.id}/tasks`,
          {
            headers: { Authorization: `Bearer ${this.token}` },
            params: { showCompleted: true, showHidden: true },
          }
        );

        const tasksData: GoogleTask[] = response.data.items || [];
        const taskMap = new Map(tasksData.map(t => [t.id, t]));

        for (const task of tasksData) {
          if (task.updated) {
            const createdAt = new Date(task.updated);

            if (createdAt >= dateRange.start && createdAt <= dateRange.end) {
              let parent;
              if (task.parent) {
                const parentTask = taskMap.get(task.parent);
                if (parentTask) {
                  parent = {
                    title: parentTask.title,
                    url: this.buildTaskUrl(list.id, parentTask.id),
                  };
                }
              }

              tasks.push({
                title: task.title,
                url: this.buildTaskUrl(list.id, task.id),
                createdAt,
                parent,
              });
            }
          }
        }
      }

      return tasks.sort((a, b) => 
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      );
    } catch (error) {
      console.error('Failed to get created tasks from Google Tasks:', error);
      return [];
    }
  }

  private buildTaskUrl(listId: string, taskId: string): string {
    return `https://tasks.google.com/task/${taskId}?list=${listId}`;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.getTaskLists();
      return true;
    } catch {
      return false;
    }
  }
}
