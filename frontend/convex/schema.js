import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  carts: defineTable({
    userId: v.string(),
    items: v.array(v.object({
      productId: v.string(),
      name: v.string(),
      price: v.number(),
      quantity: v.number(),
      image: v.optional(v.string()),
    })),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});