export type PersonRole =
  | "Administrator"
  | "Verwaltungsmitglied"
  | "Ratsmitglied"
  | "Sachkundiger Bürger"
  | "Vereidigter"
  | "Gast";

export type Gender = "weiblich" | "maennlich" | "divers" | "keine Angabe";
export type Faction = string;
export type CommitteeName = string;
export type CommitteeSessionStatus = "RUNNING" | "STOPPED";
export type SpeechStatus = "REQUESTED" | "ACTIVE" | "PAUSED" | "FINISHED" | "DELETED" | "WITHDRAWN";

export interface Participant {
  token: string;
  title: string | null;
  firstName: string;
  lastName: string;
  gender: Gender;
  memberFunction: PersonRole;
  faction: Faction | null;
  isChair: boolean;
  chairedBodies: string[];
}

export interface CommitteeSummary {
  committeeId: number;
  committeeName: CommitteeName | string;
  activeSession: SessionSummary | null;
}

export interface AttendanceEntry {
  participantToken: string;
  firstName: string;
  lastName: string;
  memberFunction: PersonRole;
  faction: Faction | null;
  checkedInAt: string;
  checkedOutAt: string | null;
}

export interface SpeechEntry {
  speechId: number;
  sessionId: number;
  participantToken: string;
  firstName: string;
  lastName: string;
  memberFunction: PersonRole;
  faction: Faction | null;
  requestedByToken: string;
  requestedAt: string;
  finishedAt: string | null;
  totalSpeakingSeconds: number;
  activeStartedAt: string | null;
  status: SpeechStatus;
  sequenceNumber: number;
  effectiveSpeakingSeconds: number;
}

export interface CompletedSessionInfo {
  sessionId: number;
  committeeId: number;
  committeeName: string;
  startedAt: string;
  stoppedAt: string;
}

export interface SessionSummary {
  sessionId: number;
  committeeId: number;
  committeeName: string;
  status: CommitteeSessionStatus;
  startedAt: string;
  stoppedAt: string | null;
  startedByToken: string;
  stoppedByToken: string | null;
  attendees: AttendanceEntry[];
  speeches: SpeechEntry[];
}

export interface DashboardState {
  participant: Participant;
  chairedCommittees: CommitteeSummary[];
  runningSessions: SessionSummary[];
}

export interface SeedParticipant {
  title?: string;
  firstName: string;
  lastName: string;
  gender?: Gender;
  memberFunction: PersonRole;
  ratsInfo?: {
    faction: Faction;
    chairedBodies: CommitteeName[];
  };
}
