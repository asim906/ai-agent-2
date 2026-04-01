import { pgTable, text, boolean, timestamp, integer, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whatsappSessionsTable = pgTable("whatsapp_sessions", {
  id: text("id").primaryKey().default("default"),
  userId: text("user_id").notNull(),
  connected: boolean("connected").notNull().default(false),
  phoneNumber: text("phone_number"),
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  sessionData: jsonb("session_data"),
  lastConnected: timestamp("last_connected", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const chatsTable = pgTable("chats", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  profilePicUrl: text("profile_pic_url"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  unreadCount: integer("unread_count").notNull().default(0),
  isGroup: boolean("is_group").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  fromMe: boolean("from_me").notNull().default(false),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  type: text("type").notNull().default("text"),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  senderName: text("sender_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiSettingsTable = pgTable("ai_settings", {
  id: text("id").primaryKey().default("default"),
  userId: text("user_id").notNull().unique(),
  provider: text("provider").notNull().default("openai"),
  model: text("model").notNull().default("gpt-4o-mini"),
  apiKey: text("api_key"),
  temperature: integer("temperature").notNull().default(7),
  maxTokens: integer("max_tokens").notNull().default(500),
  autoReply: boolean("auto_reply").notNull().default(false),
  systemPrompt: text("system_prompt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const customMemoryTable = pgTable("custom_memory", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const csvFilesTable = pgTable("csv_files", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  filename: text("filename").notNull(),
  data: text("data").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomMemorySchema = createInsertSchema(customMemoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomMemory = z.infer<typeof insertCustomMemorySchema>;
export type CustomMemory = typeof customMemoryTable.$inferSelect;

export const insertCsvFileSchema = createInsertSchema(csvFilesTable).omit({ id: true, uploadedAt: true });
export type InsertCsvFile = z.infer<typeof insertCsvFileSchema>;
export type CsvFile = typeof csvFilesTable.$inferSelect;
