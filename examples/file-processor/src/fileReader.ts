// Legacy file reading with Promise-based patterns
import * as fs from 'fs/promises'
import * as path from 'path'

interface FileData {
  path: string
  content: string
  size: number
}

// Pattern 1: async/await with try/catch
export async function readFileWithMetadata(filePath: string): Promise<FileData> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const stats = await fs.stat(filePath)
    
    return {
      path: filePath,
      content,
      size: stats.size
    }
  } catch (error) {
    console.error(`Failed to read file ${filePath}:`, error)
    throw error
  }
}

// Pattern 2: Promise.all for concurrent operations
export async function readMultipleFiles(filePaths: string[]): Promise<FileData[]> {
  const promises = filePaths.map(async (filePath) => {
    return await readFileWithMetadata(filePath)
  })
  
  return Promise.all(promises)
}

// Pattern 3: new Promise constructor for custom async logic
export function watchFile(filePath: string, callback: (data: string) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const watcher = fs.watch(filePath)
    
    watcher.on('change', async () => {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        callback(content)
      } catch (error) {
        reject(error)
      }
    })
    
    watcher.on('error', reject)
  })
}

// Pattern 4: Manual resource cleanup with finally
export async function processFileWithCleanup(filePath: string): Promise<string> {
  let fileHandle: fs.FileHandle | null = null
  
  try {
    fileHandle = await fs.open(filePath, 'r')
    const buffer = await fileHandle.readFile()
    return buffer.toString('utf-8').toUpperCase()
  } catch (error) {
    throw new Error(`Processing failed: ${error}`)
  } finally {
    if (fileHandle) {
      await fileHandle.close()
    }
  }
}

// Pattern 5: Sequential async operations
export async function copyAndTransform(source: string, dest: string): Promise<void> {
  try {
    const content = await fs.readFile(source, 'utf-8')
    const transformed = content.toUpperCase()
    await fs.writeFile(dest, transformed)
    const verification = await fs.readFile(dest, 'utf-8')
    
    if (verification !== transformed) {
      throw new Error('Verification failed')
    }
  } catch (error) {
    console.error('Copy failed:', error)
    throw error
  }
}
