/** The shape every server action returns, consumed by `useActionState`. */
export interface ActionState {
  ok?: boolean
  /** A form-level message — shown as an alert above the fields. */
  message?: string | null
  /** Field name => messages, mirroring Laravel's validation error bag. */
  errors?: Record<string, string[]>
}

export const EMPTY_STATE: ActionState = {}

export function fieldError(state: ActionState | undefined, name: string): string | null {
  return state?.errors?.[name]?.[0] ?? null
}

/** Every message in the bag, flattened for the summary alert. */
export function allErrors(state: ActionState | undefined): string[] {
  if (!state?.errors) return []
  return Object.values(state.errors).flat()
}
