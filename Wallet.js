const { pgPool } = require('../config/database');

class Wallet {
  static async getUserWallets(userId) {
    try {
      const result = await pgPool.query(
        `SELECT 
          currency,
          available,
          locked,
          total,
          address,
          network,
          updated_at
         FROM wallets 
         WHERE user_id = $1 
         ORDER BY currency`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Get user wallets error:', error);
      throw error;
    }
  }

  static async getWalletBalance(userId, currency) {
    try {
      const result = await pgPool.query(
        `SELECT 
          available,
          locked,
          total,
          address
         FROM wallets 
         WHERE user_id = $1 AND currency = $2`,
        [userId, currency.toUpperCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Get wallet balance error:', error);
      throw error;
    }
  }

  static async getTotalValueUSD(userId) {
    try {
      // This would normally fetch prices from an external API
      // For now, we'll calculate based on USDT balance
      const result = await pgPool.query(
        `SELECT 
          SUM(
            CASE 
              WHEN currency = 'USDT' THEN available
              WHEN currency = 'BTC' THEN available * 44000 -- Example price
              WHEN currency = 'ETH' THEN available * 2200  -- Example price
              WHEN currency = 'PIGO' THEN available * 0.45 -- Example price
              ELSE 0
            END
          ) as total_value_usd
         FROM wallets 
         WHERE user_id = $1`,
        [userId]
      );

      return parseFloat(result.rows[0].total_value_usd) || 0;
    } catch (error) {
      console.error('Get total value USD error:', error);
      return 0;
    }
  }

  static async updateBalance(userId, currency, amount, type = 'available') {
    try {
      if (type !== 'available' && type !== 'locked') {
        return { success: false, error: 'Invalid balance type' };
      }

      const result = await pgPool.query(
        `UPDATE wallets 
         SET ${type} = ${type} + $1, 
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = $3
         RETURNING available, locked, total`,
        [amount, userId, currency.toUpperCase()]
      );

      if (result.rows.length === 0) {
        // Create wallet if it doesn't exist
        await pgPool.query(
          `INSERT INTO wallets (user_id, currency, available, locked)
           VALUES ($1, $2, $3, $4)`,
          [userId, currency.toUpperCase(), 
           type === 'available' ? amount : 0,
           type === 'locked' ? amount : 0]
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Update balance error:', error);
      return { success: false, error: 'Failed to update balance' };
    }
  }

  static async lockFunds(userId, currency, amount) {
    try {
      // Check if enough available balance
      const balance = await this.getWalletBalance(userId, currency);
      if (!balance || balance.available < amount) {
        return { 
          success: false, 
          error: 'Insufficient available balance' 
        };
      }

      // Move funds from available to locked
      const result = await pgPool.query(
        `UPDATE wallets 
         SET available = available - $1,
             locked = locked + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = $3
         RETURNING available, locked, total`,
        [amount, userId, currency.toUpperCase()]
      );

      return { 
        success: true, 
        newBalance: result.rows[0] 
      };
    } catch (error) {
      console.error('Lock funds error:', error);
      return { success: false, error: 'Failed to lock funds' };
    }
  }

  static async releaseFunds(userId, currency, amount) {
    try {
      // Check if enough locked balance
      const balance = await this.getWalletBalance(userId, currency);
      if (!balance || balance.locked < amount) {
        return { 
          success: false, 
          error: 'Insufficient locked balance' 
        };
      }

      // Move funds from locked to available
      const result = await pgPool.query(
        `UPDATE wallets 
         SET locked = locked - $1,
             available = available + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = $3
         RETURNING available, locked, total`,
        [amount, userId, currency.toUpperCase()]
      );

      return { 
        success: true, 
        newBalance: result.rows[0] 
      };
    } catch (error) {
      console.error('Release funds error:', error);
      return { success: false, error: 'Failed to release funds' };
    }
  }

  static async deposit(userId, currency, amount, txId, address) {
    try {
      // Update balance
      const updateResult = await this.updateBalance(
        userId, 
        currency, 
        amount, 
        'available'
      );

      if (!updateResult.success) {
        return updateResult;
      }

      // Create transaction record
      const transactionResult = await pgPool.query(
        `INSERT INTO transactions (
          tx_id, user_id, type, currency, amount, 
          status, to_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, tx_id, amount, status, created_at`,
        [
          txId,
          userId,
          'DEPOSIT',
          currency.toUpperCase(),
          amount,
          'completed',
          address
        ]
      );

      return { 
        success: true, 
        transaction: transactionResult.rows[0] 
      };
    } catch (error) {
      console.error('Deposit error:', error);
      return { success: false, error: 'Failed to process deposit' };
    }
  }

  static async withdraw(userId, currency, amount, address, fee = 0) {
    try {
      // Check if enough available balance (including fee)
      const balance = await this.getWalletBalance(userId, currency);
      const totalAmount = parseFloat(amount) + parseFloat(fee);
      
      if (!balance || balance.available < totalAmount) {
        return { 
          success: false, 
          error: 'Insufficient available balance' 
        };
      }

      // Deduct funds
      const updateResult = await pgPool.query(
        `UPDATE wallets 
         SET available = available - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = $3
         RETURNING available, locked, total`,
        [totalAmount, userId, currency.toUpperCase()]
      );

      // Generate transaction ID
      const txId = `WDR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create transaction record
      const transactionResult = await pgPool.query(
        `INSERT INTO transactions (
          tx_id, user_id, type, currency, amount, fee,
          status, from_address, to_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, tx_id, amount, fee, status, created_at`,
        [
          txId,
          userId,
          'WITHDRAWAL',
          currency.toUpperCase(),
          amount,
          fee,
          'pending',
          'exchange_wallet',
          address
        ]
      );

      return { 
        success: true, 
        transaction: transactionResult.rows[0],
        newBalance: updateResult.rows[0]
      };
    } catch (error) {
      console.error('Withdraw error:', error);
      return { success: false, error: 'Failed to process withdrawal' };
    }
  }
}

module.exports = Wallet;;