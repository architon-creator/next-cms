import bcrypt from "bcryptjs";
import type { PublicUser, User } from "../types/auth.js";

// In-memory placeholder directory, in the same spirit as the cart/flight
// stores — replace with a real datastore once there's one to talk to.
// Everything below is written so that swapping the array for a repository
// is the only change needed: nothing outside this module touches a User.

const DEFAULT_DEMO_PASSWORD = "password123";

const demoEmail = process.env.DEMO_USER_EMAIL || "demo@example.com";
const demoPassword = process.env.DEMO_USER_PASSWORD || DEFAULT_DEMO_PASSWORD;

// A well-known password baked into the repo is fine for local scaffolding and
// unacceptable anywhere real, so refuse to boot on it in production rather
// than shipping a publicly-known login.
if (process.env.NODE_ENV === "production" && demoPassword === DEFAULT_DEMO_PASSWORD) {
  throw new Error(
    "DEMO_USER_PASSWORD must be set to something other than the default in production",
  );
}

const users: User[] = [
  {
    id: "usr-1",
    email: demoEmail.toLowerCase(),
    name: "Demo User",
    // Hashed at boot rather than checked in as a literal, so rotating the
    // seed password is an env change and never a code change.
    passwordHash: bcrypt.hashSync(demoPassword, 10),
  },
];

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}

export function findUserById(id: string): User | undefined {
  return users.find((user) => user.id === id);
}

/**
 * Verifies an email/password pair. Always runs a bcrypt comparison, even when
 * the email matches nobody, so that response timing doesn't reveal which
 * addresses are registered.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  const user = users.find((candidate) => candidate.email === email.trim().toLowerCase());
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const matches = await bcrypt.compare(password, hash);

  return user && matches ? user : null;
}

/** Compared against when no user matched, purely to burn the same time. */
const DUMMY_HASH = bcrypt.hashSync("password-that-matches-nothing", 10);
