"use client";

import { useState, useEffect, type ReactNode } from "react";
import { PhaseItem } from "@/components/phase-item";
import { type PhaseId, type RunState, getPhaseStatus } from "@/lib/run-state";

interface PhaseConfig {
  id: PhaseId;
  label: string;
  summary?: (state: RunState) => string | undefined;
  stats?: (state: RunState) => ReactNode | undefined;
  body?: (state: RunState) => ReactNode | undefined;
}

interface PhaseAccordionProps {
  runState: RunState;
  phases: PhaseConfig[];
}

export type { PhaseConfig };

export function PhaseAccordion({ runState, phases }: PhaseAccordionProps) {
  const [expandedPhase, setExpandedPhase] = useState<PhaseId | null>(null);

  useEffect(() => {
    if (runState.status === "idle") {
      setExpandedPhase(null);
      return;
    }

    // Find the currently active phase
    const activePhase = phases.find(
      (p) => getPhaseStatus(p.id, runState) === "active"
    );
    if (activePhase) {
      setExpandedPhase(activePhase.id);
      return;
    }

    // If complete, expand the "complete" phase
    if (runState.status === "complete") {
      setExpandedPhase("complete");
      return;
    }

    // If error, expand the phase that errored
    if (runState.status === "error") {
      const errorPhase = phases.find(
        (p) => getPhaseStatus(p.id, runState) === "error"
      );
      if (errorPhase) setExpandedPhase(errorPhase.id);
    }
  }, [runState.status, phases]);

  if (runState.status === "idle") return null;

  return (
    <div className="rounded-md border">
      {phases.map((phase) => {
        const status = getPhaseStatus(phase.id, runState);
        const isExpanded = expandedPhase === phase.id;

        return (
          <PhaseItem
            key={phase.id}
            label={phase.label}
            status={status}
            summary={phase.summary?.(runState)}
            stats={phase.stats?.(runState)}
            expanded={isExpanded}
            onToggle={() =>
              setExpandedPhase(isExpanded ? null : phase.id)
            }
          >
            {phase.body?.(runState)}
          </PhaseItem>
        );
      })}
    </div>
  );
}
