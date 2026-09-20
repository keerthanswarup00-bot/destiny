"use client";
import { useActionState } from "react";
import { signIn } from "./actions";
export function LoginForm() { const [state, formAction, pending] = useActionState(signIn, { error: null }); return <form action={formAction} className="login-form"><label>Username<input name="username" type="text" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{state.error ? <p role="alert">{state.error}</p> : null}<button disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in"}</button></form>; }
