import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock firebase/auth so api.ts's token accessor reads a controllable user.
// `currentUserRef` lets each test flip between signed-in / signed-out.
const currentUserRef: { value: { uid: string } | null } = { value: null };
const getIdTokenMock = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: () => ({
    get currentUser() {
      return currentUserRef.value;
    },
  }),
  getIdToken: (user: unknown) => getIdTokenMock(user),
}));

import { apiFetch, api, ApiError } from "@/lib/api";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  currentUserRef.value = null;
  getIdTokenMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("attaches the Firebase ID token as a Bearer header", async () => {
    currentUserRef.value = { uid: "u1" };
    getIdTokenMock.mockResolvedValue("tok-123");
    fetchMock.mockResolvedValue(jsonResponse({ uid: "u1" }));

    const result = await apiFetch<{ uid: string }>("/api/auth/me");

    expect(result).toEqual({ uid: "u1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok-123");
  });

  it("omits the Authorization header when signed out", async () => {
    currentUserRef.value = null;
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/api/holdings");

    expect(getIdTokenMock).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("throws a typed ApiError with status + parsed body on non-2xx", async () => {
    currentUserRef.value = { uid: "u1" };
    getIdTokenMock.mockResolvedValue("tok-123");
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );

    const err = await apiFetch("/api/auth/me").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(401);
    expect(apiErr.message).toBe("unauthorized");
    expect(apiErr.body).toEqual({ error: "unauthorized" });
  });

  it("falls back to a generic message when the error body has no error field", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }));

    const err = await apiFetch("/api/x").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(500);
    expect(apiErr.message).toContain("500");
  });

  it("sends FormData untouched without forcing a JSON Content-Type", async () => {
    currentUserRef.value = { uid: "u1" };
    getIdTokenMock.mockResolvedValue("tok-123");
    fetchMock.mockResolvedValue(jsonResponse({ previewId: "p1" }, { status: 200 }));

    const form = new FormData();
    form.append("file", new Blob(["pdf"], { type: "application/pdf" }), "s.pdf");
    form.append("accountId", "acc-1");

    await api.post("/api/import/upload", form);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    const headers = new Headers(init.headers);
    // The browser must set the multipart Content-Type (with boundary) itself.
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.get("Authorization")).toBe("Bearer tok-123");
  });

  it("serialises a JSON body and sets Content-Type for posts", async () => {
    currentUserRef.value = { uid: "u1" };
    getIdTokenMock.mockResolvedValue("tok-123");
    fetchMock.mockResolvedValue(jsonResponse({ id: "h1" }, { status: 201 }));

    await api.post("/api/holdings", { ticker: "AAPL" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/holdings");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ ticker: "AAPL" }));
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
