export type ViewMode = "login" | "change-password" | "app";

export type MeResponse = {
  id: number;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
  canOpenSession: boolean;
};

export type ActiveSession = {
  sessionId: number;
  committeeName: string;
  openedDt: string;
  startDt: string | null;
  startUserId: number;
  openedByDisplayName: string;
  activeParticipants: number;
  isJoined: boolean;
  canManageSession: boolean;
};

export type OpenableCommittee = {
  committeeId: number;
  committeeName: string;
};

export type SessionParticipant = {
  userId: number;
  username: string;
  displayName: string;
  fractionName: string | null;
  joinedAt: string;
  hasSpeechRequest: boolean;
};

export type ParticipantsResponse = {
  sessionId: number;
  myUserId: number;
  hasMySpeechRequest: boolean;
  activeSpeakerUserId: number | null;
  participants: SessionParticipant[];
};

export type ContributionShare = {
  fractionName: string;
  fractionColorRgb: string;
  totalSeconds: number;
};

export type ChairStateResponse = {
  sessionId: number;
  sessionStartDt: string | null;
  sessionOpenedDt: string;
  isStarted: boolean;
  durationSeconds: number;
  committeeName: string;
  canManageSession: boolean;
  currentSpeakerUserId: number | null;
  currentSpeakerUsername: string | null;
  currentSpeakerDisplayName: string | null;
  contributionShares: ContributionShare[];
};

export type SpeechRequestState = "pending" | "paused" | "active";

export type ChairSpeechRequestItem = {
  userId: number;
  username: string;
  displayName: string;
  fractionName: string | null;
  requestedAt: string;
  state: SpeechRequestState;
  isActive: boolean;
};

export type ChairSpeechRequestsResponse = {
  sessionId: number;
  activeUserId: number | null;
  requests: ChairSpeechRequestItem[];
};
