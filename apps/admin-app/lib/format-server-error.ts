// Client-safe formatting for the payload lib/migration-errors.ts's
// formatMigrationError builds server-side, sent as an SSE "error"
// event's data. Kept separate from that file since this one runs in
// the browser and that one imports server-only prismic-migration code.
export type ServerErrorPayload = {
  message: string;
  status?: number;
  body?: string;
  kind?: "lock_conflict";
};

export function formatServerError(payload: ServerErrorPayload): string {
  if (!payload.status && !payload.body) return payload.message;
  const parts = [payload.message];
  if (payload.status) parts.push(`(HTTP ${payload.status})`);
  if (payload.body) parts.push(`— ${payload.body}`);
  return parts.join(" ");
}
