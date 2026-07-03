import { eq, and, asc } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import type { Env } from "../types";
import { VonageClient } from "./vonage";
import {
  unknownNumberNcco,
  noForwardNumbersNcco,
  allBusyQueuedNcco,
  forwardCallNcco,
  buildTalkJa,
} from "./ncco";
import {
  enqueueCall,
  dequeueCall,
  removeFromQueue,
  getQueueLength,
} from "./queue";

export class LoadBalancerService {
  private db: Db;
  private env: Env;
  private vonage: VonageClient;
  private baseUrl: string;

  constructor(db: Db, env: Env, baseUrl: string) {
    this.db = db;
    this.env = env;
    this.vonage = new VonageClient(
      env.VONAGE_APPLICATION_ID,
      env.VONAGE_PRIVATE_KEY
    );
    this.baseUrl = baseUrl;
  }

  // Called when Vonage answer webhook fires (inbound call arrived)
  async handleInboundCall(params: {
    uuid: string;
    conversation_uuid: string;
    from: string;
    to: string;
  }): Promise<object[]> {
    const { conversation_uuid, from, to } = params;

    // Find tenant by vonage number
    const tenant = await this.db.query.tenants.findFirst({
      where: and(
        eq(schema.tenants.vonageNumber, to),
        eq(schema.tenants.isActive, true)
      ),
    });

    if (!tenant) {
      // Unknown number
      await this.db.insert(schema.callLogs).values({
        callerNumber: from,
        vonageNumber: to,
        outcome: "unknown_number",
      });
      return unknownNumberNcco();
    }

    // Get available forward numbers (idle, ordered by priority)
    const forwardNumbers = await this.db.query.forwardNumbers.findMany({
      where: and(
        eq(schema.forwardNumbers.tenantId, tenant.id),
        eq(schema.forwardNumbers.isActive, true)
      ),
      orderBy: asc(schema.forwardNumbers.priority),
    });

    if (forwardNumbers.length === 0) {
      await this.db.insert(schema.callLogs).values({
        tenantId: tenant.id,
        callerNumber: from,
        vonageNumber: to,
        outcome: "no_forward_numbers",
      });
      return noForwardNumbersNcco();
    }

    const idleNumbers = forwardNumbers.filter((n) => n.status === "idle");

    if (idleNumbers.length === 0) {
      // All busy - queue the call
      const queueLength = await getQueueLength(this.env, tenant.id);

      // Create call leg in DB as queued
      const [callLeg] = await this.db
        .insert(schema.callLegs)
        .values({
          tenantId: tenant.id,
          inboundConversationId: conversation_uuid,
          callerNumber: from,
          status: "queued",
          queuePosition: queueLength + 1,
        })
        .returning();

      await enqueueCall(this.env, {
        conversationId: conversation_uuid,
        callerNumber: from,
        tenantId: tenant.id,
        enqueuedAt: Date.now(),
        callLegId: callLeg.id,
      });

      await this.db.insert(schema.callLogs).values({
        tenantId: tenant.id,
        callerNumber: from,
        vonageNumber: to,
        outcome: "all_busy",
      });

      return allBusyQueuedNcco(queueLength + 1);
    }

    // Forward to highest-priority idle number
    const target = idleNumbers[0];

    // Create call leg in DB
    const [callLeg] = await this.db
      .insert(schema.callLegs)
      .values({
        tenantId: tenant.id,
        inboundConversationId: conversation_uuid,
        callerNumber: from,
        forwardNumberId: target.id,
        status: "ringing",
      })
      .returning();

    // Mark number as busy
    await this.db
      .update(schema.forwardNumbers)
      .set({ status: "busy", updatedAt: new Date().toISOString() })
      .where(eq(schema.forwardNumbers.id, target.id));

    return forwardCallNcco(tenant.vonageNumber!, target.phoneNumber, this.baseUrl);
  }

  // Called when Vonage call event webhook fires
  async handleCallEvent(event: {
    uuid: string;
    conversation_uuid: string;
    status: string;
    direction: string;
    from?: string;
    to?: string;
    duration?: string;
  }): Promise<void> {
    const { uuid, conversation_uuid, status, direction, duration } = event;

    // Find call leg
    const callLeg = await this.db.query.callLegs.findFirst({
      where: eq(schema.callLegs.inboundConversationId, conversation_uuid),
    });

    if (!callLeg) return;

    if (direction === "outbound") {
      // Outbound leg (forwarded call) event
      if (status === "answered") {
        // Connected - update call leg status
        await this.db
          .update(schema.callLegs)
          .set({
            status: "connected",
            outboundCallUuid: uuid,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.callLegs.id, callLeg.id));
      } else if (
        status === "timeout" ||
        status === "unanswered" ||
        status === "failed" ||
        status === "busy" ||
        status === "rejected"
      ) {
        // Not answered within timeout - try next number
        await this.tryNextNumber(callLeg, event);
      } else if (status === "completed") {
        // Call ended
        await this.handleCallCompleted(callLeg, duration ? parseInt(duration) : 0);
      }
    } else if (direction === "inbound") {
      if (status === "completed") {
        // Caller hung up
        await this.handleCallCompleted(callLeg, duration ? parseInt(duration) : 0);
      }
    }
  }

