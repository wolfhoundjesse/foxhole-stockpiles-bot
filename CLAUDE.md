# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord bot for managing Foxhole game stockpiles, built with TypeScript, discordx, discord.js, and Bun runtime. The bot helps Discord communities track stockpile locations, codes, and expiration timers for the game Foxhole, fetching live data from the Foxhole War API.

## Development Commands

**Start development server (with auto-reload):**
```bash
bun dev
```

**Start production server:**
```bash
bun start
```

**Type checking:**
```bash
bun run type-check
```

**Linting:**
```bash
bun run lint
bun run lint:fix
```

**Formatting:**
```bash
bun run format
bun run format:check
```

## Environment Setup

Copy `.env.example` to `.env` and configure:
- `BOT_TOKEN`: Discord bot token (required)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DATABASE`: PostgreSQL connection details

## Database

The bot uses PostgreSQL for data persistence. Schema is in [src/sql/db.sql](src/sql/db.sql).

**Database tables:**
- `guilds`: Guild-level configuration (faction selection)
- `stockpiles`: Stockpile entries with expiration tracking
- `locations_manifest`: Cached map data from Foxhole API
- `embedded_messages`: Tracks the main stockpile embed message per guild
- `war_message_channels`: Channels registered for war announcements
- `war_archive_channels`: Archive channels for war history
- `user_timezones`: User timezone preferences

**Running migrations:**
Migrations are in [src/sql/migrations/](src/sql/migrations/). The migration runner is at [src/scripts/run-migration.ts](src/scripts/run-migration.ts). Update the file path in the script to match your migration file, then run:
```bash
bun run src/scripts/run-migration.ts
```

## Architecture

### Core Services

**StockpileDataService** ([src/services/stockpile-data-service.ts](src/services/stockpile-data-service.ts)):
- Central service managing all stockpile operations
- Fetches live data from Foxhole War API endpoints
- Updates locations manifest (storage depots/seaports) every 15 minutes
- Handles CRUD operations for stockpiles
- Manages faction selection, embed messages, and timezones

**PostgresService** ([src/services/postgres-service.ts](src/services/postgres-service.ts)):
- Database abstraction layer
- All DB queries go through this service
- Uses pg Pool for connection management

### Command Structure

Commands are in [src/commands/](src/commands/) and organized by feature:
- `stockpile/`: Stockpile management commands
- `war-archives/`: War history archiving commands
- Root level: Utility commands (help, timezone management)

All commands use the `@Slash` decorator from discordx and follow this pattern:
1. Apply `@Guard(PermissionGuard)` for permission checks
2. Validate bot permissions with `checkBotPermissions()`
3. Fetch faction with `getFaction()` (for faction-specific commands)
4. Execute command logic

### Interaction Handling

**InteractionCreate** ([src/events/InteractionCreate.ts](src/events/InteractionCreate.ts)):
- Central event handler for all Discord interactions
- Routes button clicks, select menus, and modals to appropriate handlers
- Uses custom IDs defined in [src/models/constants.ts](src/models/constants.ts) for routing

### Permission System

**PermissionGuard** ([src/guards/PermissionGuard.ts](src/guards/PermissionGuard.ts)):
- Guards commands with permission requirements
- Checks both user permissions and bot permissions
- Configuration in [src/models/permissions.ts](src/models/permissions.ts)

### Data Flow for Stockpile Operations

1. **Adding a stockpile:**
   - User runs `/add-stockpile` → Shows hex/region select menu
   - User selects region → Shows location select menu
   - User selects location → Shows modal for code/name input
   - Modal submit → Adds to DB via `StockpileDataService.addStockpile()`
   - Updates the guild's main embed message with new stockpile

2. **Stockpile expiration:**
   - Stockpiles expire 50 hours after creation/last update (configurable in PostgresService)
   - Expiration times are calculated when adding/editing/resetting timer
   - `formatStockpileWithExpiration()` in [src/utils/expiration.ts](src/utils/expiration.ts) handles display formatting

3. **Locations manifest refresh:**
   - Auto-refreshes on bot startup
   - Manual refresh via `/refresh-manifest` command
   - 15-minute cooldown for auto-refresh, 1-minute for manual
   - Fetches from Foxhole War API: map names → static maps (location names) + dynamic maps (storage locations)

### Models and Types

Key types are in [src/models/](src/models/):
- `Stockpile`: Core stockpile data structure
- `LocationsManifest`: War data and storage locations by faction
- `FactionType`: COLONIALS | WARDENS | NONE
- Constants for command IDs and interaction routing

### Embeds and UI Components

**Embed utilities** ([src/utils/embed.ts](src/utils/embed.ts)):
- `addHelpTip()`: Adds action buttons (Add/Edit/Delete/Reset Timer) to stockpile embeds
- Main embed displays all stockpiles grouped by region/hex
- Uses faction colors from `FactionColors` enum

## Key Implementation Notes

- **Bun runtime**: Uses Bun's native TypeScript support and module system
- **discordx decorators**: Commands use `@Slash`, events use `@On`, guards use `@Guard`
- **Interaction state**: Paginated menus (hex selection) track state in class properties (e.g., `hexPages`, `selectedLocations`)
- **Error handling**: All interaction handlers wrap in try-catch with ephemeral error messages
- **Logger**: Custom logger in [src/utils/logger.ts](src/utils/logger.ts) with debug/success/error levels
- **Ephemeral responses**: Most command responses use `MessageFlags.Ephemeral` for privacy

## Foxhole API Integration

The bot integrates with the Foxhole War Services API:
- **Map names endpoint**: `https://war-service-live.foxholeservices.com/api/worldconquest/maps`
- **Static map data** (location names): `/api/worldconquest/maps/{mapName}/static`
- **Dynamic map data** (storage locations): `/api/worldconquest/maps/{mapName}/dynamic/public`
- **War data** (war number, phase): `/api/worldconquest/war`

Storage locations are identified by iconType:
- `33`: Storage Depot
- `52`: Seaport
- `88`: Aircraft Depot

## Discord.js Patterns

- Uses builders for all UI components (ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, etc.)
- Modal submits include the data in `customId` or use persistent state
- Bulk delete with fallback for messages older than 14 days
- Permission checks use `PermissionsBitField`
