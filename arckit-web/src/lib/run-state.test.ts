import { describe, it, expect } from "vitest";
import {
  runStateReducer,
  initialRunState,
  getPhaseStatus,
  type RunState,
} from "./run-state";

describe("runReducer", () => {
  it("starts in idle status", () => {
    expect(initialRunState.status).toBe("idle");
    expect(initialRunState.fullText).toBe("");
    expect(initialRunState.tokenCount).toBe(0);
  });

  it("transitions from idle to preparing on START", () => {
    const state = runStateReducer(initialRunState, { type: "START" });
    expect(state.status).toBe("preparing");
    expect(state.startTime).toBeGreaterThan(0);
    expect(state.phaseStartTime).toBeGreaterThan(0);
    expect(state.fullText).toBe("");
    expect(state.error).toBeNull();
  });

  it("transitions from preparing to generating on FIRST_TEXT", () => {
    const preparing: RunState = {
      ...initialRunState,
      status: "preparing",
      startTime: 1000,
      phaseStartTime: 1000,
    };
    const state = runStateReducer(preparing, { type: "FIRST_TEXT", text: "Hello" });
    expect(state.status).toBe("generating");
    expect(state.fullText).toBe("Hello");
    expect(state.tokenCount).toBe(Math.ceil(5 / 4));
    expect(state.phaseStartTime).toBeGreaterThan(0);
  });

  it("accumulates text on TEXT actions", () => {
    const generating: RunState = {
      ...initialRunState,
      status: "generating",
      fullText: "Hello",
      tokenCount: 2,
      startTime: 1000,
      phaseStartTime: 1000,
    };
    const state = runStateReducer(generating, { type: "TEXT", text: " world" });
    expect(state.fullText).toBe("Hello world");
    expect(state.tokenCount).toBe(Math.ceil(11 / 4));
  });

  it("transitions from generating to saving on RESULT", () => {
    const generating: RunState = {
      ...initialRunState,
      status: "generating",
      fullText: "partial",
      startTime: 1000,
      phaseStartTime: 1000,
    };
    const meta = { cost_usd: 0.01, duration_ms: 5000, num_turns: 1 };
    const state = runStateReducer(generating, {
      type: "RESULT",
      meta,
      fullText: "full result text",
    });
    expect(state.status).toBe("saving");
    expect(state.fullText).toBe("full result text");
    expect(state.resultMeta).toEqual(meta);
  });

  it("transitions from saving to complete on SAVED", () => {
    const saving: RunState = {
      ...initialRunState,
      status: "saving",
      fullText: "content",
      startTime: 1000,
      phaseStartTime: 1000,
    };
    const state = runStateReducer(saving, {
      type: "SAVED",
      documentId: "ARC-001-REQ-v1.0",
    });
    expect(state.status).toBe("complete");
    expect(state.savedDocumentId).toBe("ARC-001-REQ-v1.0");
  });

  it("transitions to error from any active state", () => {
    for (const status of ["preparing", "generating", "saving"] as const) {
      const active: RunState = {
        ...initialRunState,
        status,
        startTime: 1000,
        phaseStartTime: 1000,
      };
      const state = runStateReducer(active, { type: "ERROR", error: "API failed" });
      expect(state.status).toBe("error");
      expect(state.error).toBe("API failed");
      expect(state.errorPhase).toBe(status);
    }
  });

  it("resets to idle on RESET", () => {
    const complete: RunState = {
      ...initialRunState,
      status: "complete",
      fullText: "lots of content",
      tokenCount: 500,
    };
    const state = runStateReducer(complete, { type: "RESET" });
    expect(state).toEqual(initialRunState);
  });

  it("ignores TEXT when not in generating state", () => {
    const state = runStateReducer(initialRunState, { type: "TEXT", text: "stray" });
    expect(state).toEqual(initialRunState);
  });

  it("handles SAVED with null documentId", () => {
    const saving: RunState = {
      ...initialRunState,
      status: "saving",
      startTime: 1000,
      phaseStartTime: 1000,
    };
    const state = runStateReducer(saving, { type: "SAVED", documentId: null });
    expect(state.status).toBe("complete");
    expect(state.savedDocumentId).toBeNull();
  });
});

describe("getPhaseStatus", () => {
  it("marks all phases as pending when idle", () => {
    expect(getPhaseStatus("preparing", initialRunState)).toBe("pending");
    expect(getPhaseStatus("generating", initialRunState)).toBe("pending");
    expect(getPhaseStatus("saving", initialRunState)).toBe("pending");
    expect(getPhaseStatus("complete", initialRunState)).toBe("pending");
  });

  it("marks all phases as done when complete", () => {
    const state: RunState = {
      ...initialRunState,
      status: "complete",
    };
    expect(getPhaseStatus("preparing", state)).toBe("done");
    expect(getPhaseStatus("generating", state)).toBe("done");
    expect(getPhaseStatus("saving", state)).toBe("done");
    expect(getPhaseStatus("complete", state)).toBe("done");
  });

  it("marks active phase and pending/done correctly", () => {
    const state: RunState = {
      ...initialRunState,
      status: "generating",
      startTime: 1000,
      phaseStartTime: 1000,
    };
    expect(getPhaseStatus("preparing", state)).toBe("done");
    expect(getPhaseStatus("generating", state)).toBe("active");
    expect(getPhaseStatus("saving", state)).toBe("pending");
    expect(getPhaseStatus("complete", state)).toBe("pending");
  });

  it("shows done/error/skipped for error during generating", () => {
    const state: RunState = {
      ...initialRunState,
      status: "error",
      error: "API failed",
      errorPhase: "generating",
      startTime: 1000,
      phaseStartTime: 1000,
      fullText: "some text",
    };
    expect(getPhaseStatus("preparing", state)).toBe("done");
    expect(getPhaseStatus("generating", state)).toBe("error");
    expect(getPhaseStatus("saving", state)).toBe("skipped");
    expect(getPhaseStatus("complete", state)).toBe("skipped");
  });

  it("shows error on preparing phase when error occurs early", () => {
    const state: RunState = {
      ...initialRunState,
      status: "error",
      error: "Connection failed",
      errorPhase: "preparing",
      startTime: 1000,
      phaseStartTime: 1000,
    };
    expect(getPhaseStatus("preparing", state)).toBe("error");
    expect(getPhaseStatus("generating", state)).toBe("skipped");
    expect(getPhaseStatus("saving", state)).toBe("skipped");
    expect(getPhaseStatus("complete", state)).toBe("skipped");
  });
});
