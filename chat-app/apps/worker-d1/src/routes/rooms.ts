import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { getDB } from "../db";
import { rooms } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { generateId } from "../utils/crypto";

type Variables = { userId: string; displayName: string; email: string };

const roomsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

roomsRoute.use("*", authMiddleware);

// List all rooms
roomsRoute.get("/", async (c) => {
  const db = getDB(c.env.DB);
  const all = await db.select().from(rooms).all();
  return c.json({ data: all });
});

// Get single room
roomsRoute.get("/:id", async (c) => {
  const db = getDB(c.env.DB);
  const room = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, c.req.param("id")))
    .get();
  if (!room) return c.json({ error: "Room not found" }, 404);
  return c.json({ data: room });
});

// Create room
roomsRoute.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    })
  ),
  async (c) => {
    const { name, description } = c.req.valid("json");
    const db = getDB(c.env.DB);
    const now = new Date().toISOString();
    const id = generateId();
    const userId = c.get("userId");

    await db.insert(rooms).values({
      id,
      name,
      description: description ?? null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    const room = await db.select().from(rooms).where(eq(rooms.id, id)).get();
    return c.json({ data: room }, 201);
  }
);

// Update room
roomsRoute.put(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
    })
  ),
  async (c) => {
    const db = getDB(c.env.DB);
    const userId = c.get("userId");
    const roomId = c.req.param("id");

    const existing = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .get();

    if (!existing) return c.json({ error: "Room not found" }, 404);
    if (existing.createdBy !== userId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const body = c.req.valid("json");
    const now = new Date().toISOString();

    await db
      .update(rooms)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        updatedAt: now,
      })
      .where(eq(rooms.id, roomId));

    const updated = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .get();

    return c.json({ data: updated });
  }
);

// Delete room
roomsRoute.delete("/:id", async (c) => {
  const db = getDB(c.env.DB);
  const userId = c.get("userId");
  const roomId = c.req.param("id");

  const existing = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .get();

  if (!existing) return c.json({ error: "Room not found" }, 404);
  if (existing.createdBy !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.delete(rooms).where(eq(rooms.id, roomId));
  return c.json({ success: true });
});

export default roomsRoute;
