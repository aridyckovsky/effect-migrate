// Legacy authentication service - NOT migrated to Effect yet
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

export async function authenticate(username: string, password: string): Promise<string> {
  try {
    // Simulate async password check
    const user = await new Promise((resolve, reject) => {
      setTimeout(() => {
        if (password === 'valid') {
          resolve({ id: 123, username })
        } else {
          reject(new Error('Invalid credentials'))
        }
      }, 100)
    })

    console.log('User authenticated:', username)
    
    return jwt.sign({ user }, SECRET, { expiresIn: '1h' })
  } catch (error) {
    console.error('Authentication failed:', error)
    throw error
  }
}

export async function verifyToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, SECRET, (err, decoded) => {
      if (err) {
        console.error('Token verification failed:', err)
        reject(err)
      } else {
        console.log('Token verified')
        resolve(decoded)
      }
    })
  })
}

export async function refreshToken(oldToken: string): Promise<string> {
  try {
    const decoded = await verifyToken(oldToken)
    const newToken = jwt.sign({ user: decoded.user }, SECRET, { expiresIn: '1h' })
    return newToken
  } catch (error) {
    throw new Error('Failed to refresh token')
  }
}
