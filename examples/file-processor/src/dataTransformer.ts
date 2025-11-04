// Legacy data transformation with error-prone patterns
import * as fs from 'fs/promises'

interface DataRecord {
  id: string
  value: number
  metadata: Record<string, any>
}

// Pattern 1: Unsafe JSON parsing with try/catch
export async function loadJsonFile<T>(filePath: string): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    
    try {
      return JSON.parse(content) as T
    } catch (parseError) {
      throw new Error(`Invalid JSON in ${filePath}: ${parseError}`)
    }
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error}`)
  }
}

// Pattern 2: No validation, assumes shape
export async function transformRecords(inputPath: string, outputPath: string): Promise<void> {
  const records = await loadJsonFile<DataRecord[]>(inputPath)
  
  const transformed = records.map(record => ({
    ...record,
    value: record.value * 2,
    processed: true
  }))
  
  await fs.writeFile(outputPath, JSON.stringify(transformed, null, 2))
}

// Pattern 3: Multiple async operations without proper error boundaries
export async function aggregateData(filePaths: string[]): Promise<number> {
  let sum = 0
  
  for (const filePath of filePaths) {
    try {
      const data = await loadJsonFile<DataRecord[]>(filePath)
      sum += data.reduce((acc, record) => acc + record.value, 0)
    } catch (error) {
      console.error(`Skipping ${filePath}:`, error)
    }
  }
  
  return sum
}

// Pattern 4: Callback hell wrapped in Promise
export function processStream(filePath: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const lines: string[] = []
    
    fs.readFile(filePath, 'utf-8')
      .then(content => {
        const rawLines = content.split('\n')
        
        Promise.all(
          rawLines.map(line => {
            return new Promise<string>((res, rej) => {
              setTimeout(() => {
                try {
                  const processed = line.trim().toUpperCase()
                  res(processed)
                } catch (error) {
                  rej(error)
                }
              }, 10)
            })
          })
        )
        .then(processedLines => resolve(processedLines.filter(l => l.length > 0)))
        .catch(reject)
      })
      .catch(reject)
  })
}

// Pattern 5: Race conditions and missing validation
let cacheData: Map<string, any> = new Map()

export async function getCachedOrLoad<T>(filePath: string): Promise<T> {
  if (cacheData.has(filePath)) {
    return cacheData.get(filePath)
  }
  
  const data = await loadJsonFile<T>(filePath)
  cacheData.set(filePath, data)
  return data
}

export async function invalidateCache(filePath: string): Promise<void> {
  cacheData.delete(filePath)
}
