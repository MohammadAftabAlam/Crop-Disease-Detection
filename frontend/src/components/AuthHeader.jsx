import React from "react";

// Icon, title and subtitle at the top of each sign-in form
function AuthHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-8">
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25 glow">
        <Icon className="size-6" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-fg">{title}</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
    </div>
  );
}

export default AuthHeader;
