"use client";

import { useActionState } from "react";
import { signIn } from "../actions";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={action} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-extrabold tracking-tight">
            THE SLIME <span className="text-lime-400">CO</span>
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Admin
          </div>
        </div>

        <label htmlFor="password" className="mb-2 block text-sm text-zinc-400">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-lime-500"
        />

        {state?.message ? (
          <p className="mt-3 text-sm text-red-400">{state.message}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-full bg-lime-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-black disabled:opacity-50"
        >
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
