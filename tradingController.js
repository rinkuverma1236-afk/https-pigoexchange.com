const Order = require('../models/Order');

class TradingController {
  static async placeOrder(req, res) {
    try {
      const userId = req.user.id;
      const {
        pair,
        type,
        side,
        price,
        quantity,
        time_in_force,
        stop_price,
        iceberg_quantity
      } = req.body;

      // Validation
      if (!pair || !type || !side || !quantity) {
        return res.status(400).json({
          success: false,
          error: 'Pair, type, side, and quantity are required'
        });
      }

      if (type !== 'MARKET' && !price) {
        return res.status(400).json({
          success: false,
          error: 'Price is required for limit orders'
        });
      }

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Quantity must be positive'
        });
      }

      if (price && price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Price must be positive'
        });
      }

      const orderData = {
        user_id: userId,
        pair: pair.toUpperCase(),
        type: type.toUpperCase(),
        side: side.toUpperCase(),
        price: price ? parseFloat(price) : null,
        quantity: parseFloat(quantity),
        time_in_force,
        stop_price: stop_price ? parseFloat(stop_price) : null,
        iceberg_quantity: iceberg_quantity ? parseFloat(iceberg_quantity) : null
      };

      const result = await Order.createOrder(orderData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          order: result.order
        },
        message: result.message
      });
    } catch (error) {
      console.error('Place order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to place order'
      });
    }
  }

  static async cancelOrder(req, res) {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;

      const result = await Order.cancelOrder(userId, orderId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel order'
      });
    }
  }

  static async getOrders(req, res) {
    try {
      const userId = req.user.id;
      const { status, pair, side, limit } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (pair) filters.pair = pair.toUpperCase();
      if (side) filters.side = side.toUpperCase();
      if (limit) filters.limit = parseInt(limit);

      const orders = await Order.getUserOrders(userId, filters);

      res.json({
        success: true,
        data: {
          orders
        }
      });
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get orders'
      });
    }
  }

  static async getOrder(req, res) {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;

      const { pgPool } = require('../config/database');
      const result = await pgPool.query(
        `SELECT 
          order_id, pair, type, side, price, quantity,
          filled_quantity, remaining_quantity, status,
          fee, fee_currency, time_in_force, stop_price,
          iceberg_quantity, created_at, updated_at
         FROM orders 
         WHERE order_id = $1 AND user_id = $2`,
        [orderId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Get trades for this order
      const tradesResult = await pgPool.query(
        `SELECT 
          trade_id, price, quantity, fee, created_at
         FROM trades 
         WHERE order_id = $1 
         ORDER BY created_at DESC`,
        [orderId]
      );

      res.json({
        success: true,
        data: {
          order: result.rows[0],
          trades: tradesResult.rows
        }
      });
    } catch (error) {
      console.error('Get order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order'
      });
    }
  }

  static async getOrderBook(req, res) {
    try {
      const { pair } = req.params;
      const { depth = 50 } = req.query;

      if (!pair) {
        return res.status(400).json({
          success: false,
          error: 'Trading pair is required'
        });
      }

      const orderBook = await Order.getOrderBook(pair.toUpperCase(), parseInt(depth));

      res.json({
        success: true,
        data: orderBook
      });
    } catch (error) {
      console.error('Get order book error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order book'
      });
    }
  }

  static async getTrades(req, res) {
    try {
      const { pair } = req.params;
      const { limit = 100 } = req.query;

      if (!pair) {
        return res.status(400).json({
          success: false,
          error: 'Trading pair is required'
        });
      }

      const { pgPool } = require('../config/database');
      const result = await pgPool.query(
        `SELECT 
          trade_id, price, quantity, is_buyer_maker, created_at
         FROM trades 
         WHERE pair = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [pair.toUpperCase(), parseInt(limit)]
      );

      res.json({
        success: true,
        data: {
          trades: result.rows
        }
      });
    } catch (error) {
      console.error('Get trades error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trades'
      });
    }
  }

  static async getUserTrades(req, res) {
    try {
      const userId = req.user.id;
      const { pair, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          t.trade_id, t.pair, t.price, t.quantity, t.fee,
          t.is_buyer_maker, t.created_at,
          o.side, o.type
        FROM trades t
        JOIN orders o ON t.order_id = o.order_id
        WHERE o.user_id = $1
      `;
      const params = [userId];
      let paramCount = 2;

      if (pair) {
        query += ` AND t.pair = $${paramCount}`;
        params.push(pair.toUpperCase());
        paramCount++;
      }

      query += ` ORDER BY t.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(parseInt(limit), parseInt(offset));

      const { pgPool } = require('../config/database');
      const result = await pgPool.query(query, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) 
        FROM trades t
        JOIN orders o ON t.order_id = o.order_id
        WHERE o.user_id = $1
        ${pair ? ' AND t.pair = $2' : ''}
      `;
      
      const countParams = [userId];
      if (pair) countParams.push(pair.toUpperCase());
      
      const countResult = await pgPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: {
          trades: result.rows,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + result.rows.length) < total
          }
        }
      });
    } catch (error) {
      console.error('Get user trades error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trades'
      });
    }
  }

  static async getMarkets(req, res) {
    try {
      // In a real app, fetch from external API or database
      const markets = [
        {
          pair: 'BTC/USDT',
          lastPrice: 44120.50,
          change24h: 2.4,
          volume24h: 1245000000,
          high24h: 44500.00,
          low24h: 43800.00
        },
        {
          pair: 'ETH/USDT',
          lastPrice: 2240.10,
          change24h: -1.1,
          volume24h: 850000000,
          high24h: 2300.00,
          low24h: 2200.00
        },
        {
          pair: 'SOL/USDT',
          lastPrice: 98.45,
          change24h: 5.2,
          volume24h: 450000000,
          high24h: 100.00,
          low24h: 92.00
        },
        {
          pair: 'PIGO/USDT',
          lastPrice: 0.4521,
          change24h: 12.5,
          volume24h: 25000000,
          high24h: 0.46,
          low24h: 0.40
        }
      ];

      res.json({
        success: true,
        data: {
          markets
        }
      });
    } catch (error) {
      console.error('Get markets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get markets'
      });
    }
  }
}

module.exports = TradingController;