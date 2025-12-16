const express = require('express');
const router = express.Router();
const WalletController = require('../controllers/walletController');

// Get all balances
router.get('/balances', WalletController.getBalances);

// Get specific balance
router.get('/balance/:currency', WalletController.getBalance);

// Get transactions
router.get('/transactions', WalletController.getTransactions);

// Deposit
router.post('/deposit', WalletController.deposit);

// Withdraw
router.post('/withdraw', WalletController.withdraw);

// Get deposit address
router.get('/deposit-address/:currency', WalletController.getDepositAddress);

module.exports = router;