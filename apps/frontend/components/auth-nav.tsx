"use client";

import { useTranslations } from "next-intl";
import { usePathname as useRealPathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "ui";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { SessionUser } from "@/lib/session";

type OidcState = {
  enabled: boolean;
  user: { name: string; email: string | null } | null;
};

/**
 * The signed-in/signed-out corner of the header.
 *
 * When the OIDC login is configured (see docs/ibe-login.md) it is the sign-in:
 * "Sign in" goes to /auth/login, a signed-in user sees their name (linking to
 * /account) and a "Sign out" that posts to /auth/logout. When it is not
 * configured, the original sign-in below is used unchanged.
 *
 * Deliberately a client island that fetches its own state instead of the
 * header reading cookies during render: cookies() in a layout would make every
 * page dynamic, and the content pages here are statically generated. The cost
 * is a brief indeterminate state on first paint, which is why nothing renders
 * until the first answer arrives — flashing "Sign in" at someone who is
 * already signed in reads as being logged out.
 */
export function AuthNav() {
  const t = useTranslations("AuthNav");
  // The path without the locale prefix: only used to re-check on navigation.
  const pathname = usePathname();
  // The real path (with /ja etc.): where to come back to after logging in.
  const realPath = useRealPathname();
  const [oidc, setOidc] = useState<OidcState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/auth/session", { cache: "no-store" })
      .then((r) => r.json() as Promise<OidcState>)
      .then((state) => {
        if (!cancelled) setOidc(state);
      })
      .catch(() => {
        if (!cancelled) setOidc({ enabled: false, user: null });
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!oidc) {
    // Same height as the controls it stands in for, so the header doesn't
    // shift once the answer lands.
    return <div className="h-9" aria-hidden />;
  }

  if (!oidc.enabled) return <LegacyAuthNav />;

  if (!oidc.user) {
    // Never send people back to an error page or into the auth routes.
    const returnTo =
      realPath.startsWith("/login-error") || realPath.startsWith("/auth")
        ? "/"
        : realPath;
    return (
      <Button asChild size="lg">
        {/* A plain anchor, not <Link>: prefetching would start a login in the background. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>{t("signIn")}</a>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/account"
        className="hidden text-sm text-muted-foreground no-underline hover:text-foreground sm:inline"
      >
        {oidc.user.name}
      </Link>
      {/* A form POST, not a link: logging out must not be triggerable by another site. */}
      <form action="/auth/logout" method="post">
        <Button type="submit" variant="outline" size="lg">
          {t("signOut")}
        </Button>
      </form>
    </div>
  );
}

/** The original sign-in (the /login page and the API's session cookie). */
function LegacyAuthNav() {
  const t = useTranslations("AuthNav");
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
    return <div className="h-9" aria-hidden />;
  }

  if (!user) {
    return (
      <Button asChild size="lg">
        {/* Sends the visitor back where they were once they're signed in. */}
        <Link href={`/login?next=${encodeURIComponent(pathname)}`}>{t("signIn")}</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
      <Button variant="outline" size="lg" onClick={handleSignOut}>
        {t("signOut")}
      </Button>
    </div>
  );
}
