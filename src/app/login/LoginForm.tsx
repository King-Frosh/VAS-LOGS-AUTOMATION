"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-amber w-full justify-center py-3.5" disabled={pending}>
      {pending ? "Authenticating…" : "Sign in"}
      {!pending && <ArrowRight size={13} strokeWidth={2.5} />}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className="silk-sm text-slate-warm-dark">
          EMAIL ADDRESS
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          className="field field-dark mt-2.5"
          placeholder="admin@briccs.ng"
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="silk-sm text-slate-warm-dark">
          PASSWORD
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="field field-dark mt-2.5"
          placeholder="••••••••••••"
          required
        />
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="border-l-2 border-alert bg-alert/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-alert"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
