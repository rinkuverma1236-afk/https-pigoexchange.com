const Wallet = require('../models/Wallet');

class WalletController {
  static async getBalances(req, res) {
    try {
      const userId = req.user.id;
      const wallets = await Wallet.getUserWallets(userId);
      const totalValueUSD = await Wallet.getTotalValueUSD(userId);

      res.json({
        success: true,
        data: {
          wallets,
          totalValueUSD: totalValueUSD
        }
      });
    } catch (error) {
      console.error('Get balances error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get wallet balances'
      });
    }
  }

  static async getBalance(req, res) {
    try {
      const userId = req.user.id;
      const { currency } = req.params;

      const balance = await Wallet.getWalletBalance(userId, currency);

      if (!balance) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      res.json({
        success: true,
        data: balance
      });
    } catch (error) {
      console.error('Get balance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get balance'
      });
    }
  }

  static async deposit(req, res) {
    try {
      const userId = req.user.id;
      const { currency, amount, txId, address } = req.body;

      if (!currency || !amount || !txId || !address) {
        return res.status(400).json({
          success: false,
          error: 'Currency, amount, txId, and address are required'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be positive'
        });
      }

      const result = await Wallet.deposit(userId, currency, amount, txId, address);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          transaction: result.transaction
        },
        message: 'Deposit recorded successfully'
      });
    } catch (error) {
      console.error('Deposit error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process deposit'
      });
    }
  }

  static async withdraw(req, res) {
    try {
      const userId = req.user.id;
      const { currency, amount, address, fee } = req.body;

      if (!currency || !amount || !address) {
        return res.status(400).json({
          success: false,
          error: 'Currency, amount, and address are required'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be positive'
        });
      }

      // Validate address (simplified)
      if (address.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }

      // Check minimum withdrawal amount
      const minWithdrawal = {
        'USDT': 10,
        'BTC': 0.001,
        'ETH': 0.01,
        'PIGO': 10
      };

      if (amount < (minWithdrawal[currency] || 1)) {
        return res.status(400).json({
          success: false,
          error: `Minimum withdrawal amount is ${minWithdrawal[currency] || 1} ${currency}`
        });
      }

      const result = await Wallet.withdraw(
        userId, 
        currency, 
        amount, 
        address, 
        fee || 0
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          transaction: result.transaction,
          newBalance: result.newBalance
        },
        message: 'Withdrawal request submitted successfully'
      });
    } catch (error) {
      console.error('Withdraw error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process withdrawal'
      });
    }
  }

  static async getTransactions(req, res) {
    try {
      const userId = req.user.id;
      const { type, currency, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          id, tx_id, type, currency, amount, fee,
          status, from_address, to_address,
          confirmations, created_at, updated_at
        FROM transactions 
        WHERE user_id = $1
      `;
      const params = [userId];
      let paramCount = 2;

      if (type) {
        query += ` AND type = $${paramCount}`;
        params.push(type);
        paramCount++;
      }

      if (currency) {
        query += ` AND currency = $${paramCount}`;
        params.push(currency.toUpperCase());
        paramCount++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(parseInt(limit), parseInt(offset));

      const { pgPool } = require('../config/database');
      const result = await pgPool.query(query, params);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) FROM transactions 
        WHERE user_id = $1
        ${type ? ' AND type = $2' : ''}
        ${currency ? ` AND currency = $${type ? '3' : '2'}` : ''}
      `;
      
      const countParams = [userId];
      if (type) countParams.push(type);
      if (currency) countParams.push(currency.toUpperCase());
      
      const countResult = await pgPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: {
          transactions: result.rows,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + result.rows.length) < total
          }
        }
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transactions'
      });
    }
  }

  static async getDepositAddress(req, res) {
    try {
      const userId = req.user.id;
      const { currency } = req.params;
      const { network = 'ERC20' } = req.query;

      // In a real app, this would generate a unique deposit address
      // For now, we'll return a placeholder
      const address = `0x${Buffer.from(`${userId}:${currency}:${Date.now()}`).toString('hex').substring(0, 40)}`;

      // Update wallet with the address
      const { pgPool } = require('../config/database');
      await pgPool.query(
        `UPDATE wallets 
         SET address = $1, network = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3 AND currency = $4`,
        [address, network, userId, currency.toUpperCase()]
      );

      res.json({
        success: true,
        data: {
          currency,
          address,
          network,
          memo: userId.toString() // For some currencies like XRP, XLM
        },
        message: 'Deposit address generated'
      });
    } catch (error) {
      console.error('Get deposit address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate deposit address'
      });
    }
  }
}

module.exports = WalletController;;