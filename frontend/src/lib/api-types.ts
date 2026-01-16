export interface Researcher {
  id: string;
  email: string;
  name: string;
  lastname: string;
  createdAt?: string;
}

export type InsertResearcher = Omit<Researcher, "id" | "createdAt"> & { password?: string };

export interface Project {
  id: string;
  researcherId: string;
  name: string;
  queryKey?: string;
  timeLimitSeconds?: number;
  redirectUrl?: string;
  endScreenMessage?: string;
  lockAllPositions?: boolean;
  randomizationSeed?: number;
  createdAt?: string;
}

export interface Experiment {
  id: string;
  projectId: string;
  name: string;
  publicUrl?: string;
  persistTimer?: boolean;
  showUnmutePrompt?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface Video {
  id: string;
  experimentId: string;
  filename: string;
  socialAccountId: string;
  socialAccount?: SocialAccount;
  caption: string;
  likes?: number;
  comments?: number;
  shares?: number;
  song: string;
  description?: string;
  position?: number;
  isLocked?: boolean;
  preseededComments?: PreseededComment[];
  createdAt?: string;
}

export interface PreseededComment {
  id: string;
  videoId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  likes?: number;
  source?: string;
  position?: number;
  isPinned?: boolean;
  createdAt?: string;
}

export interface SocialAccount {
  id: string;
  researcherId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  createdAt?: string;
}

export type InsertSocialAccount = Omit<SocialAccount, "id" | "researcherId" | "createdAt">;

export interface Interaction {
  id: string;
  participantUuid: string;
  videoId: string;
  interactionType: string;
  metadata?: any;
  timestamp?: string;
}

export interface Participant {
  id: string;
  experimentId: string;
  participantId: string;
  createdAt?: string;
}

export interface InstagramIngestResponse {
  type: "single" | "carousel";
  filename?: string;
  author?: {
    username: string;
    full_name: string;
    profile_pic_filename: string;
  };
  caption?: string;
  likes?: number;
  comments?: number;
  shares?: number;
}

// Results/Export types (US5)
export interface ParticipantSessionSummary {
  participantId: string;
  startedAt: string;
  endedAt?: string | null;
  totalDurationMs?: number | null;
}

export interface ResultsSummary {
  experimentId: string;
  sessions: ParticipantSessionSummary[];
}

export interface ExportRequest {
  format: "csv" | "json";
  participantIds?: string[];
  includeInteractions?: boolean;
}
