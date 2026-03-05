import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runStateReducer,
  initialRunState,
  getPhaseStatus,
  PHASE_ORDER,
  type RunState,
} from "./run-state";

describe("initialRunState", () => {
  it("has idle status", () => {
    expect(initialRunState.status).toBe("idle");
  });

  it("has empty fullText", () => {
    expect(initialRunState.fullText).toBe("");
  });

  it("has zero tokenCount", () => {
    expect(initialRunState.tokenCount).toBe(0);
  });

  it("has null startTime", () => {
    expect(initialRunState.startTime).toBeNull();
  });

  it("has null phaseStartTime", () => {
    expect(initialRunState.phaseStartTime).toBeNull();
  });

  it("has null error and errorPhase", () => {
    expect(initialRunState.error).toBeNull();
    expect(initialRunState.errorPhase).toBeNull();
  });

  it("has null resultMeta and savedDocumentId", () => {
    expect(initialRunState.resultMeta).toBeNull();
    expect(initialRunState.savedDocumentId).toBeNull();
  });
});

describe("runStateReducer", () => {
  const mockNow = 1000;

  beforeEach(() => {
    vi.spyOn(performance, "now").mockReturnValue(mockNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("START action", () => {
    it("transitions from idle to preparing with timestamps", () => {
      const state = runStateReducer(initialRunState, { type: "START" });
      expect(state.status).toBe("preparing");
      expect(state.startTime).toBe(mockNow);
      expect(state.phaseStartTime).toBe(mockNow);
      expect(state.fullText).toBe("");
      expect(state.error).toBeNull();
    });

    it("ignores START when not idle", () => {
      const preparingState: RunState = {
        ...initialRunState,
        status: "preparing",
        startTime: 500,
        phaseStartTime: 500,
      };
      const state = runStateReducer(preparingState, { type: "START" });
      expect(state).toBe(preparingState);
    });
  });

  describe("FIRST_TEXT action", () => {
    it("transitions from preparing to generating with token count", () => {
      const preparingState: RunState = {
        ...initialRunState,
        status: "preparing",
        startTime: 500,
        phaseStartTime: 500,
      };
      const state = runStateReducer(preparingState, {
        type: "FIRST_TEXT",
        text: "Hello world",
      });
      expect(state.status).toBe("generating");
      expect(state.fullText).toBe("Hello world");
      expect(state.tokenCount).toBe(Math.ceil("Hello world".length / 4));
      expect(state.phaseStartTime).toBe(mockNow);
    });

    it("ignores FIRST_TEXT when not preparing", () => {
      const state = runStateReducer(initialRunState, {
        type: "FIRST_TEXT",
        text: "Hello",
      });
      expect(state).toBe(initialRunState);
    });
  });

  describe("TEXT action", () => {
    it("accumulates text and updates token count when generating", () => {
      const generatingState: RunState = {
        ...initialRunState,
        status: "generating",
        fullText: "Hello",
        tokenCount: Math.ceil(5 / 4),
        startTime: 500,
        phaseStartTime: 600,
      };
      const state = runStateReducer(generatingState, {
        type: "TEXT",
        text: " world",
      });
      expect(state.fullText).toBe("Hello world");
      expect(state.tokenCount).toBe(Math.ceil("Hello world".length / 4));
    });

    it("ignores TEXT when idle", () => {
      const state = runStateReducer(initialRunState, {
        type: "TEXT",
        text: "ignored",
      });
      expect(state).toBe(initialRunState);
    });

    it("ignores TEXT when preparing", () => {
      const preparingState: RunState = {
        ...initialRunState,
        status: "preparing",
        startTime: 500,
        phaseStartTime: 500,
      };
      const state = runStateReducer(preparingState, {
        type: "TEXT",
        text: "ignored",
      });
      expect(state).toBe(preparingState);
    });
  });

  describe("RESULT action", () => {
    const meta = { cost_usd: 0.05, duration_ms: 3000, num_turns: 1 };

    it("transitions from generating to saving", () => {
      const generatingState: RunState = {
        ...initialRunState,
        status: "generating",
        fullText: "partial",
        tokenCount: 2,
        startTime: 500,
        phaseStartTime: 600,
      };
      const state = runStateReducer(generatingState, {
        type: "RESULT",
        meta,
        fullText: "full output text",
      });
      expect(state.status).toBe("saving");
      expect(state.fullText).toBe("full output text");
      expect(state.resultMeta).toEqual(meta);
      expect(state.phaseStartTime).toBe(mockNow);
    });

    it("transitions from preparing to saving", () => {
      const preparingState: RunState = {
        ...initialRunState,
        status: "preparing",
        startTime: 500,
        phaseStartTime: 500,
      };
      const state = runStateReducer(preparingState, {
        type: "RESULT",
        meta,
        fullText: "output",
      });
      expect(state.status).toBe("saving");
      expect(state.fullText).toBe("output");
      expect(state.resultMeta).toEqual(meta);
    });

    it("ignores RESULT when idle", () => {
      const state = runStateReducer(initialRunState, {
        type: "RESULT",
        meta,
        fullText: "output",
      });
      expect(state).toBe(initialRunState);
    });
  });

  describe("SAVED action", () => {
    it("transitions from saving to complete with documentId", () => {
      const savingState: RunState = {
        ...initialRunState,
        status: "saving",
        fullText: "output",
        resultMeta: { cost_usd: 0.05 },
        startTime: 500,
        phaseStartTime: 800,
      };
      const state = runStateReducer(savingState, {
        type: "SAVED",
        documentId: "ARC-001-REQ-v1.0",
      });
      expect(state.status).toBe("complete");
      expect(state.savedDocumentId).toBe("ARC-001-REQ-v1.0");
    });

    it("transitions from saving to complete with null documentId", () => {
      const savingState: RunState = {
        ...initialRunState,
        status: "saving",
        fullText: "output",
        resultMeta: { cost_usd: 0.05 },
        startTime: 500,
        phaseStartTime: 800,
      };
      const state = runStateReducer(savingState, {
        type: "SAVED",
        documentId: null,
      });
      expect(state.status).toBe("complete");
      expect(state.savedDocumentId).toBeNull();
    });

    it("ignores SAVED when not saving", () => {
      const state = runStateReducer(initialRunState, {
        type: "SAVED",
        documentId: "ARC-001-REQ-v1.0",
      });
      expect(state).toBe(initialRunState);
    });
  });

  describe("ERROR action", () => {
    it("sets error from preparing state", () => {
      const preparingState: RunState = {
        ...initialRunState,
        status: "preparing",
        startTime: 500,
        phaseStartTime: 500,
      };
      const state = runStateReducer(preparingState, {
        type: "ERROR",
        error: "Failed to prepare",
      });
      expect(state.status).toBe("error");
      expect(state.error).toBe("Failed to prepare");
      expect(state.errorPhase).toBe("preparing");
    });

    it("sets error from generating state", () => {
      const generatingState: RunState = {
        ...initialRunState,
        status: "generating",
        fullText: "partial",
        startTime: 500,
        phaseStartTime: 600,
      };
      const state = runStateReducer(generatingState, {
        type: "ERROR",
        error: "Generation failed",
      });
      expect(state.status).toBe("error");
      expect(state.error).toBe("Generation failed");
      expect(state.errorPhase).toBe("generating");
    });

    it("sets error from saving state", () => {
      const savingState: RunState = {
        ...initialRunState,
        status: "saving",
        fullText: "output",
        startTime: 500,
        phaseStartTime: 800,
      };
      const state = runStateReducer(savingState, {
        type: "ERROR",
        error: "Save failed",
      });
      expect(state.status).toBe("error");
      expect(state.error).toBe("Save failed");
      expect(state.errorPhase).toBe("saving");
    });

    it("sets error from complete state", () => {
      const completeState: RunState = {
        ...initialRunState,
        status: "complete",
        fullText: "output",
        startTime: 500,
        phaseStartTime: 900,
      };
      const state = runStateReducer(completeState, {
        type: "ERROR",
        error: "Post-complete error",
      });
      expect(state.status).toBe("error");
      expect(state.error).toBe("Post-complete error");
      expect(state.errorPhase).toBe("complete");
    });

    it("ignores ERROR when idle", () => {
      const state = runStateReducer(initialRunState, {
        type: "ERROR",
        error: "ignored",
      });
      expect(state).toBe(initialRunState);
    });
  });

  describe("RESET action", () => {
    it("returns to initialRunState from error state", () => {
      const errorState: RunState = {
        ...initialRunState,
        status: "error",
        error: "something broke",
        errorPhase: "generating",
        fullText: "partial",
        startTime: 500,
        phaseStartTime: 600,
      };
      const state = runStateReducer(errorState, { type: "RESET" });
      expect(state).toEqual(initialRunState);
    });

    it("returns to initialRunState from idle", () => {
      const state = runStateReducer(initialRunState, { type: "RESET" });
      expect(state).toEqual(initialRunState);
    });
  });
});

describe("getPhaseStatus", () => {
  it("returns pending for all phases when idle", () => {
    for (const phase of PHASE_ORDER) {
      expect(getPhaseStatus(phase, initialRunState)).toBe("pending");
    }
  });

  it("returns done for all phases when complete", () => {
    const completeState: RunState = { ...initialRunState, status: "complete" };
    for (const phase of PHASE_ORDER) {
      expect(getPhaseStatus(phase, completeState)).toBe("done");
    }
  });

  it("returns correct statuses when in preparing phase", () => {
    const state: RunState = { ...initialRunState, status: "preparing" };
    expect(getPhaseStatus("preparing", state)).toBe("active");
    expect(getPhaseStatus("generating", state)).toBe("pending");
    expect(getPhaseStatus("saving", state)).toBe("pending");
    expect(getPhaseStatus("complete", state)).toBe("pending");
  });

  it("returns correct statuses when in generating phase", () => {
    const state: RunState = { ...initialRunState, status: "generating" };
    expect(getPhaseStatus("preparing", state)).toBe("done");
    expect(getPhaseStatus("generating", state)).toBe("active");
    expect(getPhaseStatus("saving", state)).toBe("pending");
    expect(getPhaseStatus("complete", state)).toBe("pending");
  });

  it("returns correct statuses when in saving phase", () => {
    const state: RunState = { ...initialRunState, status: "saving" };
    expect(getPhaseStatus("preparing", state)).toBe("done");
    expect(getPhaseStatus("generating", state)).toBe("done");
    expect(getPhaseStatus("saving", state)).toBe("active");
    expect(getPhaseStatus("complete", state)).toBe("pending");
  });

  it("returns correct statuses when error occurred in generating", () => {
    const state: RunState = {
      ...initialRunState,
      status: "error",
      errorPhase: "generating",
      error: "something broke",
    };
    expect(getPhaseStatus("preparing", state)).toBe("done");
    expect(getPhaseStatus("generating", state)).toBe("error");
    expect(getPhaseStatus("saving", state)).toBe("skipped");
    expect(getPhaseStatus("complete", state)).toBe("skipped");
  });

  it("returns correct statuses when error occurred in preparing", () => {
    const state: RunState = {
      ...initialRunState,
      status: "error",
      errorPhase: "preparing",
      error: "prep failed",
    };
    expect(getPhaseStatus("preparing", state)).toBe("error");
    expect(getPhaseStatus("generating", state)).toBe("skipped");
    expect(getPhaseStatus("saving", state)).toBe("skipped");
    expect(getPhaseStatus("complete", state)).toBe("skipped");
  });

  it("returns correct statuses when error occurred in saving", () => {
    const state: RunState = {
      ...initialRunState,
      status: "error",
      errorPhase: "saving",
      error: "save failed",
    };
    expect(getPhaseStatus("preparing", state)).toBe("done");
    expect(getPhaseStatus("generating", state)).toBe("done");
    expect(getPhaseStatus("saving", state)).toBe("error");
    expect(getPhaseStatus("complete", state)).toBe("skipped");
  });
});
