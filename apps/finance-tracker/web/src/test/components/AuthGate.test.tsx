import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { AuthGate } from "@/components/auth/AuthGate";

// Mock the whole auth package: AuthGate only depends on useAuth, and LoginPage
// (rendered when signed out) depends on SignInButton. We stub both so nothing
// touches real Firebase.
const useAuthMock = vi.fn();

vi.mock("@myorg/auth-google", () => ({
  useAuth: () => useAuthMock(),
  SignInButton: ({ className }: { className?: string }) => (
    <button className={className}>Sign in with Google</button>
  ),
}));

beforeEach(() => {
  useAuthMock.mockReset();
});

describe("AuthGate", () => {
  it("renders the LoginPage when there is no user", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });

    render(
      <AuthGate>
        <div>protected content</div>
      </AuthGate>,
    );

    expect(
      screen.getByRole("button", { name: /sign in with google/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders children when a user is signed in", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u1", email: "a@b.com", displayName: "A", photoURL: null },
      loading: false,
    });

    render(
      <AuthGate>
        <div>protected content</div>
      </AuthGate>,
    );

    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign in with google/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a loading state while auth is resolving", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });

    render(
      <AuthGate>
        <div>protected content</div>
      </AuthGate>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign in with google/i }),
    ).not.toBeInTheDocument();
  });
});
