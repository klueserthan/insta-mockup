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
  createdAt?: string;
}

export interface Video {
  id: string;
  experimentId: string;
  url: string;
  username: string;
  userAvatar: string;
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
