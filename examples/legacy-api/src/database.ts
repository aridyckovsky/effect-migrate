// Legacy database layer with error handling patterns

interface DbConnection {
  query: (sql: string) => Promise<any>
  close: () => Promise<void>
}

// More async/await and Promise patterns
export async function connectToDatabase(): Promise<DbConnection> {
  return new Promise<DbConnection>((resolve, reject) => {
    // Simulated async connection
    setTimeout(() => {
      resolve({
        query: async (sql: string) => ({ rows: [] }),
        close: async () => {}
      })
    }, 100)
  })
}

// try/catch with resource cleanup
export async function executeQuery(sql: string) {
  const conn = await connectToDatabase()
  
  try {
    const result = await conn.query(sql)
    return result
  } catch (error) {
    console.error('Query failed:', error)
    throw error
  } finally {
    await conn.close()
  }
}

// Nested error handling
export async function runTransaction(queries: string[]) {
  try {
    const conn = await connectToDatabase()
    
    for (const query of queries) {
      try {
        await conn.query(query)
      } catch (error) {
        throw new Error(`Query failed: ${query}`)
      }
    }
    
    await conn.close()
  } catch (error) {
    throw error
  }
}
