import { describe, expect, it } from "vitest";
import { canTransition, type QuoteStatus } from "./quotes";

describe("quote lifecycle transitions", () => {
  const allowed: [QuoteStatus, QuoteStatus][] = [
    ["Draft", "Generated"],
    ["Generated", "Sent"],
    ["Generated", "Approved"],
    ["Generated", "Rejected"],
    ["Sent", "Approved"],
    ["Sent", "Rejected"],
  ];
  const blocked: [QuoteStatus, QuoteStatus][] = [
    ["Approved", "Sent"],
    ["Rejected", "Approved"],
    ["Expired", "Sent"],
    ["Expired", "Generated"],
    ["Sent", "Generated"],
    ["Generated", "Generated"],
    // Expiry is automatic, never a manual transition
    ["Generated", "Expired"],
    ["Sent", "Expired"],
  ];

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(blocked)("blocks %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});
