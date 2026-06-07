import { useState, useRef, useEffect } from "react";
import EmojiPicker from "./EmojiPicker";
import { SHORT_DAYS, CATEGORY_PALETTE, THEME } from "../data/constants";

export default function HabitForm({ habit, categories, onSave, onDelete, onClose, onAddCategory }) {
  const isEdit = habit !== null && habit !== undefined;

  const [icon, setIcon] = useState(isEdit ? habit.icon : "✅");
  const [name, setName] = useState(isEdit ? habit.name : "");
  const [categoryId, setCategoryId] = useState(isEdit ? habit.categoryId : (categories[0]?.id || ""));
  const [days, setDays] = useState(isEdit ? [...habit.days] : [0, 1, 2, 3, 4, 5, 6]);
  const [notes, setNotes] = useState(isEdit ? (habit.notes || "") : "");
  const [time, setTime] = useState(isEdit ? (habit.time || "") : "");
  const [showNotes, setShowNotes] = useState(isEdit && !!habit.notes);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_PALETTE[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameInputRef = useRef(null);

  const isDaily = days.length === 7;
  const canSave = name.trim().length > 0 && categoryId && days.length > 0;

  function handleEmojiSelect(emoji) {
    setIcon(emoji);
    // Auto-focus name input after emoji pick
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  function toggleDaily() {
    if (isDaily) {
      setDays([]);
    } else {
      setDays([0, 1, 2, 3, 4, 5, 6]);
    }
  }

  function toggleDay(dayIndex) {
    setDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  }

  function handleAddCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    onAddCategory({ name: trimmed, color: newCategoryColor });
    setNewCategoryName("");
    setNewCategoryColor(CATEGORY_PALETTE[0]);
    setShowNewCategory(false);
  }

  function handleSave() {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      icon,
      categoryId,
      days,
      notes: notes.trim(),
      time: time || null,
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete();
  }

  // Find the active category color for styling day buttons
  const activeCategory = categories.find((c) => c.id === categoryId);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: THEME.surface,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 600,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "24px 20px 40px",
          position: "relative",
          border: `1px solid ${THEME.border}`,
          borderBottom: "none",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .habit-form-inner { animation: slideUp 0.25s ease; }
        `}</style>

        <div className="habit-form-inner">
          {/* Drag handle */}
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: THEME.borderStrong,
              margin: "0 auto 20px",
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: THEME.surfaceAlt,
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              width: 32,
              height: 32,
              color: THEME.textMuted,
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>

          {/* Title */}
          <h2
            style={{
              margin: "0 0 20px",
              fontSize: 22,
              fontWeight: 700,
              color: THEME.text,
              fontFamily: THEME.sans,
            }}
          >
            {isEdit ? "Edit Habit" : "New Habit"}
          </h2>

          {/* Emoji Picker */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: THEME.textMuted,
                fontFamily: THEME.mono,
                letterSpacing: "1px",
                marginBottom: 8,
              }}
            >
              ICON
            </label>
            <EmojiPicker onSelect={handleEmojiSelect} selected={icon} />
          </div>

          {/* Name input */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: THEME.textMuted,
                fontFamily: THEME.mono,
                letterSpacing: "1px",
                marginBottom: 8,
              }}
            >
              NAME
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Habit name"
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 15,
                fontFamily: THEME.sans,
                border: `1px solid ${THEME.border}`,
                borderRadius: 12,
                outline: "none",
                background: THEME.surfaceAlt,
                color: THEME.text,
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = THEME.accent)}
              onBlur={(e) => (e.target.style.borderColor = THEME.border)}
            />
          </div>

          {/* Category chips */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: THEME.textMuted,
                fontFamily: THEME.mono,
                letterSpacing: "1px",
                marginBottom: 8,
              }}
            >
              CATEGORY
            </label>
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                paddingBottom: 4,
              }}
            >
              {categories.map((cat) => {
                const isActive = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: isActive ? `2px solid ${cat.color}` : `1px solid ${THEME.border}`,
                      background: isActive ? `${cat.color}10` : THEME.surface,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                      fontFamily: THEME.sans,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? cat.color : THEME.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: cat.color,
                        flexShrink: 0,
                      }}
                    />
                    {cat.name}
                  </button>
                );
              })}

              {/* "+ New" chip */}
              <button
                onClick={() => setShowNewCategory(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: `1px dashed ${THEME.accent}`,
                  background: THEME.accentTint,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontSize: 13,
                  fontFamily: THEME.sans,
                  color: THEME.accent,
                  flexShrink: 0,
                }}
              >
                + New
              </button>
            </div>

            {/* Inline new category creation */}
            {showNewCategory && (
              <div
                style={{
                  marginTop: 10,
                  padding: "12px 14px",
                  background: THEME.surfaceAlt,
                  borderRadius: 12,
                  border: `1px solid ${THEME.border}`,
                }}
              >
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    fontFamily: THEME.sans,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 8,
                    outline: "none",
                    background: THEME.surface,
                    color: THEME.text,
                    boxSizing: "border-box",
                    marginBottom: 10,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = THEME.accent)}
                  onBlur={(e) => (e.target.style.borderColor = THEME.border)}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  {CATEGORY_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: color,
                        border: newCategoryColor === color ? `3px solid ${THEME.text}` : "2px solid transparent",
                        cursor: "pointer",
                        flexShrink: 0,
                        outline: newCategoryColor === color ? "2px solid #fff" : "none",
                        outlineOffset: -4,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: newCategoryName.trim() ? THEME.accent : THEME.borderStrong,
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: THEME.sans,
                      cursor: newCategoryName.trim() ? "pointer" : "default",
                    }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewCategory(false);
                      setNewCategoryName("");
                      setNewCategoryColor(CATEGORY_PALETTE[0]);
                    }}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 8,
                      border: `1px solid ${THEME.border}`,
                      background: THEME.surface,
                      color: THEME.textMuted,
                      fontSize: 13,
                      fontFamily: THEME.sans,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Days selector */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: THEME.textMuted,
                fontFamily: THEME.mono,
                letterSpacing: "1px",
                marginBottom: 8,
              }}
            >
              REPEAT
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* Daily toggle */}
              <button
                onClick={toggleDaily}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: isDaily ? `2px solid ${THEME.accent}` : `1px solid ${THEME.border}`,
                  background: isDaily ? THEME.accent : THEME.surface,
                  color: isDaily ? "#fff" : THEME.textMuted,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: THEME.sans,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Daily
              </button>

              {/* Day buttons */}
              {SHORT_DAYS.map((label, index) => {
                const isActive = days.includes(index);
                return (
                  <button
                    key={index}
                    onClick={() => toggleDay(index)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: isActive ? `2px solid ${THEME.accent}` : `1px solid ${THEME.border}`,
                      background: isActive ? THEME.accent : THEME.surfaceAlt,
                      color: isActive ? "#fff" : THEME.textMuted,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: THEME.mono,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time picker */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: THEME.textMuted,
                fontFamily: THEME.mono,
                letterSpacing: "1px",
                marginBottom: 8,
              }}
            >
              TIME
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{
                  padding: "8px 14px",
                  fontSize: 14,
                  fontFamily: THEME.sans,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 12,
                  outline: "none",
                  background: THEME.surfaceAlt,
                  color: time ? THEME.text : THEME.textMuted,
                  width: 140,
                }}
                onFocus={(e) => (e.target.style.borderColor = THEME.accent)}
                onBlur={(e) => (e.target.style.borderColor = THEME.border)}
              />
              {time && (
                <button
                  onClick={() => setTime("")}
                  style={{
                    background: THEME.surfaceAlt,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    color: THEME.textMuted,
                    cursor: "pointer",
                    fontFamily: THEME.mono,
                  }}
                >
                  Clear
                </button>
              )}
              {!time && (
                <span style={{
                  fontSize: 12,
                  color: THEME.textFaint,
                  fontFamily: THEME.mono,
                }}>
                  All day
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            {!showNotes ? (
              <button
                onClick={() => setShowNotes(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: THEME.accent,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: THEME.sans,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Add notes +
              </button>
            ) : (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: THEME.textMuted,
                    fontFamily: THEME.mono,
                    letterSpacing: "1px",
                    marginBottom: 8,
                  }}
                >
                  NOTES
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Optional notes..."
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: 14,
                    fontFamily: THEME.sans,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 12,
                    outline: "none",
                    background: THEME.surfaceAlt,
                    color: THEME.text,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = THEME.accent)}
                  onBlur={(e) => (e.target.style.borderColor = THEME.border)}
                />
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: canSave
                ? THEME.accentGradient
                : THEME.border,
              color: canSave ? "#fff" : THEME.textFaint,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: THEME.sans,
              cursor: canSave ? "pointer" : "default",
              marginBottom: isEdit ? 12 : 0,
            }}
          >
            {isEdit ? "Save Changes" : "Create Habit"}
          </button>

          {/* Delete (edit mode only) */}
          {isEdit && !confirmDelete && (
            <button
              onClick={handleDelete}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 12,
                border: "none",
                background: "none",
                color: "#E8453C",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
              }}
            >
              Delete Habit
            </button>
          )}

          {isEdit && confirmDelete && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <p
                style={{
                  fontSize: 14,
                  color: "#E8453C",
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  marginBottom: 10,
                }}
              >
                Are you sure?
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  onClick={() => onDelete()}
                  style={{
                    padding: "8px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: "#E8453C",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    padding: "8px 24px",
                    borderRadius: 8,
                    border: `1px solid ${THEME.border}`,
                    background: THEME.surfaceAlt,
                    color: THEME.textMuted,
                    fontSize: 13,
                    fontFamily: THEME.sans,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
