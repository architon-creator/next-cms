import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui";

import { currentSession } from "@/lib/oidc/auth";

import { AccountClient } from "./account-client";

// Example of a page that needs the OIDC login. proxy.ts already redirects a
// request with no session cookie; this is the real check (session store lookup).
export default async function AccountPage() {
  const cur = await currentSession();
  if (!cur) redirect("/auth/login?returnTo=/account");

  return (
    <div className="mx-auto flex max-w-[700px] flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">
          Logged in through the identity provider. The browser holds only a session
          cookie; the tokens stay on the server.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{cur.s.name ?? cur.s.email ?? cur.s.sub}</CardTitle>
          <CardDescription>Who the identity provider says you are</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">sub</dt>
            <dd className="font-mono text-xs break-all">{cur.s.sub}</dd>
            <dt className="text-muted-foreground">email</dt>
            <dd>{cur.s.email ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <AccountClient />
    </div>
  );
}