  private async tryNextNumber(
    callLeg: typeof schema.callLegs.$inferSelect,
    event: { uuid: string; conversation_uuid: string }
  ): Promise<void> {
    // Free up current forward number
    if (callLeg.forwardNumberId) {
      await this.db
        .update(schema.forwardNumbers)
        .set({ status: "idle", updatedAt: new Date().toISOString() })
        .where(eq(schema.forwardNumbers.id, callLeg.forwardNumberId));
    }

    // Get tenant
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(schema.tenants.id, callLeg.tenantId),
    });
    if (!tenant) return;

    // Get next available idle number (excluding current)
    const forwardNumbers = await this.db.query.forwardNumbers.findMany({
      where: and(
        eq(schema.forwardNumbers.tenantId, callLeg.tenantId),
        eq(schema.forwardNumbers.isActive, true),
        eq(schema.forwardNumbers.status, "idle")
      ),
      orderBy: asc(schema.forwardNumbers.priority),
    });

    // Filter out the one we just tried
    const candidates = forwardNumbers.filter(
      (n) => n.id !== callLeg.forwardNumberId
    );

    if (candidates.length === 0) {
      // No more numbers to try - let it ring on the last number
      // (no action needed - the inbound call is still alive)
      // Update call leg to reflect no more forward targets
      await this.db
        .update(schema.callLegs)
        .set({
          status: "ringing",
          forwardNumberId: null,
          outboundCallUuid: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.callLegs.id, callLeg.id));
      return;
    }

    const nextTarget = candidates[0];

    // Update call leg
    await this.db
      .update(schema.callLegs)
      .set({
        forwardNumberId: nextTarget.id,
        outboundCallUuid: null,
        status: "ringing",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.callLegs.id, callLeg.id));

    // Mark next number as busy
    await this.db
      .update(schema.forwardNumbers)
      .set({ status: "busy", updatedAt: new Date().toISOString() })
      .where(eq(schema.forwardNumbers.id, nextTarget.id));

    // Transfer inbound call to next number via Vonage
    try {
      // Get the inbound call UUID - we need to transfer via the answer webhook
      // Transfer using NCCO update
      await this.vonage.transferCall(
        callLeg.inboundConversationId,
        forwardCallNcco(tenant.vonageNumber!, nextTarget.phoneNumber, this.baseUrl)
      );
    } catch (err) {
      console.error("Failed to transfer call:", err);
    }
  }

  private async handleCallCompleted(
    callLeg: typeof schema.callLegs.$inferSelect,
    durationSeconds: number
  ): Promise<void> {
    // Free up the forward number
    if (callLeg.forwardNumberId) {
      await this.db
        .update(schema.forwardNumbers)
        .set({ status: "idle", updatedAt: new Date().toISOString() })
        .where(eq(schema.forwardNumbers.id, callLeg.forwardNumberId));
    }

    // Update call leg
    await this.db
      .update(schema.callLegs)
      .set({
        status: "completed",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.callLegs.id, callLeg.id));

    // Remove from queue if queued
    await removeFromQueue(
      this.env,
      callLeg.tenantId,
      callLeg.inboundConversationId
    );

    // Update call log
    await this.db
      .update(schema.callLogs)
      .set({ durationSeconds })
      .where(
        and(
          eq(schema.callLogs.tenantId, callLeg.tenantId),
          eq(schema.callLogs.callerNumber, callLeg.callerNumber)
        )
      );

    // Check queue for next caller
    await this.processQueue(callLeg.tenantId);
  }

  // Process queue when a number becomes available
  async processQueue(tenantId: number): Promise<void> {
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
    });
    if (!tenant) return;

    // Dequeue next caller
    const { entry } = await dequeueCall(this.env, tenantId);
    if (!entry) return;

    // Find idle forward number
    const idleNumbers = await this.db.query.forwardNumbers.findMany({
      where: and(
        eq(schema.forwardNumbers.tenantId, tenantId),
        eq(schema.forwardNumbers.isActive, true),
        eq(schema.forwardNumbers.status, "idle")
      ),
      orderBy: asc(schema.forwardNumbers.priority),
    });

    if (idleNumbers.length === 0) {
      // Put back in queue
      await enqueueCall(this.env, entry);
      return;
    }

    const target = idleNumbers[0];

    // Update call leg
    await this.db
      .update(schema.callLegs)
      .set({
        status: "ringing",
        forwardNumberId: target.id,
        queuePosition: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.callLegs.id, entry.callLegId));

    // Mark number busy
    await this.db
      .update(schema.forwardNumbers)
      .set({ status: "busy", updatedAt: new Date().toISOString() })
      .where(eq(schema.forwardNumbers.id, target.id));

    // Transfer the waiting call
    try {
      await this.vonage.transferCall(
        entry.conversationId,
        forwardCallNcco(tenant.vonageNumber!, target.phoneNumber, this.baseUrl)
      );
    } catch (err) {
      console.error("Failed to forward queued call:", err);
    }
  }
}
