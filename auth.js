const jwt = require('jsonwebtoken');
const { pgPool } = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pgPool.query(
      'SELECT id, email FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    req.user = result.rows[0];
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      error: 'Please authenticate' 
    });
  }
};

module.exports = { auth };