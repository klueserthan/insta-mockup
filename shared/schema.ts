import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const researchers = pgTable('researchers', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const experiments = pgTable('experiments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  researcherId: varchar('researcher_id').notNull().references(() => researchers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  publicUrl: text('public_url').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const videos = pgTable('videos', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  experimentId: varchar('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  username: text('username').notNull(),
  userAvatar: text('user_avatar').notNull(),
  caption: text('caption').notNull(),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  song: text('song').notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const participants = pgTable('participants', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  experimentId: varchar('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const interactions = pgTable('interactions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  participantUuid: varchar('participant_uuid').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  videoId: varchar('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  interactionType: text('interaction_type').notNull(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const insertResearcherSchema = createInsertSchema(researchers).omit({
  id: true,
  createdAt: true,
});

export const insertExperimentSchema = createInsertSchema(experiments).omit({
  id: true,
  createdAt: true,
  publicUrl: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  createdAt: true,
});

export const insertInteractionSchema = createInsertSchema(interactions).omit({
  id: true,
  timestamp: true,
});

export type Researcher = typeof researchers.$inferSelect;
export type InsertResearcher = z.infer<typeof insertResearcherSchema>;

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
