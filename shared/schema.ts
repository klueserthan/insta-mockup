import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const researchers = pgTable('researchers', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  researcherId: varchar('researcher_id').notNull().references(() => researchers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  queryKey: text('query_key').notNull().default('participantId'),
  timeLimitSeconds: integer('time_limit_seconds').notNull().default(300),
  redirectUrl: text('redirect_url').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const experiments = pgTable('experiments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  publicUrl: text('public_url').notNull().unique(),
  persistTimer: boolean('persist_timer').notNull().default(false),
  showUnmutePrompt: boolean('show_unmute_prompt').notNull().default(true),
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

export const preseededComments = pgTable('preseeded_comments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  authorName: text('author_name').notNull(),
  authorAvatar: text('author_avatar').notNull(),
  body: text('body').notNull(),
  likes: integer('likes').notNull().default(0),
  source: text('source').notNull().default('manual'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertResearcherSchema = createInsertSchema(researchers).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  researcherId: true,
  createdAt: true,
});

export const insertExperimentSchema = createInsertSchema(experiments).omit({
  id: true,
  projectId: true,
  createdAt: true,
  publicUrl: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  experimentId: true,
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

export const insertPreseededCommentSchema = createInsertSchema(preseededComments).omit({
  id: true,
}).extend({
  createdAt: z.date().optional(),
});

export type Researcher = typeof researchers.$inferSelect;
export type InsertResearcher = z.infer<typeof insertResearcherSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;

export type PreseededComment = typeof preseededComments.$inferSelect;
export type InsertPreseededComment = z.infer<typeof insertPreseededCommentSchema>;
