"use client";

import { useFormStatus } from "react-dom";

// Shows a pending state during a server-action submit. Reused across admin forms.
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
