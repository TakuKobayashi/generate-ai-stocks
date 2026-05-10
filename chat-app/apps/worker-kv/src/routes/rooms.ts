import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../env";
import { listRooms, getRoomById, saveRoom, deleteRoom } from "../utils/kv";
import { authMiddleware } from "../middleware/auth";
import { generateId } from "../utils/crypto";

type Variables = { userId: string; displayName: string; email: string };

const roomsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

roomsRoute.use("*", authMiddleware);

roomsRoute.get("/", async (c) => {
  const rooms = await listRooms(c.env);
  return c.json({ data: rooms });
});

roomsRoute.get("/:id", async (c) => {
  const room = await getRoomById(c.env, c.req.param("id"));
  if (!room) return c.json({ error: "Room not found" }, 404);
  return c.json({ data: room });
});

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
    const now = new Date().toISOString();
    const id = generateId();
    const userId = c.get("userId");

    const room = {
      id,
      name,
      description: description ?? undefined,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    await saveRoom(c.env, room);
    return c.json({ data: room }, 201);
  }
);

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
    const roomId = c.req.param("id");
    const userId = c.get("userId");
    const existing = await getRoomById(c.env, roomId);
    if (!existing) return c.json({ error: "Room not found" }, 404);
    if (existing.createdBy !== userId) return c.json({ error: "Forbidden" }, 403);

    const body = c.req.valid("json");
    const updated = {
      ...existing,
      ...(body.name ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      updatedAt: new Date().toISOString(),
    };
    await saveRoom(c.env, updated);
    return c.json({ data: updated });
  }
);

roomsRoute.delete("/:id", async (c) => {
  const roomId = c.req.param("id");
  const userId = c.get("userId");
  const existing = await getRoomById(c.env, roomId);
  if (!existing) return c.json({ error: "Room not found" }, 404);
  if (existing.createdBy !== userId) return c.json({ error: "Forbidden" }, 403);
  await deleteRoom(c.env, roomId);
  return c.json({ success: true });
});

export default roomsRoute;
