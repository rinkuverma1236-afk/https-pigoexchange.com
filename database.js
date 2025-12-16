const { Pool } = require('pg');
const mongoose = require('mongoose');
require('dotenv').config();

// PostgreSQL connection
const pgPool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

// MongoDB connection
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
};

module.exports = {
  pgPool,
  connectMongoDB,
  query: (text, params) => pgPool.query(text, params)
};