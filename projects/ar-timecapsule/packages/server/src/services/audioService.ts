import type { Database } from "../db";
import { AudioFileRepository } from "../repositories/audioFileRepository";
import { D1TimeCapsuleRepository } from "../repositories/timeCapsuleRepository";
import { generatePresignedUrl } from "../utils/signedUrl";
import { generateId } from "../utils/jwt";
import type { RequestUploadUrlInput, ConfirmUploadInput } from "../validators/audio";

type Config = { r2AccountId: string; r2AccessKeyId: string; r2SecretAccessKey: string; r2BucketName: string; maxFileSize: number; signedUrlExpiresIn: number };

export class AudioService {
  private readonly audioRepo: AudioFileRepository;
  private readonly capsuleRepo: D1TimeCapsuleRepository;
  constructor(private readonly db: Database, private readonly config: Config) {
    this.audioRepo  = new AudioFileRepository(db);
    this.capsuleRepo= new D1TimeCapsuleRepository(db);
  }
  async requestUploadUrl(userId: string, input: RequestUploadUrlInput) {
    if (input.fileSize > this.config.maxFileSize) throw Object.assign(new Error("File too large"), { code: "VALIDATION_ERROR" });
    const capsule = await this.capsuleRepo.findById(input.timeCapsuleId);
    if (!capsule) throw Object.assign(new Error("Capsule not found"), { code: "NOT_FOUND" });
    if (capsule.userId !== userId) throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    const r2Key = `audio/${userId}/${input.timeCapsuleId}/${generateId()}.audio`;
    const uploadUrl = await generatePresignedUrl({ accountId: this.config.r2AccountId, accessKeyId: this.config.r2AccessKeyId, secretAccessKey: this.config.r2SecretAccessKey, bucketName: this.config.r2BucketName, key: r2Key, expiresIn: this.config.signedUrlExpiresIn, method: "PUT", contentType: input.mimeType });
    const audioFile = await this.audioRepo.create({ timeCapsuleId: input.timeCapsuleId, r2Key, originalFileName: input.fileName, mimeType: input.mimeType, fileSize: input.fileSize, isConfirmed: false });
    return { audioFileId: audioFile.id, uploadUrl, r2Key, expiresAt: new Date(Date.now() + this.config.signedUrlExpiresIn * 1000).toISOString() };
  }
  async confirmUpload(userId: string, input: ConfirmUploadInput): Promise<void> {
    const af = await this.audioRepo.findById(input.audioFileId);
    if (!af) throw Object.assign(new Error("Audio file not found"), { code: "NOT_FOUND" });
    const capsule = await this.capsuleRepo.findById(af.timeCapsuleId);
    if (!capsule || capsule.userId !== userId) throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    if (af.isConfirmed) return;
    await this.audioRepo.confirm(af.id, input.durationSeconds);
    await this.capsuleRepo.updateMediaType(af.timeCapsuleId, "audio");
  }
}
