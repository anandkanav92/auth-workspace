import { useState, useRef, useEffect } from "react";
import EmojiPicker from "./EmojiPicker";
import { SHORT_DAYS, CATEGORY_PALETTE } from "../data/constants";

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
          background: "#ffffff",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 600,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "24px 20px 40px",
          position: "relative",
          border: "1px solid #e0e0eb",
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
              background: "#d0d0e0",
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
              background: "#f5f5fa",
              border: "1px solid #e0e0eb",
              borderRadius: 8,
              width: 32,
              height: 32,
              color: "#999",
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
              color: "#1a1a2e",
              fontFamily: "'DM Sans', sans-serif",
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
                color: "#999",
                fontFamily: "'Space Mono', monospace",
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
                color: "#999",
                fontFamily: "'Space Mono', monospace",
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
                fontFamily: "'DM Sans', sans-serif",
                border: "1px solid #e8e8f0",
                borderRadius: 12,
                outline: "none",
                background: "#fafafe",
                color: "#1a1a2e",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
              onBlur={(e) => (e.target.style.borderColor = "#e8e8f0")}
            />
          </div>

          {/* Category chips */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#999",
                fontFamily: "'Space Mono', monospace",
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
                      border: isActive ? `2px solid ${cat.color}` : "1px solid #e8e8f0",
                      background: isActive ? `${cat.color}10` : "#fff",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? cat.color : "#666",
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
                  border: "1px dashed #ccc",
                  background: "#fafafe",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#999",
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
                  background: "#fafafe",
                  borderRadius: 12,
                  border: "1px solid #e8e8f0",
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
                    fontFamily: "'DM Sans', sans-serif",
                    border: "1px solid #e8e8f0",
                    borderRadius: 8,
                    outline: "none",
                    background: "#fff",
                    color: "#1a1a2e",
                    boxSizing: "border-box",
                    marginBottom: 10,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                  onBlur={(e) => (e.target.style.borderColor = "#e8e8f0")}
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
                        border: newCategoryColor === color ? "3px solid #1a1a2e" : "2px solid transparent",
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
                      background: newCategoryName.trim() ? "#3B82F6" : "#ccc",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
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
                      border: "1px solid #e8e8f0",
                      background: "#fff",
                      color: "#999",
                      fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif",
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
                color: "#999",
                fontFamily: "'Space Mono', monospace",
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
                  border: isDaily ? "2px solid #3B82F6" : "1px solid #e8e8f0",
                  background: isDaily ? "#3B82F6" : "#fff",
                  color: isDaily ? "#fff" : "#666",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
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
                      border: isActive ? "2px solid #3B82F6" : "1px solid #e8e8f0",
                      background: isActive ? "#3B82F6" : "#f5f5fa",
                      color: isActive ? "#fff" : "#999",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "'Space Mono', monospace",
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
                color: "#999",
                fontFamily: "'Space Mono', monospace",
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
                  fontFamily: "'DM Sans', sans-serif",
                  border: "1px solid #e8e8f0",
                  borderRadius: 12,
                  outline: "none",
                  background: "#fafafe",
                  color: time ? "#1a1a2e" : "#999",
                  width: 140,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                onBlur={(e) => (e.target.style.borderColor = "#e8e8f0")}
              />
              {time && (
                <button
                  onClick={() => setTime("")}
                  style={{
                    background: "#f5f5fa",
                    border: "1px solid #e8e8f0",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    color: "#999",
                    cursor: "pointer",
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  Clear
                </button>
              )}
              {!time && (
                <span style={{
                  fontSize: 12,
                  color: "#bbb",
                  fontFamily: "'Space Mono', monospace",
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
                  color: "#3B82F6",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
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
                    color: "#999",
                    fontFamily: "'Space Mono', monospace",
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
                    fontFamily: "'DM Sans', sans-serif",
                    border: "1px solid #e8e8f0",
                    borderRadius: 12,
                    outline: "none",
                    background: "#fafafe",
                    color: "#1a1a2e",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                  onBlur={(e) => (e.target.style.borderColor = "#e8e8f0")}
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
                ? "linear-gradient(135deg, #3B82F6, #2563EB)"
                : "#e0e0e8",
              color: canSave ? "#fff" : "#aaa",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
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
                    border: "1px solid #e8e8f0",
                    background: "#f5f5fa",
                    color: "#999",
                    fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif",
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
