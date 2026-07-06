import type { Database } from "../db";
import { ReportRepository } from "../repositories/reportRepository";
import { D1TimeCapsuleRepository } from "../repositories/timeCapsuleRepository";
import type { CreateReportInput } from "../validators/report";

export class ReportService {
  private readonly reportRepo: ReportRepository;
  private readonly capsuleRepo: D1TimeCapsuleRepository;
  constructor(private readonly db: Database) {
    this.reportRepo = new ReportRepository(db);
    this.capsuleRepo= new D1TimeCapsuleRepository(db);
  }
  async create(userId: string, timeCapsuleId: string, input: CreateReportInput) {
    const capsule = await this.capsuleRepo.findById(timeCapsuleId);
    if (!capsule || capsule.status === "removed") throw Object.assign(new Error("Capsule not found"), { code: "NOT_FOUND" });
    if (capsule.userId === userId) throw Object.assign(new Error("Cannot report own capsule"), { code: "FORBIDDEN" });
    if (await this.reportRepo.findByUserAndCapsule(userId, timeCapsuleId)) throw Object.assign(new Error("Already reported"), { code: "ALREADY_REPORTED" });
    const report = await this.reportRepo.create({ timeCapsuleId, reporterId: userId, reason: input.reason, detail: input.detail, status: "pending" });
    await this.capsuleRepo.incrementReportCount(timeCapsuleId);
    const updated = await this.capsuleRepo.findById(timeCapsuleId);
    if (updated && updated.reportCount >= 5) await this.capsuleRepo.softDelete(timeCapsuleId);
    return { id: report.id, status: report.status };
  }
}
