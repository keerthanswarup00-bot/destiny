"use client";

import { useActionState } from "react";
import { submitGalleryPassword } from "@/app/(client-gallery)/gallery/actions";

export function GalleryPasswordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(submitGalleryPassword, { error: null });
  return (
    <form action={action} className="client-gate-form">
      <input name="slug" type="hidden" value={slug} />
      <label>Password
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button disabled={pending} type="submit">{pending ? "Checking…" : "Enter gallery"}</button>
    </form>
  );
}
