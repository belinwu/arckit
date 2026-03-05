import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Check, Circle, Loader2, X, Minus } from "lucide-react";
import type { PhaseStatus } from "@/lib/run-state";

interface PhaseItemProps {
  label: string;
  status: PhaseStatus;
  summary?: string;
  stats?: ReactNode;
  expanded: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}

const STATUS_ICONS: Record<PhaseStatus, ReactNode> = {
  pending: <Circle className="size-4 text-muted-foreground/50" />,
  active: <Loader2 className="size-4 animate-spin text-primary" />,
  done: <Check className="size-4 text-green-500" />,
  error: <X className="size-4 text-destructive" />,
  skipped: <Minus className="size-4 text-muted-foreground/30" />,
};

export function PhaseItem({
  label,
  status,
  summary,
  stats,
  expanded,
  onToggle,
  children,
}: PhaseItemProps) {
  const canExpand =
    status === "active" || status === "done" || status === "error";

  return (
    <div
      className={cn(
        "border-b last:border-b-0",
        status === "skipped" && "opacity-40"
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
          canExpand && "hover:bg-muted/50 cursor-pointer",
          !canExpand && "cursor-default"
        )}
        onClick={canExpand ? onToggle : undefined}
        disabled={!canExpand}
      >
        {STATUS_ICONS[status]}
        <span
          className={cn(
            "font-medium",
            (status === "pending" || status === "skipped") &&
              "text-muted-foreground/50"
          )}
        >
          {label}
        </span>
        {summary && status === "done" && (
          <span className="text-xs text-muted-foreground">{summary}</span>
        )}
        {stats && (status === "active" || status === "done") && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {stats}
          </span>
        )}
        {canExpand && (
          <span
            className={cn(
              "text-xs text-muted-foreground",
              !stats && "ml-auto"
            )}
          >
            {expanded ? "\u25BE" : "\u25B8"}
          </span>
        )}
      </button>

      {expanded && children && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
