// Public API of the trust engine. Import from here, not from the individual files.
export * from "./types";
export { POINTS, CAPS, HALF_LIFE_DAYS, STATUS } from "./config";
export { evaluateFact } from "./score";
export { matchScope } from "./scope";
export { ask, matchFact, type AskResult } from "./ask";
export { MemoryFeedbackStore, parseFeedback, parseContext, type FeedbackStore } from "./feedback";
export { mockKnowledgeBase, MOCK_NOW } from "./mock";
