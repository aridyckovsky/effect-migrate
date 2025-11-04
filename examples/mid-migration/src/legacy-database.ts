// Legacy database code - NOT YET MIGRATED
import * as pg from 'pg'

interface User {
  id: string
  name: string
  email: string
}

export async function getUser(id: string): Promise<User | null> {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
  })

  try {
    await client.connect()
    const result = await client.query('SELECT * FROM users WHERE id = $1', [id])
    
    if (result.rows.length === 0) {
      return null
    }
    
    return result.rows[0] as User
  } catch (error) {
    console.error('Database error:', error)
    throw error
  } finally {
    await client.end()
  }
}

export async function createUser(name: string, email: string): Promise<User> {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
  })

  try {
    await client.connect()
    const result = await client.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    )
    return result.rows[0] as User
  } catch (error) {
    console.error('Failed to create user:', error)
    throw new Error(`User creation failed: ${error}`)
  } finally {
    await client.end()
  }
}

export async function updateUserEmail(id: string, newEmail: string): Promise<void> {
  const client = new pg.Client()
  await client.connect()
  
  try {
    await client.query('BEGIN')
    await client.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail, id])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
