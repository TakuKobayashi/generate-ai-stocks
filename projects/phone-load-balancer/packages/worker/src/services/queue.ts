import type { QueueEntry } from "../durable-objects/CallQueueDO";
import type { Env } from "../types";

function getQueueStub(env: Env): DurableObjectStub {
  const id = env.CALL_QUEUE.idFromName("global-queue");
  return env.CALL_QUEUE.get(id);
}

async function callDO<T>(
  stub: DurableObjectStub,
  path: string,
  method: "GET" | "POST",
  body?: object,
  searchParams?: Record<string, string>
): Promise<T> {
  let url = `https://do${path}`;
  if (searchParams) {
    const params = new URLSearchParams(searchParams);
    url += `?${params.toString()}`;
  }
  const response = await stub.fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json() as T;
}

export async function enqueueCall(
  env: Env,
  entry: QueueEntry
): Promise<{ position: number; queueLength: number }> {
  const stub = getQueueStub(env);
  return callDO(stub, "/enqueue", "POST", entry);
}

export async function dequeueCall(
  env: Env,
  tenantId: number
): Promise<{ entry: QueueEntry | null }> {
  const stub = getQueueStub(env);
  return callDO(stub, "/dequeue", "POST", { tenantId });
}

export async function removeFromQueue(
  env: Env,
  tenantId: number,
  conversationId: string
): Promise<void> {
  const stub = getQueueStub(env);
  await callDO(stub, "/remove", "POST", { tenantId, conversationId });
}

export async function getQueuePosition(
  env: Env,
  tenantId: number,
  conversationId: string
): Promise<{ position: number; queueLength: number }> {
  const stub = getQueueStub(env);
  return callDO(stub, "/position", "GET", undefined, {
    tenantId: String(tenantId),
    conversationId,
  });
}

export async function getQueueLength(
  env: Env,
  tenantId: number
): Promise<number> {
  const stub = getQueueStub(env);
  const result = await callDO<{ queue: QueueEntry[]; length: number }>(
    stub,
    "/queue",
    "GET",
    undefined,
    { tenantId: String(tenantId) }
  );
  return result.length;
}
