"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "ui";

import type { SessionUser } from "@/lib/session";

/**
 * The signed-in/signed-out corner of the header.
 *
 * Deliberately a client island that fetches its own state instead of the
 * header reading cookies during render: cookies() in a layout would make every
 * page dynamic, and the content pages here are statically generated. The cost
 * is a brief indeterminate state on first paint, which is why nothing renders
 * until the first answer arrives — flashing "Sign in" at someone who is
 * already signed in reads as being logged out.
 */
export function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const { user: sessionUser } = (await response.json()) as {
        user: SessionUser | null;
      };
      setUser(sessionUser);
    } catch {
      setUser(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Re-checked on navigation so signing in or out is reflected everywhere,
  // including on statically-served pages that never re-render on the server.
  useEffect(() => {
    void loadSession();
  }, [loadSession, pathname]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
    router.push("/");
  }

  if (!loaded) {
    // Same height as the controls it stands in for, so the header doesn't
    // shift once the answer lands.
    return <div className="h-9" aria-hidden />;
  }

  if (!user) {
    return (
      <Button asChild size="lg">
        {/* Sends the visitor back where they were once they're signed in. */}
        <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
      <Button variant="outline" size="lg" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}
