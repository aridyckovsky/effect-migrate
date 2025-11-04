// Legacy user API with patterns to migrate

interface User {
  id: string
  name: string
  email: string
}

// Pattern 1: async/await functions
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
}

// Pattern 2: async arrow function
export const getUserList = async (): Promise<User[]> => {
  const response = await fetch('/api/users')
  return response.json()
}

// Pattern 3: Promise constructor
export function createUserWithDelay(user: User): Promise<User> {
  return new Promise<User>((resolve) => {
    setTimeout(() => resolve(user), 1000)
  })
}

// Pattern 4: try/catch error handling
export async function saveUser(user: User): Promise<void> {
  try {
    await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(user)
    })
  } catch (error) {
    console.error('Failed to save user:', error)
    throw error
  }
}

// Pattern 5: nested async/await
export async function getUserWithPosts(userId: string) {
  try {
    const user = await fetchUser(userId)
    const posts = await fetch(`/api/users/${userId}/posts`)
    return { user, posts: await posts.json() }
  } catch (error) {
    throw new Error(`Failed to fetch user data: ${error}`)
  }
}
