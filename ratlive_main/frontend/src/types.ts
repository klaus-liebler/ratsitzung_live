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
  startDt: string;
  startUserId: number;
  startedByDisplayName: string;
  activeParticipants: number;
  isJoined: boolean;
};

export type OpenableCommittee = {
  committeeId: number;
  committeeName: string;
};

export type SessionParticipant = {
  userId: number;
  username: string;
  displayName: string;
  joinedAt: string;
  hasSpeechRequest: boolean;
};

export type ParticipantsResponse = {
  sessionId: number;
  myUserId: number;
  hasMySpeechRequest: boolean;
  participants: SessionParticipant[];
};

export type ChairStateResponse = {
  sessionId: number;
  sessionStartDt: string | null;
  isStarted: boolean;
  durationSeconds: number;
  committeeName: string;
};
