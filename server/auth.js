import jwt from 'jsonwebtoken'

const getTokenFromHeader = (authorization = '') => {
  if (!authorization.startsWith('Bearer ')) {
    return ''
  }
  return authorization.substring(7)
}

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' },
  )
}

export const authenticate = (req, res, next) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization)
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }

    req.user = jwt.verify(token, process.env.JWT_SECRET)
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid token.' })
  }
}

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden.' })
    }

    return next()
  }
}
