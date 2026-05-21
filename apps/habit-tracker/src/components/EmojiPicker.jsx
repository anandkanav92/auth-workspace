import { useState, useMemo } from "react";

const EMOJI_CATEGORIES = [
  {
    id: "frequent",
    icon: "⭐",
    label: "Frequent",
    emojis: ["✅","📚","💪","🏃","🧘","🎯","💧","🔥","⭐","📝","✍️","🎵","🧹","💤","🌅","🚶","💊","🧠","📖","🎨"],
  },
  {
    id: "fitness",
    icon: "🏋️",
    label: "Fitness",
    emojis: ["🏋️","🚴","🏊","🤸","⚽","🏀","🎾","🥊","🧗","🏓","🥋","🤾","🏈","⛹️","🏑","🥅","🤼","🏌️","🎿","⛷️"],
  },
  {
    id: "food",
    icon: "🥗",
    label: "Food",
    emojis: ["🥗","🍎","🥑","🥦","🍌","🥕","🍳","🥤","🍕","🍔","☕","🧃","🥜","🫐","🍓","🥒","🍇","🌽","🍗","🥩"],
  },
  {
    id: "nature",
    icon: "🌳",
    label: "Nature",
    emojis: ["🌳","🌻","🌊","🏔️","🌙","⭐","🌅","🌿","🦋","🐕","🌺","☀️","🌧️","❄️","🍃","🌵","🦅","🐝","🪻","🌾"],
  },
  {
    id: "objects",
    icon: "💻",
    label: "Objects",
    emojis: ["💻","📱","📷","🎧","🔑","💡","🛠️","🧳","✈️","🚗","📦","💰","🔔","⏰","📐","🧲","🔬","💎","🏠","📮"],
  },
  {
    id: "activities",
    icon: "🎮",
    label: "Activities",
    emojis: ["🎮","🎬","📚","🎨","🎵","🎤","🎭","🧩","♟️","🎯","🎳","🎲","🎪","🎸","🎹","📸","🎻","🧶","🪡","📻"],
  },
  {
    id: "symbols",
    icon: "❤️",
    label: "Symbols",
    emojis: ["❤️","💜","💙","💚","💛","🧡","🤍","🖤","⚡","✨","🔥","💫","⭕","❌","✅","🔴","🟠","🟡","🟢","🔵","🟣"],
  },
  {
    id: "faces",
    icon: "😀",
    label: "Faces",
    emojis: ["😀","😊","😎","🤓","😴","🥳","🤔","😤","😅","🥰","😇","🤩","😏","🫡","🙃","😶","🤗","🫠","😌","🥱"],
  },
];

export default function EmojiPicker({ onSelect, selected }) {
  const [activeCategoryId, setActiveCategoryId] = useState(EMOJI_CATEGORIES[0].id);

  const activeCategory = useMemo(
    () => EMOJI_CATEGORIES.find((c) => c.id === activeCategoryId) || EMOJI_CATEGORIES[0],
    [activeCategoryId]
  );

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 12,
        border: "1px solid #e8e8f0",
        overflow: "hidden",
      }}
    >
      {/* Selected emoji preview */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderBottom: "1px solid #f0f0f8",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#f5f5fa",
            border: "1px solid #e8e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {selected || "❓"}
        </div>
        <span
          style={{
            fontSize: 12,
            color: "#999",
            fontFamily: "'Space Mono', monospace",
          }}
        >
          {selected ? "Tap below to change" : "Pick an emoji"}
        </span>
      </div>

      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          height: 36,
          borderBottom: "1px solid #f0f0f8",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {EMOJI_CATEGORIES.map((cat) => {
          const isActive = cat.id === activeCategoryId;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              style={{
                flex: "1 0 auto",
                minWidth: 40,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #3B82F6" : "2px solid transparent",
                fontSize: 18,
                cursor: "pointer",
                opacity: isActive ? 1 : 0.5,
                transition: "opacity 0.15s ease, border-color 0.15s ease",
                padding: "0 6px",
              }}
              title={cat.label}
            >
              {cat.icon}
            </button>
          );
        })}
      </div>

      {/* Emoji grid */}
      <div
        style={{
          maxHeight: 250,
          overflowY: "auto",
          padding: 8,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 2,
          }}
        >
          {activeCategory.emojis.map((emoji, idx) => {
            const isSelected = emoji === selected;
            return (
              <button
                key={`${emoji}-${idx}`}
                onClick={() => onSelect(emoji)}
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  background: isSelected ? "#3B82F615" : "transparent",
                  border: isSelected ? "1px solid #3B82F640" : "1px solid transparent",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "background 0.12s ease",
                  margin: "0 auto",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#f5f5fa";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
