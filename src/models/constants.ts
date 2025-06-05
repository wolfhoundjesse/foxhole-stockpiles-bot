export const RawCommand = {
  AddStockpile: 'add-stockpile',
  DeleteStockpile: 'delete-stockpile',
  EditStockpile: 'edit-stockpile',
  SelectFaction: 'select-faction',
  RefreshManifest: 'refresh-manifest',
  ResetStockpiles: 'reset-stockpiles',
  CleanupMessages: 'cleanup-messages',
  Help: 'help',
  RegisterWarChannel: 'register-war-channel',
  PostWarMessage: 'post-war-message',
  SetWarArchive: 'set-war-archive',
  ArchiveChannel: 'archive-channel',
  DeregisterWarChannel: 'deregister-war-channel',
  ResetStockpileTimer: 'reset-stockpile-timer',
} as const

export type CommandType = {
  [Key in keyof typeof RawCommand]: Lowercase<(typeof RawCommand)[Key]>
}

export const Command: CommandType = RawCommand as CommandType

export const AddStockpileIds = {
  HexMenu: 'add/hex-menu',
  StockpileMenu: 'add/stockpile-menu',
  StockpileDetails: 'add/stockpile-details',
  StockpileCodeInput: 'add/stockpile-code-input',
  StockpileNameInput: 'add/stockpile-name-input',
  DismissButton: 'add/dismiss-button',
} as const

export const SelectFactionIds = {
  WardenButton: 'faction_warden',
  ColonialButton: 'faction_colonial',
} as const

export const EditStockpileIds = {
  StockpileSelect: 'edit/stockpile-select',
  StockpileEditModal: 'edit/stockpile-edit-modal',
  StockpileCodeInput: 'edit/stockpile-code-input',
  StockpileNameInput: 'edit/stockpile-name-input',
} as const

export const DeleteStockpileIds = {
  StockpileSelect: 'delete/stockpile-select',
  ConfirmButton: 'delete/confirm-button',
  CancelButton: 'delete/cancel-button',
} as const

export const WarArchiveIds = {
  WarNumberInput: 'war-number-input',
} as const

export enum ResetStockpileTimerIds {
  StockpileSelect = 'reset-stockpile-timer-select',
}
