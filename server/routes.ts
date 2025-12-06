import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertProjectSchema, insertVideoSchema, insertExperimentSchema, insertInteractionSchema } from "@shared/schema";
import { randomBytes } from "crypto";

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  next();
}

export function registerRoutes(httpServer: Server, app: Express): Server {
  setupAuth(app);

  // Projects
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projectsList = await storage.getProjectsByResearcher(req.user!.id);
      res.json(projectsList);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/projects/:projectId", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).send("Project not found");
      }
      res.json(project);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const parsed = insertProjectSchema.parse(req.body);
      const project = await storage.createProject({
        ...parsed,
        researcherId: req.user!.id
      });
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.patch("/api/projects/:projectId", requireAuth, async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.projectId, req.body);
      if (!project) {
        return res.status(404).send("Project not found");
      }
      res.json(project);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.delete("/api/projects/:projectId", requireAuth, async (req, res) => {
    try {
      await storage.deleteProject(req.params.projectId);
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Experiments (Feeds) - scoped to projects
  app.get("/api/projects/:projectId/experiments", requireAuth, async (req, res) => {
    try {
      const experimentsList = await storage.getExperimentsByProject(req.params.projectId);
      res.json(experimentsList);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/projects/:projectId/experiments", requireAuth, async (req, res) => {
    try {
      const parsed = insertExperimentSchema.parse(req.body);
      const publicUrl = randomBytes(16).toString('hex');
      
      const experiment = await storage.createExperiment({
        ...parsed,
        projectId: req.params.projectId,
        publicUrl
      });
      
      res.status(201).json(experiment);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.patch("/api/experiments/:experimentId", requireAuth, async (req, res) => {
    try {
      const experiment = await storage.updateExperiment(req.params.experimentId, req.body);
      if (!experiment) {
        return res.status(404).send("Experiment not found");
      }
      res.json(experiment);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.delete("/api/experiments/:experimentId", requireAuth, async (req, res) => {
    try {
      await storage.deleteExperiment(req.params.experimentId);
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Videos
  app.get("/api/experiments/:experimentId/videos", async (req, res) => {
    try {
      const videosList = await storage.getVideosByExperiment(req.params.experimentId);
      res.json(videosList);
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

  // Public Feed (for participants) - returns videos and project settings
  app.get("/api/feed/:publicUrl", async (req, res) => {
    try {
      const experiment = await storage.getExperimentByPublicUrl(req.params.publicUrl);
      if (!experiment) {
        return res.status(404).send("Experiment not found");
      }

      const project = await storage.getProject(experiment.projectId);
      if (!project) {
        return res.status(404).send("Project not found");
      }

      const videosList = await storage.getVideosByExperiment(experiment.id);
      
      res.json({
        experimentId: experiment.id,
        experimentName: experiment.name,
        projectSettings: {
          queryKey: project.queryKey,
          timeLimitSeconds: project.timeLimitSeconds,
          redirectUrl: project.redirectUrl
        },
        videos: videosList
      });
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

  return httpServer;
}
