const express = require('express');
const router = express.Router();
const TradingController = require('../controllers/tradingController');

// Market data
router.get('/markets', TradingController.getMarkets);
router.get('/orderbook/:pair', TradingController.getOrderBook);
router.get('/trades/:pair', TradingController.getTrades);

// Orders
router.post('/order', TradingController.placeOrder);
router.get('/orders', TradingController.getOrders);
router.get('/order/:orderId', TradingController.getOrder);
router.delete('/order/:orderId', TradingController.cancelOrder);

// User trades
router.get('/user/trades', TradingController.getUserTrades);

module.exports = router;;