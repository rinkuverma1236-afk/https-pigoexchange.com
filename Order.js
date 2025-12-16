const { pgPool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Wallet = require('./Wallet');

class Order {
  static async createOrder(orderData) {
    const {
      user_id,
      pair,
      type,
      side,
      price,
      quantity,
      time_in_force = 'GTC',
      stop_price,
      iceberg_quantity
    } = orderData;

    try {
      // Generate order ID
      const order_id = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Get base and quote currencies
      const [baseCurrency, quoteCurrency] = pair.split('/');
      const isBuy = side === 'BUY';
      const currency = isBuy ? quoteCurrency : baseCurrency;
      const amount = isBuy ? quantity * price : quantity;

      // Check if market order
      if (type === 'MARKET') {
        // For market orders, we need to execute immediately
        // This is simplified - real implementation would match with order book
      } else {
        // For limit orders, lock funds
        const lockResult = await Wallet.lockFunds(user_id, currency, amount);
        if (!lockResult.success) {
          return lockResult;
        }
      }

      // Insert order
      const result = await pgPool.query(
        `INSERT INTO orders (
          order_id, user_id, pair, type, side, price, quantity,
          time_in_force, stop_price, iceberg_quantity, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING 
          order_id, pair, type, side, price, quantity,
          filled_quantity, remaining_quantity, status,
          created_at`,
        [
          order_id,
          user_id,
          pair,
          type,
          side,
          price,
          quantity,
          time_in_force,
          stop_price,
          iceberg_quantity,
          type === 'MARKET' ? 'pending' : 'open'
        ]
      );

      const order = result.rows[0];

      // If market order, try to execute immediately
      if (type === 'MARKET') {
        // Simplified execution - in real app, match with order book
        setTimeout(() => this.executeMarketOrder(order_id), 100);
      }

      return { 
        success: true, 
        order,
        message: type === 'MARKET' ? 'Market order placed, executing...' : 'Limit order placed'
      };
    } catch (error) {
      console.error('Create order error:', error);
      return { 
        success: false, 
        error: 'Failed to place order' 
      };
    }
  }

  static async executeMarketOrder(orderId) {
    try {
      // Get order details
      const orderQuery = await pgPool.query(
        `SELECT * FROM orders WHERE order_id = $1`,
        [orderId]
      );

      if (orderQuery.rows.length === 0) {
        return;
      }

      const order = orderQuery.rows[0];
      const [baseCurrency, quoteCurrency] = order.pair.split('/');
      
      // Simulate execution at current market price
      // In real app, this would match with order book
      const executionPrice = order.side === 'BUY' 
        ? await this.getMarketPrice(order.pair) * 1.001 // Slightly higher for buy
        : await this.getMarketPrice(order.pair) * 0.999; // Slightly lower for sell

      // Execute full quantity
      await this.executeTrade(
        order.order_id,
        order.pair,
        order.user_id,
        'system_market_maker',
        executionPrice,
        order.quantity
      );

      // Update order status
      await pgPool.query(
        `UPDATE orders 
         SET status = 'filled', 
             filled_quantity = quantity,
             price = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2`,
        [executionPrice, orderId]
      );

      console.log(`✅ Market order ${orderId} executed at ${executionPrice}`);
    } catch (error) {
      console.error('Execute market order error:', error);
      
      // If execution fails, cancel the order
      await pgPool.query(
        `UPDATE orders 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [orderId]
      );
    }
  }

  static async getMarketPrice(pair) {
    // Simulated price - in real app, fetch from market data
    const prices = {
      'BTC/USDT': 44120.50,
      'ETH/USDT': 2240.10,
      'SOL/USDT': 98.45,
      'PIGO/USDT': 0.4521
    };
    
    return prices[pair] || 100;
  }

  static async executeTrade(orderId, pair, userId, counterpartyId, price, quantity) {
    try {
      const trade_id = `TRD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const [baseCurrency, quoteCurrency] = pair.split('/');
      
      // Calculate fees (simplified)
      const feeRate = 0.001; // 0.1%
      const fee = quantity * price * feeRate;

      // Get order to determine side
      const orderQuery = await pgPool.query(
        `SELECT side FROM orders WHERE order_id = $1`,
        [orderId]
      );

      const side = orderQuery.rows[0]?.side || 'BUY';
      const isBuy = side === 'BUY';

      // Update user's wallet
      if (isBuy) {
        // Buying: deduct quote currency, add base currency
        await Wallet.updateBalance(userId, quoteCurrency, -(quantity * price), 'locked');
        await Wallet.updateBalance(userId, baseCurrency, quantity - (quantity * feeRate), 'available');
      } else {
        // Selling: deduct base currency, add quote currency
        await Wallet.updateBalance(userId, baseCurrency, -quantity, 'locked');
        await Wallet.updateBalance(userId, quoteCurrency, (quantity * price) - fee, 'available');
      }

      // Create trade record
      await pgPool.query(
        `INSERT INTO trades (
          trade_id, order_id, pair, price, quantity, fee,
          fee_currency, is_buyer_maker
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          trade_id,
          orderId,
          pair,
          price,
          quantity,
          fee,
          quoteCurrency,
          false // Simplified
        ]
      );

      return { success: true, trade_id };
    } catch (error) {
      console.error('Execute trade error:', error);
      throw error;
    }
  }

  static async cancelOrder(userId, orderId) {
    try {
      // Get order details
      const orderQuery = await pgPool.query(
        `SELECT * FROM orders WHERE order_id = $1 AND user_id = $2`,
        [orderId, userId]
      );

      if (orderQuery.rows.length === 0) {
        return { 
          success: false, 
          error: 'Order not found' 
        };
      }

      const order = orderQuery.rows[0];

      // Check if order can be cancelled
      if (['filled', 'cancelled', 'rejected'].includes(order.status)) {
        return { 
          success: false, 
          error: `Order is already ${order.status}` 
        };
      }

      // Release locked funds
      const [baseCurrency, quoteCurrency] = order.pair.split('/');
      const isBuy = order.side === 'BUY';
      const currency = isBuy ? quoteCurrency : baseCurrency;
      const amount = isBuy ? order.quantity * order.price : order.quantity;

      if (order.remaining_quantity > 0) {
        const releaseResult = await Wallet.releaseFunds(
          userId, 
          currency, 
          amount * (order.remaining_quantity / order.quantity)
        );

        if (!releaseResult.success) {
          return releaseResult;
        }
      }

      // Update order status
      await pgPool.query(
        `UPDATE orders 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [orderId]
      );

      return { success: true, message: 'Order cancelled successfully' };
    } catch (error) {
      console.error('Cancel order error:', error);
      return { 
        success: false, 
        error: 'Failed to cancel order' 
      };
    }
  }

  static async getUserOrders(userId, filters = {}) {
    try {
      let query = `
        SELECT 
          order_id, pair, type, side, price, quantity,
          filled_quantity, remaining_quantity, status,
          fee, fee_currency, created_at, updated_at
        FROM orders 
        WHERE user_id = $1
      `;
      const params = [userId];
      let paramCount = 2;

      // Apply filters
      if (filters.status) {
        query += ` AND status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      if (filters.pair) {
        query += ` AND pair = $${paramCount}`;
        params.push(filters.pair);
        paramCount++;
      }

      if (filters.side) {
        query += ` AND side = $${paramCount}`;
        params.push(filters.side);
        paramCount++;
      }

      // Add ordering
      query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
      params.push(filters.limit || 50);

      const result = await pgPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Get user orders error:', error);
      throw error;
    }
  }

  static async getOrderBook(pair, depth = 50) {
    try {
      const bidsQuery = await pgPool.query(
        `SELECT price, SUM(remaining_quantity) as quantity
         FROM orders 
         WHERE pair = $1 AND side = 'BUY' AND status = 'open'
         GROUP BY price 
         ORDER BY price DESC 
         LIMIT $2`,
        [pair, depth]
      );

      const asksQuery = await pgPool.query(
        `SELECT price, SUM(remaining_quantity) as quantity
         FROM orders 
         WHERE pair = $1 AND side = 'SELL' AND status = 'open'
         GROUP BY price 
         ORDER BY price ASC 
         LIMIT $2`,
        [pair, depth]
      );

      return {
        bids: bidsQuery.rows,
        asks: asksQuery.rows,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Get order book error:', error);
      throw error;
    }
  }
}

module.exports = Order;