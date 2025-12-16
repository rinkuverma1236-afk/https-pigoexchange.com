const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { pgPool } = require('../config/database');

let io = null;
const userSockets = new Map();

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verify user exists and is active
      const userQuery = await pgPool.query(
        'SELECT id, email, is_active FROM users WHERE id = $1',
        [decoded.id]
      );

      if (userQuery.rows.length === 0 || !userQuery.rows[0].is_active) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = decoded.id;
      socket.userEmail = userQuery.rows[0].email;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id} - User: ${socket.userEmail}`);

    // Store socket reference
    userSockets.set(socket.userId, socket.id);

    // Join user room for private messages
    socket.join(`user:${socket.userId}`);

    // Handle subscriptions
    socket.on('subscribe', (channel) => {
      console.log(`User ${socket.userEmail} subscribed to ${channel}`);
      socket.join(channel);
    });

    socket.on('unsubscribe', (channel) => {
      console.log(`User ${socket.userEmail} unsubscribed from ${channel}`);
      socket.leave(channel);
    });

    // Handle trading events
    socket.on('place_order', async (orderData) => {
      try {
        console.log(`Order placed by ${socket.userEmail}:`, orderData);
        
        // Broadcast to orderbook channel
        io.to(`orderbook:${orderData.pair}`).emit('order_update', {
          type: 'new',
          order: orderData,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Socket place order error:', error);
        socket.emit('error', { message: 'Failed to place order' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      userSockets.delete(socket.userId);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to PIGO Exchange WebSocket',
      userId: socket.userId,
      timestamp: Date.now()
    });
  });

  console.log('✅ WebSocket server initialized');
  return io;
};

// Helper function to emit events to specific user
const emitToUser = (userId, event, data) => {
  const socketId = userSockets.get(userId);
  if (socketId && io) {
    io.to(socketId).emit(event, data);
  }
};

// Helper function to broadcast to channel
const broadcastToChannel = (channel, event, data) => {
  if (io) {
    io.to(channel).emit(event, data);
  }
};

// Market data updates
const updateMarketData = (pair, data) => {
  broadcastToChannel(`market:${pair}`, 'price_update', {
    pair,
    ...data,
    timestamp: Date.now()
  });
};

// Order updates
const notifyOrderUpdate = (userId, order) => {
  emitToUser(userId, 'order_update', order);
  
  // Also broadcast to orderbook channel
  broadcastToChannel(`orderbook:${order.pair}`, 'orderbook_update', {
    pair: order.pair,
    orderId: order.order_id,
    type: order.type,
    side: order.side,
    price: order.price,
    quantity: order.quantity,
    status: order.status,
    timestamp: Date.now()
  });
};

// Balance updates
const notifyBalanceUpdate = (userId, currency, newBalance) => {
  emitToUser(userId, 'balance_update', {
    currency,
    ...newBalance,
    timestamp: Date.now()
  });
};

module.exports = {
  initializeSocket,
  emitToUser,
  broadcastToChannel,
  updateMarketData,
  notifyOrderUpdate,
  notifyBalanceUpdate,
  io: () => io
};