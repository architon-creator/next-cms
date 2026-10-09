import { Button } from "ui";

// Reasons come from /auth/callback and /auth/login. Only known codes are shown
// as text, so an attacker cannot put their own words on this page via the URL.
const MESSAGES: Record<string, string> = {
  missing_login_state:
    "Your login session expired or was started in another browser. Please try again.",
  bad_login_state: "Your login session could not be read. Please try again.",
  state_mismatch: "The login response did not match the request. Please try again.",
  missing_code: "The login response was incomplete. Please try again.",
  no_id_token: "The identity provider did not return the expected data.",
  token_exchange_failed: "We could not complete the login with the identity provider.",
  idp_unreachable:
    "The identity provider is not reachable right now. Please try again later.",
  access_denied: "Access was denied.",
};

export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && MESSAGES[reason]) || "Login failed. Please try again.";

  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-4 p-6">
      <h1 className="text-3xl font-semibold">Could not log you in</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild className="self-start">
        {/* A plain anchor, not <Link>: prefetching would start a login in the background. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/auth/login?returnTo=/account">Try again</a>
      </Button>
    </div>
  );
}
