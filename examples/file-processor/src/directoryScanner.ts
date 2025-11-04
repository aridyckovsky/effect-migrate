// Legacy directory scanning with callback and Promise patterns
import * as fs from 'fs/promises'
import * as path from 'path'

interface ScanResult {
  files: string[]
  directories: string[]
  totalSize: number
}

// Pattern 1: Recursive async/await
export async function scanDirectory(dirPath: string): Promise<ScanResult> {
  const result: ScanResult = {
    files: [],
    directories: [],
    totalSize: 0
  }
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      
      if (entry.isDirectory()) {
        result.directories.push(fullPath)
        const subResult = await scanDirectory(fullPath)
        result.files.push(...subResult.files)
        result.directories.push(...subResult.directories)
        result.totalSize += subResult.totalSize
      } else {
        result.files.push(fullPath)
        try {
          const stats = await fs.stat(fullPath)
          result.totalSize += stats.size
        } catch (error) {
          console.warn(`Could not stat ${fullPath}:`, error)
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to scan ${dirPath}: ${error}`)
  }
  
  return result
}

// Pattern 2: Promise chaining
export function findLargestFile(dirPath: string): Promise<string | null> {
  return fs.readdir(dirPath, { withFileTypes: true })
    .then(entries => {
      const filePromises = entries
        .filter(entry => entry.isFile())
        .map(entry => {
          const fullPath = path.join(dirPath, entry.name)
          return fs.stat(fullPath)
            .then(stats => ({ path: fullPath, size: stats.size }))
        })
      
      return Promise.all(filePromises)
    })
    .then(files => {
      if (files.length === 0) return null
      return files.reduce((largest, current) => 
        current.size > largest.size ? current : largest
      ).path
    })
    .catch(error => {
      console.error('Error finding largest file:', error)
      throw error
    })
}

// Pattern 3: Nested try/catch with multiple error types
export async function deleteOldFiles(dirPath: string, daysOld: number): Promise<number> {
  let deletedCount = 0
  const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(dirPath, entry.name)
        
        try {
          const stats = await fs.stat(fullPath)
          
          if (stats.mtimeMs < cutoffDate) {
            try {
              await fs.unlink(fullPath)
              deletedCount++
            } catch (deleteError) {
              console.error(`Failed to delete ${fullPath}:`, deleteError)
            }
          }
        } catch (statError) {
          console.warn(`Could not stat ${fullPath}:`, statError)
          continue
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to process directory ${dirPath}: ${error}`)
  }
  
  return deletedCount
}

// Pattern 4: Mixed async/await and callbacks
export async function watchDirectory(
  dirPath: string, 
  onChange: (files: string[]) => void
): Promise<() => void> {
  let currentFiles: string[] = []
  
  const updateFiles = async () => {
    try {
      const entries = await fs.readdir(dirPath)
      const newFiles = entries.filter(e => e.endsWith('.ts'))
      
      if (JSON.stringify(newFiles) !== JSON.stringify(currentFiles)) {
        currentFiles = newFiles
        onChange(newFiles)
      }
    } catch (error) {
      console.error('Watch error:', error)
    }
  }
  
  await updateFiles()
  const interval = setInterval(updateFiles, 1000)
  
  return () => clearInterval(interval)
}
