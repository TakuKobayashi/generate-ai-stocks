import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Room, Message } from '@chat-app/shared';

@Injectable({ providedIn: 'root' })
export class RoomService {
  constructor(private http: HttpClient) {}

  async list(): Promise<Room[]> {
    const res = await firstValueFrom(
      this.http.get<{ data: Room[] }>('/api/rooms')
    );
    return res.data;
  }

  async get(id: string): Promise<Room> {
    const res = await firstValueFrom(
      this.http.get<{ data: Room }>(`/api/rooms/${id}`)
    );
    return res.data;
  }

  async create(data: { name: string; description?: string }): Promise<Room> {
    const res = await firstValueFrom(
      this.http.post<{ data: Room }>('/api/rooms', data)
    );
    return res.data;
  }

  async update(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<Room> {
    const res = await firstValueFrom(
      this.http.put<{ data: Room }>(`/api/rooms/${id}`, data)
    );
    return res.data;
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/rooms/${id}`));
  }

  async messages(roomId: string): Promise<Message[]> {
    const res = await firstValueFrom(
      this.http.get<{ data: Message[] }>(`/api/rooms/${roomId}/messages`)
    );
    return res.data;
  }
}
