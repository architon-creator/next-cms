import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="mb-1 text-3xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your account.
        </p>
      </div>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            We&rsquo;ll keep you signed in on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
