const jwt = require('jsonwebtoken');

// Load from backend/.env. Fallback only for local dev; set JWT_SECRET in production.
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-use-strong-secret';

/**
 * Middleware to verify JWT and attach user to req.
 * Use on routes that require authentication.
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { userId, email, roles }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please log in again.' });
        }
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = {
    authenticateToken,
    JWT_SECRET,
};
