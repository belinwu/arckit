"use client";

import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

interface Command {
  name: string;
  description: string;
  argumentHint?: string;
}

interface CommandPickerProps {
  onSelect: (command: Command) => void;
  selected?: string;
}

export function CommandPicker({ onSelect, selected }: CommandPickerProps) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/commands")
      .then((res) => res.json())
      .then((data) => setCommands(data.commands || []))
      .catch(() => setCommands([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return commands;
    const q = search.toLowerCase();
    return commands.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [commands, search]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative px-3 py-3">
        <Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search commands..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-3 pb-3">
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No commands found.
            </p>
          )}
          {filtered.map((cmd) => (
            <button
              key={cmd.name}
              onClick={() => onSelect(cmd)}
              className={`flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                selected === cmd.name
                  ? "bg-accent text-accent-foreground"
                  : ""
              }`}
            >
              <div className="flex w-full items-center gap-2">
                <span className="font-medium">/arckit.{cmd.name}</span>
                {cmd.argumentHint && (
                  <Badge variant="outline" className="text-[10px]">
                    {cmd.argumentHint}
                  </Badge>
                )}
              </div>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {cmd.description}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
