const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { sendWelcomeEmail } = require('../services/emailService');
const { generateToken } = require('../utils/helpers');

class AuthController {
  static async signup(req, res) {
    try {
      const { email, password, firstName, lastName, phone, country, referredBy } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }

      // Create user
      const userData = {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
        country,
        referred_by: referredBy
      };

      const result = await User.create(userData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      // Generate JWT token
      const token = generateToken(result.user.id);

      // Get wallet data
      const wallets = await Wallet.getUserWallets(result.user.id);
      const totalValueUSD = await Wallet.getTotalValueUSD(result.user.id);

      // Format wallet balances as array for frontend
      const balancesArray = wallets.map(wallet => ({
        currency: wallet.currency,
        available: parseFloat(wallet.available),
        locked: parseFloat(wallet.locked),
        total: parseFloat(wallet.total)
      }));

      // Send welcome email
      await sendWelcomeEmail(email, firstName);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.first_name,
            lastName: result.user.last_name,
            referralCode: result.user.referral_code
          },
          token,
          wallet: {
            balances: balancesArray,
            totalValueUSD: totalValueUSD
          }
        },
        message: 'Account created successfully! $5 bonus credited.'
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create account'
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Find user
      const user = await User.findByEmail(email);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Check if account is locked
      if (user.lock_until && user.lock_until > new Date()) {
        return res.status(423).json({
          success: false,
          error: 'Account is temporarily locked. Try again later.'
        });
      }

      // Check if account is active
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: 'Account is deactivated'
        });
      }

      // Verify password
      const isValidPassword = await User.verifyPassword(user, password);

      if (!isValidPassword) {
        // Increment login attempts
        const attempts = user.login_attempts + 1;
        await User.updateLoginAttempts(email, attempts);

        // Lock account after 5 failed attempts
        if (attempts >= 5) {
          const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
          await User.lockAccount(email, lockUntil);
          
          return res.status(423).json({
            success: false,
            error: 'Account locked due to too many failed attempts. Try again in 15 minutes.'
          });
        }

        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Reset login attempts on successful login
      await User.updateLastLogin(user.id);

      // Generate token
      const token = generateToken(user.id);

      // Get wallet data
      const wallets = await Wallet.getUserWallets(user.id);
      const totalValueUSD = await Wallet.getTotalValueUSD(user.id);

      // Format wallet balances as array for frontend
      const balancesArray = wallets.map(wallet => ({
        currency: wallet.currency,
        available: parseFloat(wallet.available),
        locked: parseFloat(wallet.locked),
        total: parseFloat(wallet.total)
      }));

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            country: user.country,
            isVerified: user.is_verified,
            kycLevel: user.kyc_level,
            referralCode: user.referral_code,
            twoFactorEnabled: user.two_factor_enabled
          },
          token,
          wallet: {
            balances: balancesArray,
            totalValueUSD: totalValueUSD
          }
        },
        message: 'Login successful'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  }

  static async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get wallet data
      const wallets = await Wallet.getUserWallets(user.id);
      const totalValueUSD = await Wallet.getTotalValueUSD(user.id);

      // Format wallet balances as array for frontend
      const balancesArray = wallets.map(wallet => ({
        currency: wallet.currency,
        available: parseFloat(wallet.available),
        locked: parseFloat(wallet.locked),
        total: parseFloat(wallet.total)
      }));

      // Get referral stats
      const referralStats = await User.getReferralStats(user.id);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            country: user.country,
            isVerified: user.is_verified,
            kycLevel: user.kyc_level,
            kycStatus: user.kyc_status,
            referralCode: user.referral_code,
            referredBy: user.referred_by,
            twoFactorEnabled: user.two_factor_enabled,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          },
          wallet: {
            balances: balancesArray,
            totalValueUSD: totalValueUSD
          },
          referralStats: referralStats
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user data'
      });
    }
  }

  static async logout(req, res) {
    try {
      // In a real app, you might want to invalidate the token
      // For now, we'll just respond with success
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  static async refreshToken(req, res) {
    try {
      const refreshToken = req.body.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Check if user exists
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      // Generate new tokens
      const newToken = generateToken(user.id);
      const newRefreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE }
      );

      res.json({
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to refresh token'
      });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { firstName, lastName, phone, country } = req.body;
      const userId = req.user.id;

      const updateData = {};
      if (firstName) updateData.first_name = firstName;
      if (lastName) updateData.last_name = lastName;
      if (phone) updateData.phone = phone;
      if (country) updateData.country = country;

      const result = await User.updateProfile(userId, updateData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          user: result.user
        },
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }
}

module.exports = AuthController;