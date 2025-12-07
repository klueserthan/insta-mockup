import { 
  type Researcher, type InsertResearcher,
  type Project, type InsertProject,
  type Experiment, type InsertExperiment,
  type Video, type InsertVideo,
  type Participant, type InsertParticipant,
  type Interaction, type InsertInteraction,
  type PreseededComment, type InsertPreseededComment,
  researchers, projects, experiments, videos, participants, interactions, preseededComments
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  
  // Researchers
  getResearcher(id: string): Promise<Researcher | undefined>;
  getResearcherByEmail(email: string): Promise<Researcher | undefined>;
  createResearcher(data: InsertResearcher): Promise<Researcher>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByResearcher(researcherId: string): Promise<Project[]>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;

  // Experiments
  getExperiment(id: string): Promise<Experiment | undefined>;
  getExperimentsByProject(projectId: string): Promise<Experiment[]>;
  getExperimentByPublicUrl(publicUrl: string): Promise<Experiment | undefined>;
  createExperiment(data: InsertExperiment & { publicUrl: string }): Promise<Experiment>;
  updateExperiment(id: string, data: Partial<InsertExperiment>): Promise<Experiment | undefined>;
  deleteExperiment(id: string): Promise<void>;
  
  // Videos
  getVideo(id: string): Promise<Video | undefined>;
  getVideosByExperiment(experimentId: string): Promise<Video[]>;
  createVideo(data: InsertVideo): Promise<Video>;
  updateVideo(id: string, data: Partial<InsertVideo>): Promise<Video | undefined>;
  updateVideoPositions(updates: { id: string; position: number }[]): Promise<void>;
  deleteVideo(id: string): Promise<void>;
  
  // Participants
  getOrCreateParticipant(experimentId: string, participantId: string): Promise<Participant>;
  
  // Interactions
  createInteraction(data: InsertInteraction): Promise<Interaction>;
  getInteractionsByParticipant(participantUuid: string): Promise<Interaction[]>;
  getInteractionsByVideo(videoId: string): Promise<Interaction[]>;

  // Preseeded Comments
  getPreseededComment(id: string): Promise<PreseededComment | undefined>;
  getPreseededCommentsByVideo(videoId: string): Promise<PreseededComment[]>;
  createPreseededComment(data: InsertPreseededComment): Promise<PreseededComment>;
  updatePreseededComment(id: string, data: Partial<InsertPreseededComment>): Promise<PreseededComment | undefined>;
  deletePreseededComment(id: string): Promise<void>;
  updatePreseededCommentPositions(updates: { id: string; position: number }[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true });
  }

  // Researchers
  async getResearcher(id: string): Promise<Researcher | undefined> {
    const [researcher] = await db.select().from(researchers).where(eq(researchers.id, id));
    return researcher || undefined;
  }

  async getResearcherByEmail(email: string): Promise<Researcher | undefined> {
    const [researcher] = await db.select().from(researchers).where(eq(researchers.email, email));
    return researcher || undefined;
  }

  async createResearcher(data: InsertResearcher): Promise<Researcher> {
    const [researcher] = await db.insert(researchers).values(data).returning();
    return researcher;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjectsByResearcher(researcherId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.researcherId, researcherId)).orderBy(desc(projects.createdAt));
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Experiments
  async getExperiment(id: string): Promise<Experiment | undefined> {
    const [experiment] = await db.select().from(experiments).where(eq(experiments.id, id));
    return experiment || undefined;
  }

  async getExperimentsByProject(projectId: string): Promise<Experiment[]> {
    return db.select().from(experiments).where(eq(experiments.projectId, projectId)).orderBy(desc(experiments.createdAt));
  }

  async getExperimentByPublicUrl(publicUrl: string): Promise<Experiment | undefined> {
    const [experiment] = await db.select().from(experiments).where(eq(experiments.publicUrl, publicUrl));
    return experiment || undefined;
  }

  async createExperiment(data: InsertExperiment & { publicUrl: string }): Promise<Experiment> {
    const [experiment] = await db.insert(experiments).values(data).returning();
    return experiment;
  }

  async updateExperiment(id: string, data: Partial<InsertExperiment>): Promise<Experiment | undefined> {
    const [experiment] = await db.update(experiments).set(data).where(eq(experiments.id, id)).returning();
    return experiment || undefined;
  }

  async deleteExperiment(id: string): Promise<void> {
    await db.delete(experiments).where(eq(experiments.id, id));
  }

  // Videos
  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async getVideosByExperiment(experimentId: string): Promise<Video[]> {
    return db.select().from(videos).where(eq(videos.experimentId, experimentId)).orderBy(videos.position);
  }

  async createVideo(data: InsertVideo): Promise<Video> {
    const [video] = await db.insert(videos).values(data).returning();
    return video;
  }

  async updateVideo(id: string, data: Partial<InsertVideo>): Promise<Video | undefined> {
    const [video] = await db.update(videos).set(data).where(eq(videos.id, id)).returning();
    return video || undefined;
  }

  async updateVideoPositions(updates: { id: string; position: number }[]): Promise<void> {
    await Promise.all(
      updates.map(update =>
        db.update(videos).set({ position: update.position }).where(eq(videos.id, update.id))
      )
    );
  }

  async deleteVideo(id: string): Promise<void> {
    await db.delete(videos).where(eq(videos.id, id));
  }

  // Participants
  async getOrCreateParticipant(experimentId: string, participantId: string): Promise<Participant> {
    const [existing] = await db.select().from(participants).where(
      and(
        eq(participants.experimentId, experimentId),
        eq(participants.participantId, participantId)
      )
    );

    if (existing) return existing;

    const [participant] = await db.insert(participants).values({
      experimentId,
      participantId
    }).returning();

    return participant;
  }

  // Interactions
  async createInteraction(data: InsertInteraction): Promise<Interaction> {
    const [interaction] = await db.insert(interactions).values(data).returning();
    return interaction;
  }

  async getInteractionsByParticipant(participantUuid: string): Promise<Interaction[]> {
    return db.select().from(interactions)
      .where(eq(interactions.participantUuid, participantUuid))
      .orderBy(desc(interactions.timestamp));
  }

  async getInteractionsByVideo(videoId: string): Promise<Interaction[]> {
    return db.select().from(interactions)
      .where(eq(interactions.videoId, videoId))
      .orderBy(desc(interactions.timestamp));
  }

  // Preseeded Comments
  async getPreseededComment(id: string): Promise<PreseededComment | undefined> {
    const [comment] = await db.select().from(preseededComments).where(eq(preseededComments.id, id));
    return comment || undefined;
  }

  async getPreseededCommentsByVideo(videoId: string): Promise<PreseededComment[]> {
    return db.select().from(preseededComments)
      .where(eq(preseededComments.videoId, videoId))
      .orderBy(preseededComments.position);
  }

  async createPreseededComment(data: InsertPreseededComment): Promise<PreseededComment> {
    const [comment] = await db.insert(preseededComments).values(data).returning();
    return comment;
  }

  async updatePreseededComment(id: string, data: Partial<InsertPreseededComment>): Promise<PreseededComment | undefined> {
    const [comment] = await db.update(preseededComments).set(data).where(eq(preseededComments.id, id)).returning();
    return comment || undefined;
  }

  async deletePreseededComment(id: string): Promise<void> {
    await db.delete(preseededComments).where(eq(preseededComments.id, id));
  }

  async updatePreseededCommentPositions(updates: { id: string; position: number }[]): Promise<void> {
    await Promise.all(
      updates.map(update =>
        db.update(preseededComments).set({ position: update.position }).where(eq(preseededComments.id, update.id))
      )
    );
  }
}

export const storage = new DatabaseStorage();
