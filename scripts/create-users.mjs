// Creates login accounts for the demo. Prints the env lines to add to .env.local (and to Vercel),
// plus the generated passwords. Nothing is written to the repo.
//
//   node scripts/create-users.mjs sofie anna tom
//
// User ids must exist in the knowledge base (people in src/trust-engine/mock/people.ts).
import { randomBytes, scryptSync } from "node:crypto";

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error("Usage: node scripts/create-users.mjs <userId> [userId...]");
  process.exit(1);
}

const entries = [];
console.log("Passwords (share privately with the team, do not commit):");
for (const id of ids) {
  const password = randomBytes(12).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  entries.push(`${id}:${salt}:${scryptSync(password, salt, 32).toString("hex")}`);
  console.log(`  ${id}  ${password}`);
}

console.log("\nEnv (.env.local and Vercel project settings):");
console.log(`SESSION_SECRET=${randomBytes(32).toString("hex")}`);
console.log(`AUTH_USERS=${entries.join(",")}`);
