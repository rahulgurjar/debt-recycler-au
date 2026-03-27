const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '30m';
const RESET_TOKEN_EXPIRY = 3600000; // 1 hour in ms

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 8;
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const generateToken = (userIdOrObj, email, role = 'advisor') => {
  let userId, userEmail, userRole;
  if (userIdOrObj && typeof userIdOrObj === 'object') {
    userId = userIdOrObj.user_id || userIdOrObj.userId;
    userEmail = userIdOrObj.email;
    userRole = userIdOrObj.role || 'advisor';
  } else {
    userId = userIdOrObj;
    userEmail = email;
    userRole = role;
  }
  return jwt.sign(
    { userId, email: userEmail, role: userRole },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  validateEmail,
  validatePassword,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateResetToken,
  JWT_EXPIRY,
  RESET_TOKEN_EXPIRY,
};
