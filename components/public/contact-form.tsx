"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { submitEnquiry, type EnquiryState } from "@/app/(public)/contact/actions";

const EVENT_OPTIONS = ["Wedding", "Event", "Portrait", "Celebration", "Other"];

export function ContactForm({ ctaText }: { ctaText: string }) {
  const [state, formAction, pending] = useActionState<EnquiryState, FormData>(submitEnquiry, { result: null });
  const result = state.result;

  useEffect(() => {
    if (result?.ok && result.waUrl) window.location.assign(result.waUrl);
  }, [result]);

  if (result?.ok) {
    return (
      <div className="contact-success" role="status">
        <p className="eyebrow">OPENING WHATSAPP</p>
        <h2>Opening WhatsApp…</h2>
        <p>Your enquiry is saved. WhatsApp will open to send it — your details are already filled in.</p>
        {result.waUrl ? (
          <a className="button" href={result.waUrl} target="_blank" rel="noopener noreferrer">
            Open WhatsApp <span>→</span>
          </a>
        ) : (
          <p className="form-note">Your enquiry has been saved. Please contact us directly on WhatsApp at {result.whatsapp || "9108727795"}.</p>
        )}
      </div>
    );
  }

  const errors = result?.ok === false ? result.errors : undefined;
  const general = result?.ok === false ? result.general : undefined;

  return (
    <form className="contact-form" action={formAction} noValidate>
      <label>
        Name
        <input name="name" autoComplete="name" required />
        {errors?.name ? <span className="form-error">{errors.name}</span> : null}
      </label>
      <label>
        Phone
        <input name="phone" type="tel" autoComplete="tel" required />
        {errors?.phone ? <span className="form-error">{errors.phone}</span> : null}
      </label>
      <label>
        Event type
        <select name="event_type" defaultValue="">
          <option value="" disabled>Select a type</option>
          {EVENT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        {errors?.event_type ? <span className="form-error">{errors.event_type}</span> : null}
      </label>
      <label>
        Event date
        <input name="event_date" type="date" />
        {errors?.event_date ? <span className="form-error">{errors.event_date}</span> : null}
      </label>
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="contact-form__hp"
      />
      {general ? <p className="form-note form-note-error" role="alert">{general}</p> : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Sending…" : `${ctaText} `} <span>{pending ? "" : "→"}</span>
      </button>
      <p className="form-note">Submitting saves your enquiry and opens it in WhatsApp for you to send. We never send it automatically.</p>
    </form>
  );
}