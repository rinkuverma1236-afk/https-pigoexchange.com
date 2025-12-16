const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Generate referral code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Format currency
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8
  }).format(amount);
};

// Generate unique ID
const generateId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}${timestamp}-${random}`.toUpperCase();
};

// Validate email
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Validate password strength
const isStrongPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return password.length >= minLength && 
         hasUpperCase && 
         hasLowerCase && 
         hasNumbers && 
         hasSpecialChar;
};

// Calculate trading fee
const calculateTradingFee = (amount, isMaker = false) => {
  const baseFee = isMaker ? 0.001 : 0.001; // 0.1%
  // VIP tier logic would go here
  return amount * baseFee;
};

// Generate deposit address
const generateDepositAddress = (userId, currency) => {
  const hash = crypto.createHash('sha256');
  hash.update(`${userId}:${currency}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`);
  return `0x${hash.digest('hex').substring(0, 40)}`;
};

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry helper with exponential backoff
const retry = async (fn, retries = 3, delayMs = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await delay(delayMs);
    return retry(fn, retries - 1, delayMs * 2);
  }
};

// Pagination helper
const paginate = (array, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  return {
    data: array.slice(startIndex, endIndex),
    page,
    limit,
    total: array.length,
    totalPages: Math.ceil(array.length / limit),
    hasNext: endIndex < array.length,
    hasPrev: page > 1
  };
};

module.exports = {
  generateToken,
  generateReferralCode,
  formatCurrency,
  generateId,
  isValidEmail,
  isStrongPassword,
  calculateTradingFee,
  generateDepositAddress,
  delay,
  retry,
  paginate
};