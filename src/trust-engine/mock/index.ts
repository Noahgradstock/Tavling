import type { KnowledgeBase } from "../types";
import { email } from "./email";
import { official } from "./official";
import { clients, facts, people } from "./people";
import { sharepoint } from "./sharepoint";
import { teams } from "./teams";

// Fixed "today" for the mock data so scores are the same on every run.
export const MOCK_NOW = new Date("2026-09-30T12:00:00Z");

export const mockKnowledgeBase: KnowledgeBase = {
  facts,
  people,
  clients,
  claims: [...official, ...teams, ...sharepoint, ...email],
};
