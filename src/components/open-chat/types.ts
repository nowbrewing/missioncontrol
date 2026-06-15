import type { ChatMode } from "../../lib/chat-mode";
import type { MissionMilestone, MissionTask } from "../../lib/mission-prioritize";
import type { ProposedTaskDraft } from "../ProposedTasksReviewModal";
import type { TaskEditDraft } from "../TaskEditsReviewModal";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
};

export type ChatBriefContext = {
  today: string;
  pillars: {
    id: number;
    name: string;
    abbreviation?: string | null;
    color: string;
    rank: number;
  }[];
  milestones: MissionMilestone[];
  tasks: MissionTask[];
};

export type OpenChatContextValue = {
  planDate: string;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatMessages: ChatMessage[];
  chatMode: ChatMode;
  toggleChatMode: () => void;
  chatBusy: boolean;
  handoffBusy: boolean;
  chatError: string | null;
  summarizingSession: boolean;
  sessionSaveNotice: string | null;
  floatingOpen: boolean;
  openFloatingChat: () => void;
  closeFloatingChat: () => void;
  toggleFloatingChat: () => void;
  onChatSubmit: (e: React.FormEvent) => void;
  chatBrief: ChatBriefContext | null;
  proposedReviewOpen: boolean;
  proposedTasks: ProposedTaskDraft[];
  proposedReviewSource: "check-in" | "chat";
  savingProposed: boolean;
  proposedSaveError: string | null;
  confirmProposedTasks: (tasks: ProposedTaskDraft[]) => Promise<void>;
  dismissProposedReview: () => void;
  taskEditsOpen: boolean;
  taskEdits: TaskEditDraft[];
  savingTaskEdits: boolean;
  taskEditsSaveError: string | null;
  confirmTaskEdits: (edits: TaskEditDraft[]) => Promise<void>;
  dismissTaskEditsReview: () => void;
  registerBriefRefresh: (fn: (brief: Record<string, unknown>) => void) => () => void;
  syncChatBrief: (brief: ChatBriefContext) => void;
  openCheckInProposedReview: (drafts: ProposedTaskDraft[]) => void;
};
