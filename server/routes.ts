import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertProjectSchema, insertVideoSchema, insertExperimentSchema, insertInteractionSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

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
        persistTimer: experiment.persistTimer,
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

  // Object Storage - File Upload
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve uploaded objects with ACL check
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: req.user?.id,
      });
      if (!canAccess) {
        return res.sendStatus(403);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Finalize upload and set ACL
  app.put("/api/objects/finalize", requireAuth, async (req, res) => {
    if (!req.body.uploadURL) {
      return res.status(400).json({ error: "uploadURL is required" });
    }

    const uploadURL = req.body.uploadURL;
    
    if (!uploadURL.startsWith("https://storage.googleapis.com/")) {
      return res.status(400).json({ error: "Invalid upload URL" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const url = new URL(uploadURL);
      
      if (!url.pathname.startsWith(privateDir)) {
        return res.status(400).json({ error: "Upload path not allowed" });
      }

      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: req.user!.id,
          visibility: "public",
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error: any) {
      console.error("Error finalizing upload:", error);
      res.status(500).json({ error: error.message });
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
