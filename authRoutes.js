const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// Public routes
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/refresh-token', AuthController.refreshToken);

// Protected routes
router.get('/me', AuthController.getCurrentUser);
router.put('/profile', AuthController.updateProfile);
router.post('/logout', AuthController.logout);

module.exports = router;;