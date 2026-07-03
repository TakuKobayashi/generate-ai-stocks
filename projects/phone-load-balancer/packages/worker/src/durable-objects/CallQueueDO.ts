// Durable Object for managing per-tenant call queues
// Ensures atomic queue operations across requests

export type QueueEntry = {
  conversationId: string;
  callerNumber: string;
  tenantId: number;
  enqueuedAt: number;
  callLegId: number;
};

export class CallQueueDO {
  private state: DurableObjectState;
  private queues: Map<number, QueueEntry[]> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path === "/enqueue") {
      return this.handleEnqueue(request);
    } else if (request.method === "POST" && path === "/dequeue") {
      return this.handleDequeue(request);
    } else if (request.method === "POST" && path === "/remove") {
      return this.handleRemove(request);
    } else if (request.method === "GET" && path === "/queue") {
      return this.handleGetQueue(request);
    } else if (request.method === "GET" && path === "/position") {
      return this.handleGetPosition(request);
    }
    return new Response("Not found", { status: 404 });
  }

  private async loadQueues(): Promise<void> {
    const stored = await this.state.storage.get<
      Record<number, QueueEntry[]>
    >("queues");
    if (stored) {
      this.queues = new Map(
        Object.entries(stored).map(([k, v]) => [parseInt(k), v])
      );
    }
  }

  private async saveQueues(): Promise<void> {
    const obj: Record<number, QueueEntry[]> = {};
    for (const [k, v] of this.queues) {
      obj[k] = v;
    }
    await this.state.storage.put("queues", obj);
  }

  private async handleEnqueue(request: Request): Promise<Response> {
    await this.loadQueues();
    const entry = (await request.json()) as QueueEntry;
    const tenantQueue = this.queues.get(entry.tenantId) ?? [];
    tenantQueue.push(entry);
    this.queues.set(entry.tenantId, tenantQueue);
    await this.saveQueues();
    return Response.json({
      position: tenantQueue.length,
      queueLength: tenantQueue.length,
    });
  }

  private async handleDequeue(request: Request): Promise<Response> {
    await this.loadQueues();
    const { tenantId } = (await request.json()) as { tenantId: number };
    const tenantQueue = this.queues.get(tenantId) ?? [];
    if (tenantQueue.length === 0) {
      return Response.json({ entry: null });
    }
    const entry = tenantQueue.shift()!;
    this.queues.set(tenantId, tenantQueue);
    await this.saveQueues();
    return Response.json({ entry });
  }

  private async handleRemove(request: Request): Promise<Response> {
    await this.loadQueues();
    const { tenantId, conversationId } = (await request.json()) as {
      tenantId: number;
      conversationId: string;
    };
    const tenantQueue = this.queues.get(tenantId) ?? [];
    const filtered = tenantQueue.filter(
      (e) => e.conversationId !== conversationId
    );
    this.queues.set(tenantId, filtered);
    await this.saveQueues();
    return Response.json({ removed: tenantQueue.length - filtered.length });
  }

  private async handleGetQueue(request: Request): Promise<Response> {
    await this.loadQueues();
    const url = new URL(request.url);
    const tenantId = parseInt(url.searchParams.get("tenantId") ?? "0");
    const tenantQueue = this.queues.get(tenantId) ?? [];
    return Response.json({ queue: tenantQueue, length: tenantQueue.length });
  }

  private async handleGetPosition(request: Request): Promise<Response> {
    await this.loadQueues();
    const url = new URL(request.url);
    const tenantId = parseInt(url.searchParams.get("tenantId") ?? "0");
    const conversationId = url.searchParams.get("conversationId") ?? "";
    const tenantQueue = this.queues.get(tenantId) ?? [];
    const position = tenantQueue.findIndex(
      (e) => e.conversationId === conversationId
    );
    return Response.json({
      position: position >= 0 ? position + 1 : -1,
      queueLength: tenantQueue.length,
    });
  }
}
