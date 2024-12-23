import { PermissionsBitField } from 'discord.js'

/**
 * Helper type to allow bigint to be used as an index type
 */
export type BigIntIndex<T> = {
  [K in keyof T as T[K] extends bigint ? K : never]: T[K]
}

/**
 * Helper function to get a string representation of a permission flag
 */
export function getPermissionString(permission: bigint): string {
  // Type assertion here is safe because we know PermissionsBitField.Flags only contains bigints
  const flagName = Object.entries(PermissionsBitField.Flags).find(
    ([_, value]) => value === permission,
  )?.[0] as keyof typeof PermissionsBitField.Flags

  return flagName ?? 'Unknown Permission'
}
