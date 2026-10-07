import React, { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import usePreferences from "../hooks/usePreferences";
import { PASSWORD_RULES } from "../utils/password";
import { cx } from "./ui";

export const inputClass =
  "h-11 w-full rounded-xl bg-surface-2 px-3 text-sm text-fg ring-1 ring-inset ring-border transition-shadow focus:ring-2 focus:ring-primary";

// Text field with a label, for the auth and profile forms
export function TextField({ id, label, className, ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-fg">{label}</label>
      <input id={id} name={id} {...props} className={inputClass} />
    </div>
  );
}

// Password input with a show / hide button
function PasswordField({ id, label, value, onChange, autoComplete, placeholder, action }) {
  const { t } = usePreferences();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-semibold text-fg">{label}</label>
        {action}
      </div>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={cx(inputClass, "pr-11")}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={t(visible ? "profile.hide" : "profile.show")}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-fg"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

// Live checklist for the password rule
export function PasswordRules({ value }) {
  const { t } = usePreferences();

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value);

        return (
          <li key={rule.key} className={cx("flex items-center gap-2 text-sm transition-colors", passed ? "text-fg" : "text-subtle")}>
            <span className={cx(
              "grid size-4.5 shrink-0 place-items-center rounded-full transition-colors",
              passed ? "bg-primary text-primary-fg" : "ring-1 ring-inset ring-border"
            )}>
              {passed && <Check className="size-3" strokeWidth={3} />}
            </span>
            {t(rule.key)}
          </li>
        );
      })}
    </ul>
  );
}

export default PasswordField;
