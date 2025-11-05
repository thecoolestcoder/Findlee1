import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get user's cart
export const getCart = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    return await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
  },
});

// Update cart
export const updateCart = mutation({
  args: {
    items: v.array(v.object({
      productId: v.string(),
      name: v.string(),
      price: v.number(),
      quantity: v.number(),
      image: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const existing = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        items: args.items,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("carts", {
        userId: identity.subject,
        items: args.items,
        updatedAt: Date.now(),
      });
    }
  },
});

// Add single item to cart
export const addItem = mutation({
  args: {
    productId: v.string(),
    name: v.string(),
    price: v.number(),
    quantity: v.number(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
    
    let newItems;
    if (cart) {
      const existingItem = cart.items.find(item => item.productId === args.productId);
      if (existingItem) {
        newItems = cart.items.map(item =>
          item.productId === args.productId
            ? { ...item, quantity: item.quantity + args.quantity }
            : item
        );
      } else {
        newItems = [...cart.items, args];
      }
      
      await ctx.db.patch(cart._id, {
        items: newItems,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("carts", {
        userId: identity.subject,
        items: [args],
        updatedAt: Date.now(),
      });
    }
  },
});

// Remove item from cart
export const removeItem = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
    
    if (cart) {
      const newItems = cart.items.filter(item => item.productId !== args.productId);
      await ctx.db.patch(cart._id, {
        items: newItems,
        updatedAt: Date.now(),
      });
    }
  },
});

// Clear cart
export const clearCart = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
    
    if (cart) {
      await ctx.db.delete(cart._id);
    }
  },
});