import React from "react";
import { motion } from "motion/react";
import { cx } from "./ui";

// tabs = [{ value, label, icon }]; the panel itself is rendered by the caller
function Tabs({ tabs, value, onChange, layoutId = "tabs", idPrefix = "tab" }) {
  const handleKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;

    if (step) {
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      onChange(next.value);
      document.getElementById(`${idPrefix}-${next.value}`)?.focus();
    }
  };

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <button
            key={tab.value}
            id={`${idPrefix}-${tab.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cx(
              "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg"
            )}
          >
            {tab.icon && <tab.icon className={cx("size-4", active && "text-primary")} />}
            {tab.label}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary glow"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
