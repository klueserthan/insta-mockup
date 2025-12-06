import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertVideoSchema, insertExperimentSchema, insertInteractionSchema } from "@shared/schema";
import { randomBytes } from "crypto";

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  next();
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Experiments
  app.get("/api/experiments", requireAuth, async (req, res) => {
    try {
      const experiments = await storage.getExperimentsByResearcher(req.user!.id);
      res.json(experiments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/experiments", requireAuth, async (req, res) => {
    try {
      const parsed = insertExperimentSchema.parse(req.body);
      const publicUrl = randomBytes(16).toString('hex');
      
      const experiment = await storage.createExperiment({
        ...parsed,
        researcherId: req.user!.id,
        publicUrl
      });
      
      res.status(201).json(experiment);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  // Videos
  app.get("/api/experiments/:experimentId/videos", async (req, res) => {
    try {
      const videos = await storage.getVideosByExperiment(req.params.experimentId);
      res.json(videos);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/experiments/:experimentId/videos", requireAuth, async (req, res) => {
    try {
      const parsed = insertVideoSchema.parse(req.body);
      
      const existingVideos = await storage.getVideosByExperiment(req.params.experimentId);
      const maxPosition = existingVideos.length > 0 
        ? Math.max(...existingVideos.map(v => v.position))
        : -1;

      const video = await storage.createVideo({
        ...parsed,
        experimentId: req.params.experimentId,
        position: maxPosition + 1
      });
      
      res.status(201).json(video);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.patch("/api/videos/:videoId", requireAuth, async (req, res) => {
    try {
      const video = await storage.updateVideo(req.params.videoId, req.body);
      res.json(video);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.delete("/api/videos/:videoId", requireAuth, async (req, res) => {
    try {
      await storage.deleteVideo(req.params.videoId);
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/videos/reorder", requireAuth, async (req, res) => {
    try {
      await storage.updateVideoPositions(req.body.updates);
      res.sendStatus(200);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  // Public Feed (for participants)
  app.get("/api/feed/:publicUrl", async (req, res) => {
    try {
      const experiment = await storage.getExperimentByPublicUrl(req.params.publicUrl);
      if (!experiment) {
        return res.status(404).send("Experiment not found");
      }

      const videos = await storage.getVideosByExperiment(experiment.id);
      res.json(videos);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Participant Interactions
  app.post("/api/interactions", async (req, res) => {
    try {
      const { participantId, experimentId, videoId, interactionType, metadata } = req.body;
      
      const participant = await storage.getOrCreateParticipant(experimentId, participantId);
      
      const parsed = insertInteractionSchema.parse({
        participantUuid: participant.id,
        videoId,
        interactionType,
        metadata
      });

      const interaction = await storage.createInteraction(parsed);
      res.status(201).json(interaction);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
