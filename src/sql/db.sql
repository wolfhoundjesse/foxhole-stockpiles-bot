CREATE TABLE guilds (
  guild_id TEXT PRIMARY KEY,
  faction TEXT
);

CREATE TABLE regions (
  id SERIAL PRIMARY KEY,
  hex TEXT NOT NULL UNIQUE
);

CREATE TABLE stockpiles (
  id UUID PRIMARY KEY,
  guild_id TEXT REFERENCES guilds(guild_id),
  region_hex TEXT REFERENCES regions(hex),
  location_name TEXT NOT NULL,
  code TEXT NOT NULL,
  stockpile_name TEXT NOT NULL,
  storage_type TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMP
);

CREATE TABLE locations_manifest (
  id SERIAL PRIMARY KEY,
  war_number INTEGER NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  colonial_locations JSONB NOT NULL,
  warden_locations JSONB NOT NULL
);

CREATE TABLE embedded_messages (
  guild_id TEXT REFERENCES guilds(guild_id),
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  PRIMARY KEY (guild_id)
);