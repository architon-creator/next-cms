import { StoreResetDemoClient } from "./store-reset-demo-client";

// Demo route (like calendar-poc / otel-demo) for the cross-app store reset in
// packages/app-state. Not linked from the main navigation.
export default function StoreResetDemoPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Cross-app store reset: app 1</h1>
      <StoreResetDemoClient />
    </main>
  );
}
