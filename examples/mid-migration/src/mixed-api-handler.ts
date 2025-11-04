// Mixed patterns - some migrated, some not
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"

// Still using Promise - needs migration
export async function legacyValidateEmail(email: string): Promise<boolean> {
  try {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  } catch (error) {
    console.error('Validation error:', error)
    return false
  }
}

// Migrated to Effect
export const validateEmailEffect = (
  email: string
): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  })

// Legacy async/await with try/catch
export async function fetchUserData(userId: string): Promise<unknown> {
  try {
    const response = await fetch(`https://api.example.com/users/${userId}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Fetch failed:', error)
    throw error
  }
}

// Migrated batch processor
export const processBatch = <A, E, R>(
  items: ReadonlyArray<A>,
  process: (item: A) => Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> =>
  Effect.forEach(items, process, { concurrency: 10 }).pipe(
    Effect.tap(() => Console.log(`Processed ${items.length} items`)),
    Effect.asVoid
  )

// Legacy Promise.all usage
export async function aggregateData(
  ids: string[]
): Promise<unknown[]> {
  const promises = ids.map(async (id) => {
    return await fetchUserData(id)
  })
  
  return Promise.all(promises)
}
