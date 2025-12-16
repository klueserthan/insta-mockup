import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertProjectSchema, insertVideoSchema, insertExperimentSchema, insertInteractionSchema, insertPreseededCommentSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { generateComments } from "./openai";

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

  app.post("/api/videos/bulk-delete", requireAuth, async (req, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).send("videoIds must be a non-empty array");
      }
      await Promise.all(videoIds.map((id: string) => storage.deleteVideo(id)));
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/videos/bulk-generate-comments", requireAuth, async (req, res) => {
    try {
      const { videoIds, count = 5, tone = "mixed" } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).send("videoIds must be a non-empty array");
      }

      const results = await Promise.all(
        videoIds.map(async (videoId: string) => {
          const video = await storage.getVideo(videoId);
          if (!video) return { videoId, comments: [], error: "Video not found" };

          const generatedComments = await generateComments(
            video.caption,
            video.username,
            Math.min(count, 20),
            tone
          );

          const existingComments = await storage.getPreseededCommentsByVideo(videoId);
          const maxPosition = existingComments.length > 0 
            ? Math.max(...existingComments.map(c => c.position))
            : -1;

          const savedComments = await Promise.all(
            generatedComments.map(async (comment, index) => {
              const seed = Math.random().toString(36).substring(7);
              const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorName}_${seed}`;
              
              const daysAgo = Math.random() * 7;
              const hoursAgo = Math.random() * 24;
              const minutesAgo = Math.random() * 60;
              const randomTimestamp = new Date(
                Date.now() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000) - (minutesAgo * 60 * 1000)
              );

              return storage.createPreseededComment({
                videoId,
                authorName: comment.authorName,
                authorAvatar: avatar,
                body: comment.body,
                likes: comment.likes,
                source: "ai",
                position: maxPosition + 1 + index,
                createdAt: randomTimestamp
              });
            })
          );

          return { videoId, comments: savedComments };
        })
      );

      res.status(201).json(results);
    } catch (error: any) {
      console.error("Error bulk generating comments:", error);
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

  // Simple string hash function (djb2)
  function hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Seeded random shuffle helper using Mulberry32 PRNG
  function seededShuffle<T>(array: T[], seed: number): T[] {
    const result = [...array];
    let state = seed;
    
    const random = () => {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }

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
      
      // Calculate effective seed: combine base seed with participant ID if provided
      const rawParticipantId = req.query[project.queryKey];
      // Normalize: handle array values (take first), convert to string
      const participantId = Array.isArray(rawParticipantId) 
        ? rawParticipantId[0]?.toString() 
        : rawParticipantId?.toString();
      let effectiveSeed = project.randomizationSeed;
      if (participantId) {
        // Combine base seed with hashed participant ID for per-participant ordering
        effectiveSeed = project.randomizationSeed + hashString(participantId);
      }
      
      // Apply randomization logic
      let orderedVideos: typeof videosList;
      
      if (project.lockAllPositions) {
        // All videos locked - just use original position order
        orderedVideos = [...videosList];
      } else {
        // Separate locked and unlocked videos
        const lockedVideos = videosList.filter(v => v.isLocked);
        const unlockedVideos = videosList.filter(v => !v.isLocked);
        
        // Shuffle unlocked videos with seed (participant-specific if ID provided)
        const shuffledUnlocked = seededShuffle(unlockedVideos, effectiveSeed);
        
        // Algorithm: Build result array using locked videos at their clamped positions
        // Step 1: Create array slots for all videos
        const totalCount = videosList.length;
        const result: (typeof videosList[0] | null)[] = new Array(totalCount).fill(null);
        const usedSlots = new Set<number>();
        
        // Step 2: Sort locked videos by position (original order) and sanitize positions
        const sanitizedLocked = lockedVideos
          .map((v, originalIndex) => ({
            video: v,
            // Sanitize: ensure position is a finite non-negative integer
            pos: Number.isFinite(v.position) && v.position >= 0 
              ? Math.floor(v.position) 
              : originalIndex  // Fallback to original array index if position is invalid
          }))
          .sort((a, b) => a.pos - b.pos);
        
        // Step 3: Place locked videos at their target positions (clamped)
        for (const { video, pos } of sanitizedLocked) {
          // Clamp to valid range
          const clamped = Math.min(pos, totalCount - 1);
          
          // Find first available slot starting from clamped position
          let targetSlot = clamped;
          while (usedSlots.has(targetSlot) && targetSlot < totalCount) {
            targetSlot++;
          }
          
          // If we went past the end, find first available from the beginning
          if (targetSlot >= totalCount) {
            for (let i = 0; i < totalCount; i++) {
              if (!usedSlots.has(i)) {
                targetSlot = i;
                break;
              }
            }
          }
          
          // Safety: if all slots are somehow used (shouldn't happen), skip
          // But this should never occur if counts are correct
          if (targetSlot < totalCount && !usedSlots.has(targetSlot)) {
            result[targetSlot] = video;
            usedSlots.add(targetSlot);
          }
        }
        
        // Step 4: Fill remaining slots with shuffled unlocked videos
        let unlockedIdx = 0;
        for (let i = 0; i < totalCount; i++) {
          if (result[i] === null && unlockedIdx < shuffledUnlocked.length) {
            result[i] = shuffledUnlocked[unlockedIdx++];
          }
        }
        
        // Step 5: Filter out any null entries and cast
        orderedVideos = result.filter((v): v is typeof videosList[0] => v !== null);
      }
      
      const videosWithComments = await Promise.all(
        orderedVideos.map(async (video) => {
          const comments = await storage.getPreseededCommentsByVideo(video.id);
          return { ...video, preseededComments: comments };
        })
      );
      
      res.json({
        experimentId: experiment.id,
        experimentName: experiment.name,
        persistTimer: experiment.persistTimer,
        showUnmutePrompt: experiment.showUnmutePrompt,
        projectSettings: {
          queryKey: project.queryKey,
          timeLimitSeconds: project.timeLimitSeconds,
          redirectUrl: project.redirectUrl,
          endScreenMessage: project.endScreenMessage
        },
        videos: videosWithComments
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

  // Preseeded Comments
  app.get("/api/videos/:videoId/comments", async (req, res) => {
    try {
      const commentsList = await storage.getPreseededCommentsByVideo(req.params.videoId);
      res.json(commentsList);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/videos/:videoId/comments", requireAuth, async (req, res) => {
    try {
      const parsed = insertPreseededCommentSchema.parse({
        ...req.body,
        videoId: req.params.videoId
      });
      
      const existingComments = await storage.getPreseededCommentsByVideo(req.params.videoId);
      const maxPosition = existingComments.length > 0 
        ? Math.max(...existingComments.map(c => c.position))
        : -1;

      const comment = await storage.createPreseededComment({
        ...parsed,
        position: parsed.position ?? maxPosition + 1
      });
      
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.patch("/api/comments/:commentId", requireAuth, async (req, res) => {
    try {
      const comment = await storage.updatePreseededComment(req.params.commentId, req.body);
      if (!comment) {
        return res.status(404).send("Comment not found");
      }
      res.json(comment);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.delete("/api/comments/:commentId", requireAuth, async (req, res) => {
    try {
      await storage.deletePreseededComment(req.params.commentId);
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/comments/reorder", requireAuth, async (req, res) => {
    try {
      await storage.updatePreseededCommentPositions(req.body.updates);
      res.sendStatus(200);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.post("/api/videos/:videoId/comments/generate", requireAuth, async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.videoId);
      if (!video) {
        return res.status(404).send("Video not found");
      }

      const { count = 5, tone = "mixed" } = req.body;
      
      const generatedComments = await generateComments(
        video.caption,
        video.username,
        Math.min(count, 20),
        tone
      );

      const existingComments = await storage.getPreseededCommentsByVideo(req.params.videoId);
      const maxPosition = existingComments.length > 0 
        ? Math.max(...existingComments.map(c => c.position))
        : -1;

      const savedComments = await Promise.all(
        generatedComments.map(async (comment, index) => {
          const seed = Math.random().toString(36).substring(7);
          const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorName}_${seed}`;
          
          const daysAgo = Math.random() * 7;
          const hoursAgo = Math.random() * 24;
          const minutesAgo = Math.random() * 60;
          const randomTimestamp = new Date(
            Date.now() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000) - (minutesAgo * 60 * 1000)
          );
          
          return storage.createPreseededComment({
            videoId: req.params.videoId,
            authorName: comment.authorName,
            authorAvatar: avatar,
            body: comment.body,
            likes: comment.likes,
            source: "ai",
            position: maxPosition + 1 + index,
            createdAt: randomTimestamp
          });
        })
      );

      res.status(201).json(savedComments);
    } catch (error: any) {
      console.error("Error generating comments:", error);
      res.status(500).send(error.message);
    }
  });

  return httpServer;
}
