export const RawCommand = {
  AddStockpile: 'add-stockpile',
  DeleteStockpile: 'delete-stockpile',
  EditStockpile: 'edit-stockpile',
  SelectFaction: 'select-faction',
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
