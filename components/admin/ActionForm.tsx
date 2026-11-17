"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/admin/rone/actions";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  label: string;
  children?: React.ReactNode;
  multipart?: boolean;
  compact?: boolean;
};

export function ActionForm({ action, label, children, compact }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={compact ? "inline" : "space-y-2"}>
      {children}
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-accent px-3 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-50"
      >
        {pending ? "Memproses..." : label}
      </button>
      {state && (
        <p
          role="status"
          className={`whitespace-pre-line text-xs ${state.ok ? "text-green-600" : "text-accent"} ${compact ? "mt-1" : ""}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
