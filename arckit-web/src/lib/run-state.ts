export type PhaseId = "preparing" | "generating" | "saving" | "complete";
export type PhaseStatus = "pending" | "active" | "done" | "error" | "skipped";

export interface RunState {
  status: "idle" | PhaseId | "error";
  fullText: string;
  tokenCount: number;
  startTime: number | null;
  phaseStartTime: number | null;
  error: string | null;
  errorPhase: PhaseId | null;
  resultMeta: {
    cost_usd?: number;
    duration_ms?: number;
    num_turns?: number;
  } | null;
  savedDocumentId: string | null;
}

export type RunAction =
  | { type: "START" }
  | { type: "FIRST_TEXT"; text: string }
  | { type: "TEXT"; text: string }
  | { type: "RESULT"; meta: RunState["resultMeta"]; fullText: string }
  | { type: "SAVED"; documentId: string | null }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

export const initialRunState: RunState = {
  status: "idle",
  fullText: "",
  tokenCount: 0,
  startTime: null,
  phaseStartTime: null,
  error: null,
  errorPhase: null,
  resultMeta: null,
  savedDocumentId: null,
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "START":
      return {
        ...initialRunState,
        status: "preparing",
        startTime: performance.now(),
        phaseStartTime: performance.now(),
      };

    case "FIRST_TEXT":
      if (state.status !== "preparing") return state;
      return {
        ...state,
        status: "generating",
        fullText: action.text,
        tokenCount: estimateTokens(action.text),
        phaseStartTime: performance.now(),
      };

    case "TEXT":
      if (state.status !== "generating") return state;
      {
        const fullText = state.fullText + action.text;
        return {
          ...state,
          fullText,
          tokenCount: estimateTokens(fullText),
        };
      }

    case "RESULT":
      if (state.status !== "generating" && state.status !== "preparing")
        return state;
      return {
        ...state,
        status: "saving",
        fullText: action.fullText || state.fullText,
        resultMeta: action.meta,
        phaseStartTime: performance.now(),
      };

    case "SAVED":
      if (state.status !== "saving") return state;
      return {
        ...state,
        status: "complete",
        savedDocumentId: action.documentId,
      };

    case "ERROR":
      if (state.status === "idle" || state.status === "complete") return state;
      return {
        ...state,
        status: "error",
        error: action.error,
        errorPhase: state.status as PhaseId,
      };

    case "RESET":
      return initialRunState;

    default:
      return state;
  }
}

const PHASE_ORDER: PhaseId[] = ["preparing", "generating", "saving", "complete"];

export function getPhaseStatus(
  phaseId: PhaseId,
  runState: RunState
): PhaseStatus {
  if (runState.status === "idle") return "pending";

  if (runState.status === "error") {
    const errorIndex = PHASE_ORDER.indexOf(runState.errorPhase!);
    const phaseIndex = PHASE_ORDER.indexOf(phaseId);
    if (phaseIndex < errorIndex) return "done";
    if (phaseIndex === errorIndex) return "error";
    return "skipped";
  }

  if (runState.status === "complete") return "done";

  const currentIndex = PHASE_ORDER.indexOf(runState.status as PhaseId);
  const phaseIndex = PHASE_ORDER.indexOf(phaseId);

  if (phaseIndex < currentIndex) return "done";
  if (phaseIndex === currentIndex) return "active";
  return "pending";
}
