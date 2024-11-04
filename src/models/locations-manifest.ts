import type { StorageLocationsByRegion } from './stockpile'

export type LocationsManifest = {
  warNumber: number
  updatedAt: string
  COLONIALS: StorageLocationsByRegion
  WARDENS: StorageLocationsByRegion
  isResistancePhase: boolean
}
