import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search } from "lucide-react";
import useIsDesktop from "../hooks/useIsDesktop";
import usePreferences from "../hooks/usePreferences";
import { cx } from "./ui";

// Above the sidebar, tab bar and the CropCare AI panel, so it works everywhere
const LAYER = "z-[70]";

/**
 * A dropdown in the app's style, replacing the browser's <select>.
 * Desktop: a floating list under the button. Phones: a bottom sheet with big rows.
 *
 * options: [{ value, label, group? }] - options with the same group are listed under
 * that heading (keep them next to each other). `searchable` adds a filter box.
 * Keyboard: arrows / Home / End move, Enter picks, Esc closes, letters jump.
 */
function Select({ value, onChange, options, label, icon: Icon, searchable = false, size = "md", className, id }) {
  const { t } = usePreferences();
  const isDesktop = useIsDesktop();
  const autoId = useId();
  const baseId = id || autoId;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);

  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const popoverRef = useRef(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return options;
    }
    return options.filter((option) =>
      [option.label, option.group].some((part) => part?.toLowerCase().includes(text))
    );
  }, [options, query]);

  const close = (focusTrigger = true) => {
    setOpen(false);
    setQuery("");
    if (focusTrigger) {
      triggerRef.current?.focus();
    }
  };

  const openList = () => {
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  const pick = (option) => {
    onChange(option.value);
    close();
  };

  // Desktop: place the list under the button (or above it when there is no room)
  useLayoutEffect(() => {
    if (!open || !isDesktop) {
      return undefined;
    }

    const place = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.max(rect.width, 220);
      const below = window.innerHeight - rect.bottom;
      const up = below < 260 && rect.top > below;
      setPosition({
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        top: up ? undefined : rect.bottom + 6,
        bottom: up ? window.innerHeight - rect.top + 6 : undefined,
        maxHeight: Math.min(searchable ? 380 : 320, (up ? rect.top : below) - 16),
        up,
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, isDesktop, searchable]);

  // Focus the search box or the list when it opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => (searchable && isDesktop ? searchRef.current : listRef.current)?.focus());
    }
  }, [open, searchable, isDesktop]);

  // Desktop: a click anywhere else closes it. Phones: the page behind must not scroll.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    if (isDesktop) {
      const onPointerDown = (event) => {
        if (!popoverRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
          close(false);
        }
      };
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDesktop]);

  // Keep the highlighted option in view
  useEffect(() => {
    if (open && active >= 0) {
      document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [active, open, baseId]);

  // The highlight follows the filter
  useEffect(() => {
    if (open) {
      setActive(filtered.length ? 0 : -1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onTriggerKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (event) => {
    const last = filtered.length - 1;
    const keys = {
      ArrowDown: () => setActive((current) => Math.min(current + 1, last)),
      ArrowUp: () => setActive((current) => Math.max(current - 1, 0)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => filtered[active] && pick(filtered[active]),
      Escape: () => close(),
      Tab: () => close(false),
    };

    if (keys[event.key]) {
      if (event.key !== "Tab") {
        event.preventDefault();
      }
      keys[event.key]();
      return;
    }

    // Type a letter to jump to the next option starting with it (lists without search)
    if (!searchable && event.key.length === 1 && /\S/.test(event.key)) {
      const letter = event.key.toLowerCase();
      const order = [...filtered.slice(active + 1), ...filtered.slice(0, active + 1)];
      const next = order.find((option) => option.label.toLowerCase().startsWith(letter));
      if (next) {
        setActive(filtered.indexOf(next));
      }
    }
  };

  const listId = `${baseId}-list`;

  const list = (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-label={label}
      aria-activedescendant={active >= 0 ? `${baseId}-option-${active}` : undefined}
      onKeyDown={onListKeyDown}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 focus-visible:outline-none"
    >
      {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">{t("common.noResults")}</p>}

      {filtered.map((option, index) => {
        const isSelected = option.value === value;
        const isActive = index === active;
        const heading = option.group && option.group !== filtered[index - 1]?.group;

        return (
          <React.Fragment key={option.value}>
            {heading && (
              <p role="presentation" className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-wider text-subtle uppercase first:pt-1.5">
                {option.group}
              </p>
            )}
            <div
              id={`${baseId}-option-${index}`}
              role="option"
              aria-selected={isSelected}
              onClick={() => pick(option)}
              onMouseMove={() => setActive(index)}
              className={cx(
                "flex cursor-pointer items-center gap-3 rounded-xl px-3 text-fg transition-colors select-none",
                isDesktop ? "py-2 text-sm" : "min-h-12 py-3 text-base",
                isActive ? "bg-surface-3" : "",
                isSelected && "font-semibold"
              )}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {isSelected && <Check className="size-4 shrink-0 text-primary" strokeWidth={2.75} />}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  const search = searchable && (
    <div className="relative border-b border-border p-2">
      <Search className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onListKeyDown}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${baseId}-option-${active}` : undefined}
        aria-label={t("common.search")}
        placeholder={t("common.search")}
        className="h-10 w-full rounded-xl bg-surface-2 pr-3 pl-9 text-sm text-fg ring-1 ring-inset ring-border focus-visible:ring-primary focus-visible:outline-none"
      />
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label ? `${label}: ${selected ? [selected.group, selected.label].filter(Boolean).join(" – ") : ""}` : undefined}
        className={cx(
          "flex w-full items-center gap-2.5 rounded-xl bg-surface-2 px-3 text-left text-sm text-fg ring-1 ring-inset transition-all hover:bg-surface-3/60",
          size === "sm" ? "h-10" : "h-11",
          open ? "ring-2 ring-primary" : "ring-border hover:ring-primary/40",
          className
        )}
      >
        {Icon && <Icon className="size-4 shrink-0 text-primary" />}
        <span className={cx("min-w-0 flex-1 truncate", !selected && "text-subtle")}>
          {selected ? (selected.group ? `${selected.group} – ${selected.label}` : selected.label) : label}
        </span>
        <ChevronDown className={cx("size-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && isDesktop && position && (
            <motion.div
              ref={popoverRef}
              key="popover"
              initial={{ opacity: 0, scale: 0.96, y: position.up ? 6 : -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              style={{
                left: position.left,
                width: position.width,
                top: position.top,
                bottom: position.bottom,
                maxHeight: position.maxHeight,
                transformOrigin: position.up ? "bottom" : "top",
              }}
              className={cx("fixed flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl", LAYER)}
            >
              {search}
              {list}
            </motion.div>
          )}

          {open && !isDesktop && (
            <div key="sheet" className={cx("fixed inset-0", LAYER)}>
              <motion.div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => close()}
              />
              <motion.div
                ref={popoverRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-border bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              >
                <span className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-surface-3" />
                {label && <p className="px-5 pt-3 pb-2 text-base font-bold text-fg">{label}</p>}
                {search}
                {list}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export default Select;
