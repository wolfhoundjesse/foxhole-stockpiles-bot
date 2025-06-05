import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Logger } from '../utils/logger'

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../sql/migrations/add_expires_at_column.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    // Run the migration
    await pool.query(migrationSQL)
    Logger.success('Migration', 'Successfully added expires_at column to stockpiles table')
  } catch (error) {
    Logger.error('Migration', 'Failed to run migration', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the migration
runMigration()
