/**
 * The /labels tool has a materially bigger blast radius than the rest of
 * admin-app: it spawns local shell processes (see lib/spawn-log.ts) and,
 * via Seed, writes real content to the real Prismic repository — with no
 * auth in front of any of it, same as every other route here. Unlike the
 * migration routes (which only ever call Prismic's own API), a bug or an
 * unvalidated input here has a path to arbitrary local command execution,
 * not just an unwanted Prismic write. Until this app has real auth,
 * /labels fails closed outside local development: a deployed environment
 * must opt in explicitly via ENABLE_LABELS_TOOL=true, rather than this
 * being reachable the moment admin-app itself is deployed somewhere.
 */
export function isLabelsToolEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ENABLE_LABELS_TOOL === "true";
}
