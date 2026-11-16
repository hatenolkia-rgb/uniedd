import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { courseForGame, readCertificate, signCertificate, validateLead } from "../app/lib/games/lead";
import { signSession } from "../app/lib/games/session";
import { POST } from "../app/api/games/lead/route";

const good = { name: "Riya Sharma", phone: "+91 98765 43210", childAge: "9–12", consent: true };

describe("validateLead", () => {
  it("accepts a normal parent entry and keeps only digits of the phone", () => {
    expect(validateLead(good)).toEqual({ lead: { name: "Riya Sharma", phoneDigits: "919876543210", childAge: "9–12" } });
  });

  it("lets real names through that contain rude letter runs", () => {
    for (const name of ["Michelle", "Hassan Ali", "Tithi", "Shellina D'Souza", "Ananya"]) {
      expect(validateLead({ ...good, name })).toHaveProperty("lead");
    }
  });

  it("rejects rude whole words, missing consent, bad phones and unknown ages", () => {
    expect(validateLead({ ...good, name: "Stupid Kid" })).toHaveProperty("error");
    expect(validateLead({ ...good, consent: false })).toHaveProperty("error");
    expect(validateLead({ ...good, phone: "98765" })).toHaveProperty("error");
    expect(validateLead({ ...good, phone: "9876543210" })).toHaveProperty("error"); // no country code
    expect(validateLead({ ...good, childAge: "40" })).toHaveProperty("error");
    expect(validateLead({ ...good, name: "<script>" })).toHaveProperty("error");
  });
});

describe("certificate links", () => {
  it("round-trips and refuses edited links", () => {
    const token = signCertificate({ n: "Riya", g: "chord-shapes", s: 120, d: "16 November 2026" });
    expect(readCertificate(token)).toEqual({ n: "Riya", g: "chord-shapes", s: 120, d: "16 November 2026" });
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ n: "Anyone", g: "chord-shapes", s: 9999, d: "x" })).toString("base64url");
    expect(readCertificate(`${forged}.${sig}`)).toBeNull();
    expect(readCertificate(`${body}.nope`)).toBeNull();
  });

  it("maps game categories to LMS courses", () => {
    expect(courseForGame("chord-shapes")).toBe("Guitar");
    expect(courseForGame("no-such-game")).toBeNull();
  });
});

describe("POST /api/games/lead", () => {
  const call = (body: object, ip = "1.2.3.4") =>
    POST(new Request("https://uniedd.com/api/games/lead", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) }));
  const playedToken = () => {
    const { token } = signSession("chord-shapes");
    // A real round: started 20 s ago.
    vi.setSystemTime(Date.now() + 20_000);
    return token;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("LMS_BOOKING_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hands a valid lead to the LMS with the game name and a certificate link", async () => {
    const mockFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    const res = await call({ ...good, token: playedToken(), score: 120 }, "10.0.0.1");
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ ok: true, whatsapp: true });
    expect(data.certificateUrl).toMatch(/^https:\/\/uniedd\.com\/api\/games\/certificate\?c=[\w-]+\.[\w-]+$/);
    const [url, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://lms.uniedd.com/api/meta");
    expect((init.headers as Record<string, string>)["x-booking-secret"]).toBe("test-secret");
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "game-lead",
      lead: { name: "Riya Sharma", phone: "919876543210", childAge: "9–12", gameTitle: "Chord Shape Quiz", course: "Guitar", score: 120 },
    });
  });

  it("refuses without a played round, and only one certificate per round", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    expect((await call({ ...good, score: 120 }, "10.0.0.2")).status).toBe(400);
    const token = playedToken();
    expect((await call({ ...good, phone: "+91 91111 11111", token, score: 120 }, "10.0.0.3")).status).toBe(200);
    expect((await call({ ...good, phone: "+91 92222 22222", token, score: 120 }, "10.0.0.3")).status).toBe(409);
  });

  it("silently drops bots that fill the hidden field", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    const res = await call({ ...good, website: "spam", token: playedToken(), score: 120 }, "10.0.0.4");
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
