CREATE TABLE guilds (
  guild_id TEXT PRIMARY KEY,
  faction TEXT
);

CREATE TABLE stockpiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES guilds(guild_id) NOT NULL,
  hex TEXT NOT NULL,
  location_name TEXT NOT NULL,
  code TEXT NOT NULL,
  stockpile_name TEXT NOT NULL,
  storage_type TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMP,
  channel_id TEXT NOT NULL
);

CREATE TABLE locations_manifest (
  updated_at TIMESTAMP NOT NULL DEFAULT NOW() PRIMARY KEY,
  war_number INTEGER NOT NULL,
  is_resistance_phase BOOLEAN NOT NULL DEFAULT FALSE,
  colonial_locations JSONB NOT NULL,
  warden_locations JSONB NOT NULL
);

CREATE TABLE embedded_messages (
  guild_id TEXT REFERENCES guilds(guild_id),
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, channel_id, message_id)
);

CREATE TABLE war_message_channels (
  guild_id TEXT REFERENCES guilds(guild_id),
  channel_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, channel_id)
);

 CREATE TABLE IF NOT EXISTS war_archive_channels (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 );