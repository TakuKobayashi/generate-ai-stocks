import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { audioFiles, type AudioFile, type NewAudioFile } from "../db/schema";
import { generateId } from "../utils/jwt";

export class AudioFileRepository {
  constructor(private readonly db: Database) {}
  async findById(id: string): Promise<AudioFile | null> {
    return (await this.db.select().from(audioFiles).where(eq(audioFiles.id, id)).limit(1).all())[0] ?? null;
  }
  async findByTimeCapsuleId(tcId: string): Promise<AudioFile | null> {
    return (await this.db.select().from(audioFiles).where(eq(audioFiles.timeCapsuleId, tcId)).limit(1).all())[0] ?? null;
  }
  async create(data: Omit<NewAudioFile, "id" | "createdAt">): Promise<AudioFile> {
    const id = generateId(), now = new Date().toISOString();
    await this.db.insert(audioFiles).values({ id, ...data, createdAt: now });
    const r = await this.findById(id);
    if (!r) throw new Error("Failed to create audio file");
    return r;
  }
  async confirm(id: string, durationSeconds?: number): Promise<void> {
    await this.db.update(audioFiles).set({ isConfirmed: true, ...(durationSeconds !== undefined ? { durationSeconds } : {}) }).where(eq(audioFiles.id, id));
  }
}
