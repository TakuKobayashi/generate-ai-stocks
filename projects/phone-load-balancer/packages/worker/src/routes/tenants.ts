import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { Env } from "../types";
import { createDb, schema } from "../db";
import { authMiddleware } from "../middleware/auth";

const tenants = new Hono<{ Bindings: Env }>();

tenants.use("*", authMiddleware);

// GET /api/tenants
tenants.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const list = await db.query.tenants.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return c.json(list);
});

// GET /api/tenants/:id
tenants.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const id = parseInt(c.req.param("id"));
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, id),
  });
  if (!tenant) return c.json({ error: "Not found" }, 404);
  return c.json(tenant);
});

// POST /api/tenants
tenants.post("/", async (c) => {
  const db = createDb(c.env.DB);
  const body = await c.req.json<{
    name: string;
    vonageNumber?: string;
    vonageAppId?: string;
  }>();

  if (!body.name) return c.json({ error: "Name is required" }, 400);

  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      name: body.name,
      vonageNumber: body.vonageNumber ?? null,
      vonageAppId: body.vonageAppId ?? null,
    })
    .returning();

  return c.json(tenant, 201);
});

// PUT /api/tenants/:id
tenants.put("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{
    name?: string;
    vonageNumber?: string;
    vonageAppId?: string;
    isActive?: boolean;
  }>();

  const existing = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, id),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const [updated] = await db
    .update(schema.tenants)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.vonageNumber !== undefined && {
        vonageNumber: body.vonageNumber,
      }),
      ...(body.vonageAppId !== undefined && { vonageAppId: body.vonageAppId }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenants.id, id))
    .returning();

  return c.json(updated);
});

// DELETE /api/tenants/:id
tenants.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const id = parseInt(c.req.param("id"));

  await db.delete(schema.tenants).where(eq(schema.tenants.id, id));
  return c.json({ message: "Deleted" });
});

export default tenants;
