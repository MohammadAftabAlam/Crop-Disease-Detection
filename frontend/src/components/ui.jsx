import React from "react";
import { motion } from "motion/react";
import { LoaderCircle } from "lucide-react";

// Small building blocks shared by the app pages (Tailwind classes only).

export const cx = (...classes) => classes.filter(Boolean).join(" ");

// Status colours always come with an icon and a label, never colour alone
export const TONES = {
  success: {
    text: "text-success",
    soft: "bg-success/10 ring-success/25",
    fill: "bg-success",
    track: "bg-success/15",
  },
  warning: {
    text: "text-warning",
    soft: "bg-warning/10 ring-warning/25",
    fill: "bg-warning",
    track: "bg-warning/15",
  },
  danger: {
    text: "text-danger",
    soft: "bg-danger/10 ring-danger/25",
    fill: "bg-danger",
    track: "bg-danger/15",
  },
  info: {
    text: "text-info",
    soft: "bg-info/10 ring-info/25",
    fill: "bg-info",
    track: "bg-info/15",
  },
  neutral: {
    text: "text-muted",
    soft: "bg-surface-3 ring-border",
    fill: "bg-subtle",
    track: "bg-surface-3",
  },
};

// Motion presets: cards rise in one after another
export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const BUTTON_VARIANTS = {
  primary:
    "bg-primary text-primary-fg glow hover:bg-primary-strong disabled:bg-surface-3 disabled:text-subtle disabled:shadow-none",
  secondary:
    "bg-surface-2 text-fg ring-1 ring-inset ring-border hover:bg-surface-3 hover:ring-primary/40",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/30 hover:bg-danger/20",
};

const BUTTON_SIZES = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-11 gap-2 rounded-xl px-5 text-sm",
  lg: "h-13 gap-2.5 rounded-2xl px-7 text-base",
};

// <Button as={Link} to="/detect" icon={ScanLine}>Scan</Button>
export function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  className,
  children,
  ...props
}) {
  const extra = Component === "button" ? { type: props.type || "button" } : {};

  return (
    <Component
      {...props}
      {...extra}
      disabled={Component === "button" ? props.disabled || loading : undefined}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        Icon && <Icon className={size === "lg" ? "size-5" : "size-4"} />
      )}
      {children}
    </Component>
  );
}

export function Card({ as: Component = "div", className, children, ...props }) {
  return (
    <Component
      {...props}
      className={cx(
        "rounded-2xl border border-border bg-surface/80 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </Component>
  );
}

export const MotionCard = motion.create(Card);

export function Badge({ tone = "neutral", icon: Icon, className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-fg ring-1 ring-inset",
        TONES[tone].soft,
        className
      )}
    >
      {Icon && <Icon className={cx("size-3.5", TONES[tone].text)} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-primary uppercase">
            {eyebrow}
          </p>
        )}

        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-2xl text-base text-muted">{description}</p>
        )}
      </div>

      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ icon: Icon, children, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold text-fg">
        {Icon && <Icon className="size-4.5 text-primary" />}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="size-7" />
        </div>
      )}
      <h3 className="text-lg font-bold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "danger", icon: Icon, title, children, className }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-xl p-4 text-sm ring-1 ring-inset", TONES[tone].soft, className)}
    >
      {Icon && <Icon className={cx("mt-0.5 size-5 shrink-0", TONES[tone].text)} />}
      <div className="min-w-0 text-fg">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "text-muted")}>{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

// Segmented control: options = [{ value, label }]
export function Segmented({ options, value, onChange, layoutId, className }) {
  return (
    <div
      className={cx(
        "inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-inset ring-border",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cx(
              "relative rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-surface ring-1 ring-border"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {option.icon && <option.icon className="size-4" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
