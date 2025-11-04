// Legacy controller with boundary violation - imports repository directly
import { query } from '../repositories/database'
import { authenticate } from '../services/auth'

interface LoginRequest {
  username: string
  password: string
}

export async function handleLogin(req: LoginRequest) {
  try {
    // ⚠️ BOUNDARY VIOLATION: Controller importing repository directly
    const users = await query('SELECT * FROM users WHERE username = $1', [req.username])
    
    if (users.length === 0) {
      throw new Error('User not found')
    }

    const token = await authenticate(req.username, req.password)
    
    console.log('Login successful for:', req.username)
    
    return {
      success: true,
      token
    }
  } catch (error) {
    console.error('Login failed:', error)
    return {
      success: false,
      error: String(error)
    }
  }
}
