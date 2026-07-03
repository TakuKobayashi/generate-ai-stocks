import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import type { Env } from "../types";
import { createDb, schema } from "../db";
import { authMiddleware } from "../middleware/auth";

const forwardNumbers = new Hono<{ Bindings: Env }>();

forwardNumbers.use("*", authMiddleware);

// GET /api/tenants/:tenantId/forward-numbers
forwardNumbers.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = parseInt(c.req.param("tenantId"));

  const numbers = await db.query.forwardNumbers.findMany({
    where: eq(schema.forwardNumbers.tenantId, tenantId),
    orderBy: asc(schema.forwardNumbers.priority),
  });
  return c.json(numbers);
});

// POST /api/tenants/:tenantId/forward-numbers
forwardNumbers.post("/", async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = parseInt(c.req.param("tenantId"));
  const body = await c.req.json<{
    phoneNumber: string;
    priority: number;
  }>();

  if (!body.phoneNumber) return c.json({ error: "phoneNumber is required" }, 400);
  if (!body.priority || body.priority < 1)
    return c.json({ error: "priority must be >= 1" }, 400);

  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId),
  });
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  const [num] = await db
    .insert(schema.forwardNumbers)
    .values({
      tenantId,
      phoneNumber: body.phoneNumber,
      priority: body.priority,
    })
    .returning();

  return c.json(num, 201);
});

// PUT /api/tenants/:tenantId/forward-numbers/:id
forwardNumbers.put("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = parseInt(c.req.param("tenantId"));
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{
    phoneNumber?: string;
    priority?: number;
    isActive?: boolean;
  }>();

  const existing = await db.query.forwardNumbers.findFirst({
    where: and(
      eq(schema.forwardNumbers.id, id),
      eq(schema.forwardNumbers.tenantId, tenantId)
    ),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const [updated] = await db
    .update(schema.forwardNumbers)
    .set({
      ...(body.phoneNumber !== undefined && { phoneNumber: body.phoneNumber }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.forwardNumbers.id, id),
        eq(schema.forwardNumbers.tenantId, tenantId)
      )
    )
    .returning();

  return c.json(updated);
});

// DELETE /api/tenants/:tenantId/forward-numbers/:id
forwardNumbers.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = parseInt(c.req.param("tenantId"));
  const id = parseInt(c.req.param("id"));

  await db
    .delete(schema.forwardNumbers)
    .where(
      and(
        eq(schema.forwardNumbers.id, id),
        eq(schema.forwardNumbers.tenantId, tenantId)
      )
    );

  return c.json({ message: "Deleted" });
});

export default forwardNumbers;
