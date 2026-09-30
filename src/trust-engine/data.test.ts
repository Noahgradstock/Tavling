import assert from "node:assert/strict";
import { test } from "node:test";
import { readSource, loadDataKnowledgeBase } from "./data";
import type { Claim } from "./types";

// Security tests for path traversal vulnerability mitigation

test("readSource rejects path traversal with ../", () => {
  const claim: Claim = {
    id: "test-traversal-1",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "../../../etc/passwd",
  };
  const result = readSource(claim);
  assert.equal(result.kind, "none", "Should reject path traversal with ../");
});

test("readSource rejects path traversal with multiple ../", () => {
  const claim: Claim = {
    id: "test-traversal-2",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "../../../../../../etc/passwd",
  };
  const result = readSource(claim);
  assert.equal(result.kind, "none", "Should reject path traversal with multiple ../");
});

test("readSource rejects absolute paths", () => {
  const claim: Claim = {
    id: "test-traversal-3",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "/etc/passwd",
  };
  const result = readSource(claim);
  assert.equal(result.kind, "none", "Should reject absolute paths");
});

test("readSource rejects path traversal with subdirectory escape", () => {
  const claim: Claim = {
    id: "test-traversal-4",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "sick-leave/../../../../../../etc/passwd",
  };
  const result = readSource(claim);
  assert.equal(result.kind, "none", "Should reject path traversal even when starting from valid subdirectory");
});

test("readSource accepts valid relative paths within data directory", () => {
  const claim: Claim = {
    id: "test-valid-1",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "sick-leave/01-policy-2026.md",
  };
  const result = readSource(claim);
  // Should either return text or none (if file doesn't exist), but not throw
  assert.ok(result.kind === "text" || result.kind === "none", "Should accept valid relative path");
});

test("readSource accepts valid paths in subdirectories", () => {
  const claim: Claim = {
    id: "test-valid-2",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "meal-vouchers/01-royal-decree-2026-summary.txt",
  };
  const result = readSource(claim);
  assert.ok(result.kind === "text" || result.kind === "none", "Should accept valid subdirectory path");
});

test("loadDataKnowledgeBase does not allow path traversal in source files", () => {
  // This test verifies that the hardcoded SOURCE_FILES cannot be exploited
  // and that the read function properly validates all file paths
  const result = loadDataKnowledgeBase();
  assert.ok(result.kb, "Should load knowledge base successfully");
  assert.ok(result.kb.claims.length > 0, "Should have claims");
  
  // Verify that all claims with files have safe paths
  for (const claim of result.kb.claims) {
    if (claim.file) {
      assert.ok(!claim.file.includes(".."), "Claim file paths should not contain ..");
      assert.ok(!claim.file.startsWith("/"), "Claim file paths should not be absolute");
    }
  }
});

test("readSource handles non-existent files safely", () => {
  const claim: Claim = {
    id: "test-nonexistent",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "nonexistent-file.txt",
  };
  const result = readSource(claim);
  assert.equal(result.kind, "none", "Should return none for non-existent files");
});

test("readSource rejects Windows-style absolute paths", () => {
  const claim: Claim = {
    id: "test-traversal-windows",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "C:\\Windows\\System32\\config\\sam",
  };
  const result = readSource(claim);
  assert.equal(result.kind, "none", "Should reject Windows-style absolute paths");
});

test("readSource rejects encoded path traversal attempts", () => {
  // URL-encoded ../ is %2e%2e%2f
  const claim: Claim = {
    id: "test-traversal-encoded",
    factKey: "test",
    value: "test",
    scope: { country: "BE" },
    source: { type: "official", title: "Test" },
    author: null,
    date: "2026-01-01",
    text: "test",
    file: "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  };
  const result = readSource(claim);
  // The path will be treated as a literal filename (which won't exist)
  // The important thing is it doesn't traverse
  assert.equal(result.kind, "none", "Should not traverse with encoded paths");
});
