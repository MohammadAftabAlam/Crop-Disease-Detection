import React from "react";
import LogoMark from "./LogoMark";

// Brand emblem (logo) or an icon, then the title and subtitle of each sign-in form
function AuthHeader({ icon: Icon, logo = false, title, subtitle }) {
  return (
    <div className="mb-8">
      {logo ? (
        <LogoMark className="mb-6 size-14 drop-shadow-[0_6px_18px_var(--glow)]" />
      ) : (
        <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25 glow">
          <Icon className="size-6" />
        </div>
      )}
      <h1 className="text-3xl font-extrabold tracking-tight text-fg">{title}</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
    </div>
  );
}

export default AuthHeader;
