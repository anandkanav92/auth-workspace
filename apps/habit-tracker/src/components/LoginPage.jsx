import { useState } from "react";
import { signInWithGoogle } from "@myorg/auth-google";

export default function LoginPage() {
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setSigningIn(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(145deg, #f5f5fa 0%, #ffffff 50%, #f0f0f8 100%)",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#1a1a2e",
            margin: "0 0 8px",
          }}
        >
          Habit Tracker
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#888",
            margin: "0 0 32px",
            fontFamily: "'Space Mono', monospace",
          }}
        >
          Build better habits, one day at a time
        </p>
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          style={{
            background: signingIn
              ? "#93b5f7"
              : "linear-gradient(135deg, #3B82F6, #2563EB)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 600,
            cursor: signingIn ? "default" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
          }}
        >
          {signingIn ? "Signing in..." : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
}
