const { pgPool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { email, password, firstName, lastName, phone, country, referredBy } = userData;

    try {
      // Hash password
      const salt = await bcrypt.genSalt(12);
      const password_hash = await bcrypt.hash(password, salt);

      // Generate referral code
      const referral_code = `REF${Date.now().toString().slice(-8)}`;

      // Check referral
      let referrer_id = null;
      if (referredBy) {
        const referrer = await pgPool.query(
          'SELECT id FROM users WHERE referral_code = $1',
          [referredBy]
        );
        if (referrer.rows.length > 0) {
          referrer_id = referrer.rows[0].id;
        }
      }

      // Create user
      const result = await pgPool.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, 
          phone, country, referral_code, referred_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, first_name, last_name, referral_code`,
        [email, password_hash, firstName, lastName, phone, country, referral_code, referrer_id]
      );

      const user = result.rows[0];

      // Add $5 bonus
      await pgPool.query(
        `INSERT INTO wallets (user_id, currency, available) 
         VALUES ($1, 'USDT', 5.00)`,
        [user.id]
      );

      return { success: true, user };
    } catch (error) {
      console.error('User creation error:', error);
      return { 
        success: false, 
        error: 'Email already exists' 
      };
    }
  }

  static async findByEmail(email) {
    const result = await pgPool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pgPool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async verifyPassword(user, password) {
    return await bcrypt.compare(password, user.password_hash);
  }
}

module.exports = User;