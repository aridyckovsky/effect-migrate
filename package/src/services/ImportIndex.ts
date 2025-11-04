import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

// Regex patterns for import detection
const IMPORT_PATTERNS = [
  // import { foo } from "module"
  /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
  // import "module"
  /import\s+['"]([^'"]+)['"]/g,
  // require("module")
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // import("module") - dynamic imports
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
]

export interface ImportInfo {
  file: string
  imports: string[]
}

export interface ImportIndexService {
  /**
   * Build import index from files
   */
  buildIndex: (files: Map<string, string>) => Effect.Effect<ImportIndexData>

  /**
   * Extract imports from file content
   */
  extractImports: (content: string) => string[]

  /**
   * Get imports for a specific file
   */
  getImports: (file: string, index: ImportIndexData) => string[]

  /**
   * Get files that import a specific module
   */
  getImporters: (module: string, index: ImportIndexData) => string[]
}

export interface ImportIndexData {
  /** Map of file -> imported modules */
  fileToImports: Map<string, string[]>

  /** Map of module -> files that import it */
  moduleToFiles: Map<string, string[]>
}

export class ImportIndex extends Context.Tag("ImportIndex")<ImportIndex, ImportIndexService>() {}

export const ImportIndexLive = Layer.effect(
  ImportIndex,
  Effect.gen(function*() {
    const extractImports = (content: string): string[] => {
      const imports = new Set<string>()

      for (const pattern of IMPORT_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags)
        let match

        while ((match = regex.exec(content)) !== null) {
          const importPath = match[1]
          if (importPath) {
            imports.add(importPath)
          }
        }
      }

      return Array.from(imports).sort()
    }

    const buildIndex = (files: Map<string, string>): Effect.Effect<ImportIndexData> =>
      Effect.gen(function*() {
        const fileToImports = new Map<string, string[]>()
        const moduleToFiles = new Map<string, string[]>()

        for (const [file, content] of files.entries()) {
          const imports = extractImports(content)
          fileToImports.set(file, imports)

          // Build reverse index
          for (const importPath of imports) {
            const importers = moduleToFiles.get(importPath) ?? []
            importers.push(file)
            moduleToFiles.set(importPath, importers)
          }
        }

        return {
          fileToImports,
          moduleToFiles
        }
      })

    const getImports = (file: string, index: ImportIndexData): string[] => {
      return index.fileToImports.get(file) ?? []
    }

    const getImporters = (module: string, index: ImportIndexData): string[] => {
      return index.moduleToFiles.get(module) ?? []
    }

    return {
      buildIndex,
      extractImports,
      getImports,
      getImporters
    }
  })
)
