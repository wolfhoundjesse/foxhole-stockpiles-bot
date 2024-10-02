export const Faction = {
  Wardens: 'WARDENS',
  Colonials: 'COLONIALS',
  None: 'NONE',
} as const

export type FactionType = (typeof Faction)[keyof typeof Faction]

export type FactionsByGuildId = {
  [guildId: string]: FactionType
}

export const FactionColors = {
  [Faction.Wardens]: 0x0000ff,
  [Faction.Colonials]: 0x00ff00,
  [Faction.None]: 0xffffff,
} as const
