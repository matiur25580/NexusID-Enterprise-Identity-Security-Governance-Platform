"use client";

import { useActionState } from "react";
import { createOrganization, type OnboardingState } from "./actions";

const initialState: OnboardingState = {};

export default function OrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);

  return (
    <form action={formAction} className="organization-form">
      <label htmlFor="organization-name">Organization name</label>
      <input id="organization-name" name="name" minLength={2} maxLength={80} required placeholder="Acme Corporation" />
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Creating workspace…" : "Create secure workspace"}</button>
      <p>Your account will become the initial workspace owner.</p>
    </form>
  );
}
