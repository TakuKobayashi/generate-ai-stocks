import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { reports, type NewReport, type Report } from "../db/schema";
import { generateId } from "../utils/jwt";

export class ReportRepository {
  constructor(private readonly db: Database) {}
  async findByUserAndCapsule(reporterId: string, timeCapsuleId: string): Promise<Report | null> {
    return (await this.db.select().from(reports).where(and(eq(reports.reporterId, reporterId), eq(reports.timeCapsuleId, timeCapsuleId))).limit(1).all())[0] ?? null;
  }
  async create(data: Omit<NewReport, "id" | "createdAt">): Promise<Report> {
    const id = generateId(), now = new Date().toISOString();
    await this.db.insert(reports).values({ id, ...data, createdAt: now });
    const r = (await this.db.select().from(reports).where(eq(reports.id, id)).limit(1).all())[0];
    if (!r) throw new Error("Failed to create report");
    return r;
  }
}
