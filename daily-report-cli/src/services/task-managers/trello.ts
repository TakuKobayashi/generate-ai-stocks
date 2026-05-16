import axios from 'axios';
import { Task, TaskComment, DateRange } from '../../types';

interface TrelloAction {
  id: string;
  type: string;
  date: string;
  data: {
    card?: { id: string; name: string; url?: string; shortLink?: string };
    text?: string;
    list?: { id: string; name: string };
  };
}

export class TrelloService {
  private baseUrl = 'https://api.trello.com/1';
  private token: string;
  private apiKey: string;
  private userId: string | null = null;

  constructor(token: string, apiKey: string) {
    this.token = token;
    this.apiKey = apiKey;
  }

  private async getUserId(): Promise<string> {
    if (this.userId) {
      return this.userId;
    }

    const response = await axios.get(`${this.baseUrl}/members/me`, {
      params: { key: this.apiKey, token: this.token },
    });

    this.userId = response.data.id;
    return this.userId!;
  }

  public async getCompletedTasks(dateRange: DateRange): Promise<Task[]> {
    try {
      await this.getUserId();
      const tasks: Task[] = [];

      const response = await axios.get(`${this.baseUrl}/members/me/actions`, {
        params: {
          key: this.apiKey,
          token: this.token,
          filter: 'updateCard',
          since: dateRange.start.toISOString(),
          before: dateRange.end.toISOString(),
          limit: 1000,
        },
      });

      const actions: TrelloAction[] = response.data;

      for (const action of actions) {
        if (
          action.type === 'updateCard' &&
          action.data.list &&
          action.data.list.name.toLowerCase().includes('done')
        ) {
          const cardUrl = action.data.card?.shortLink
            ? `https://trello.com/c/${action.data.card.shortLink}`
            : action.data.card?.url || '';

          tasks.push({
            title: action.data.card?.name || '',
            url: cardUrl,
            completedAt: new Date(action.date),
          });
        }
      }

      return tasks.sort((a, b) => 
        (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
      );
    } catch (error) {
      console.error('Failed to get completed tasks from Trello:', error);
      return [];
    }
  }

  public async getCreatedTasks(dateRange: DateRange): Promise<Task[]> {
    try {
      await this.getUserId();
      const tasks: Task[] = [];

      const response = await axios.get(`${this.baseUrl}/members/me/actions`, {
        params: {
          key: this.apiKey,
          token: this.token,
          filter: 'createCard',
          since: dateRange.start.toISOString(),
          before: dateRange.end.toISOString(),
          limit: 1000,
        },
      });

      const actions: TrelloAction[] = response.data;

      for (const action of actions) {
        if (action.type === 'createCard' && action.data.card) {
          const cardUrl = action.data.card.shortLink
            ? `https://trello.com/c/${action.data.card.shortLink}`
            : action.data.card.url || '';

          tasks.push({
            title: action.data.card.name,
            url: cardUrl,
            createdAt: new Date(action.date),
          });
        }
      }

      return tasks.sort((a, b) => 
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      );
    } catch (error) {
      console.error('Failed to get created tasks from Trello:', error);
      return [];
    }
  }

  public async getComments(dateRange: DateRange): Promise<TaskComment[]> {
    try {
      await this.getUserId();
      const comments: TaskComment[] = [];

      const response = await axios.get(`${this.baseUrl}/members/me/actions`, {
        params: {
          key: this.apiKey,
          token: this.token,
          filter: 'commentCard',
          since: dateRange.start.toISOString(),
          before: dateRange.end.toISOString(),
          limit: 1000,
        },
      });

      const actions: TrelloAction[] = response.data;

      for (const action of actions) {
        if (action.type === 'commentCard' && action.data.card && action.data.text) {
          const cardUrl = action.data.card.shortLink
            ? `https://trello.com/c/${action.data.card.shortLink}`
            : action.data.card.url || '';

          comments.push({
            taskTitle: action.data.card.name,
            taskUrl: cardUrl,
            comment: action.data.text,
            commentUrl: cardUrl,
            date: new Date(action.date),
          });
        }
      }

      return comments.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('Failed to get comments from Trello:', error);
      return [];
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.getUserId();
      return true;
    } catch {
      return false;
    }
  }
}
