/**
 * Local-prototype authentication policy. This is deliberately small and
 * injectable so interaction tests can exercise the recovery threshold.
 */
export type AuthPolicy = {
  passwordErrorLimit: number
}

export const authPolicy: AuthPolicy = {
  passwordErrorLimit: 3,
}
