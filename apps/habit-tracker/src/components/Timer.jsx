import { useState, useEffect, useRef, useCallback } from "react";

const PRESETS = [30, 45, 60, 90, 120, 180];
const MAX_SECONDS = 300; // 5 min max

// Shared AudioContext — created and unlocked on first user tap (play button).
// Mobile browsers require AudioContext to start from a user gesture.
let audioCtx = null;

export function unlockAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (iOS suspends by default)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

export function playAlarm() {
  try {
    if (!audioCtx) unlockAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const beep = (freq, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    // Three ascending beeps like an oven timer
    const t = audioCtx.currentTime;
    beep(880, t, 0.2);
    beep(988, t + 0.3, 0.2);
    beep(1108, t + 0.6, 0.2);
    // Repeat after a short pause
    beep(880, t + 1.0, 0.2);
    beep(988, t + 1.3, 0.2);
    beep(1108, t + 1.6, 0.2);
  } catch {
    // AudioContext not available
  }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function angleToSeconds(angle) {
  // 0° = 12 o'clock = 0s, clockwise
  const normalized = ((angle % 360) + 360) % 360;
  return Math.round((normalized / 360) * MAX_SECONDS);
}

function secondsToAngle(seconds) {
  return (seconds / MAX_SECONDS) * 360;
}

/**
 * RestTimer — renders the circular dial, preset chips, and play/pause/reset controls.
 * All state is managed by the parent; this is a controlled component.
 */
export default function RestTimer({ totalSeconds, remaining, running, onSetTime, onPlay, onPause, onReset }) {
  const [dragging, setDragging] = useState(false);
  const circleRef = useRef(null);

  // Drag handling for the circular dial
  const getAngleFromEvent = useCallback((clientX, clientY) => {
    if (!circleRef.current) return 0;
    const rect = circleRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // atan2 gives angle from positive x-axis, we want from top (negative y)
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  }, []);

  const handleDragStart = (e) => {
    if (running) return;
    e.preventDefault();
    setDragging(true);
    const touch = e.touches ? e.touches[0] : e;
    const angle = getAngleFromEvent(touch.clientX, touch.clientY);
    const secs = angleToSeconds(angle);
    const snapped = Math.round(secs / 5) * 5 || 5;
    onSetTime(snapped);
  };

  const handleDragMove = useCallback((e) => {
    if (!dragging) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const angle = getAngleFromEvent(touch.clientX, touch.clientY);
    const secs = angleToSeconds(angle);
    const snapped = Math.round(secs / 5) * 5 || 5;
    onSetTime(snapped);
  }, [dragging, getAngleFromEvent, onSetTime]);

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [dragging, handleDragMove, handleDragEnd]);

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const circumference = 2 * Math.PI * 52;
  const strokeOffset = circumference * (1 - progress);
  const knobAngle = secondsToAngle(running ? remaining : totalSeconds);
  const knobRad = (knobAngle - 90) * (Math.PI / 180);
  const knobX = 60 + 52 * Math.cos(knobRad);
  const knobY = 60 + 52 * Math.sin(knobRad);

  const isFinished = remaining === 0 && !running;
  const timerColor = isFinished ? "#E8453C" : running ? "#10B981" : "#3B82F6";

  return (
    <div>
      {/* Circular dial + time */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
          <svg
            ref={circleRef}
            width="120" height="120"
            viewBox="0 0 120 120"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            style={{ cursor: running ? "default" : "pointer", touchAction: "none" }}
          >
            {/* Background track */}
            <circle cx="60" cy="60" r="52" fill="none" stroke="#f0f0f8" strokeWidth="8" />
            {/* Tick marks */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
              const r1 = 44, r2 = 47;
              const rad = (deg - 90) * (Math.PI / 180);
              return (
                <line key={deg}
                  x1={60 + r1 * Math.cos(rad)} y1={60 + r1 * Math.sin(rad)}
                  x2={60 + r2 * Math.cos(rad)} y2={60 + r2 * Math.sin(rad)}
                  stroke="#ddd" strokeWidth="1.5"
                />
              );
            })}
            {/* Progress arc */}
            <circle cx="60" cy="60" r="52" fill="none"
              stroke={timerColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 60 60)"
              style={{ transition: dragging ? "none" : "stroke-dashoffset 0.3s ease" }}
            />
            {/* Draggable knob */}
            {!running && (
              <circle cx={knobX} cy={knobY} r="8"
                fill="#fff" stroke={timerColor} strokeWidth="3"
                style={{ cursor: "grab", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.15))" }}
              />
            )}
          </svg>
          {/* Center time display */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{
              fontSize: 26, fontWeight: 700, color: timerColor,
              fontFamily: "'Space Mono', monospace", lineHeight: 1,
            }}>
              {formatTime(remaining)}
            </span>
            <span style={{ fontSize: 9, color: "#aaa", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>
              {running ? "remaining" : "drag to set"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {!running ? (
            <button onClick={onPlay} style={{
              width: 52, height: 52, borderRadius: "50%", border: "none",
              background: "linear-gradient(135deg, #10B981, #059669)",
              color: "#fff", fontSize: 20, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>▶</button>
          ) : (
            <button onClick={onPause} style={{
              width: 52, height: 52, borderRadius: "50%", border: "none",
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#fff", fontSize: 16, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700,
            }}>⏸</button>
          )}
          <button onClick={onReset} style={{
            width: 36, height: 36, borderRadius: "50%", border: "1px solid #e0e0eb",
            background: "#f9f9fc", color: "#888", fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} title="Reset">↻</button>
        </div>
      </div>

      {/* Preset buttons */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
        {PRESETS.map((secs) => {
          const isActive = totalSeconds === secs && !running;
          const label = secs >= 60 ? `${secs / 60}m` : `${secs}s`;
          return (
            <button key={secs} onClick={() => onSetTime(secs)} style={{
              padding: "6px 12px", borderRadius: 8,
              border: isActive ? `1px solid #3B82F640` : "1px solid #e0e0eb",
              background: isActive ? "#3B82F610" : "#f9f9fc",
              color: isActive ? "#3B82F6" : "#888",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
            }}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
