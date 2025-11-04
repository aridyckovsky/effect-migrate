// Legacy database connection with async/await and try/catch
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: 'team_dashboard'
})

export async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const client = await pool.connect()
    try {
      const result = await client.query(sql, params)
      console.log(`Query executed: ${sql}`)
      return result.rows
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Database query failed:', error)
    throw new Error(`Database error: ${error}`)
  }
}

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Transaction failed:', error)
    throw error
  } finally {
    client.release()
  }
}
