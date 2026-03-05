"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setApiKey } from "@/lib/api-key-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KeyRound } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();

    if (!trimmed) {
      setError("API key is required.");
      return;
    }

    setApiKey(trimmed);
    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-muted-foreground" />
            <CardTitle>API Key Setup</CardTitle>
          </div>
          <CardDescription>
            Enter your Anthropic API key to use ArcKit Web. Your key is stored
            locally in the browser and never sent to our servers.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">Anthropic API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-ant-..."
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                console.anthropic.com
              </a>
            </p>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Save & Continue
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
