const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

const runMigrations = async () => {
  try {
    await pool.query(`
      -- Users Table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        country VARCHAR(100),
        referral_code VARCHAR(20) UNIQUE,
        referred_by VARCHAR(20),
        kyc_status VARCHAR(20) DEFAULT 'pending',
        kyc_level INTEGER DEFAULT 0,
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        is_admin BOOLEAN DEFAULT FALSE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret VARCHAR(255),
        last_login TIMESTAMP,
        login_attempts INTEGER DEFAULT 0,
        lock_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- User Profiles Table
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        avatar_url VARCHAR(500),
        bio TEXT,
        trading_experience VARCHAR(50),
        preferred_language VARCHAR(10) DEFAULT 'en',
        timezone VARCHAR(50),
        notification_settings JSONB DEFAULT '{"email": true, "push": true, "trade": true}',
        trading_settings JSONB DEFAULT '{"default_pair": "BTC/USDT", "default_order_type": "LIMIT"}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Wallets Table
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        currency VARCHAR(10) NOT NULL,
        available DECIMAL(20, 8) DEFAULT 0,
        locked DECIMAL(20, 8) DEFAULT 0,
        total DECIMAL(20, 8) GENERATED ALWAYS AS (available + locked) STORED,
        address VARCHAR(255),
        network VARCHAR(50),
        last_synced TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, currency)
      );

      -- Transactions Table
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        tx_id VARCHAR(255) UNIQUE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        fee DECIMAL(20, 8) DEFAULT 0,
        network_fee DECIMAL(20, 8) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        from_address VARCHAR(255),
        to_address VARCHAR(255),
        confirmations INTEGER DEFAULT 0,
        block_hash VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Orders Table
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        pair VARCHAR(20) NOT NULL,
        type VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        price DECIMAL(20, 8),
        quantity DECIMAL(20, 8) NOT NULL,
        filled_quantity DECIMAL(20, 8) DEFAULT 0,
        remaining_quantity DECIMAL(20, 8) GENERATED ALWAYS AS (quantity - filled_quantity) STORED,
        status VARCHAR(20) DEFAULT 'pending',
        time_in_force VARCHAR(20),
        stop_price DECIMAL(20, 8),
        iceberg_quantity DECIMAL(20, 8),
        fee DECIMAL(20, 8) DEFAULT 0,
        fee_currency VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_status (user_id, status),
        INDEX idx_pair_status (pair, status)
      );

      -- Trades Table
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        trade_id VARCHAR(50) UNIQUE NOT NULL,
        order_id VARCHAR(50) REFERENCES orders(order_id),
        pair VARCHAR(20) NOT NULL,
        taker_order_id VARCHAR(50),
        maker_order_id VARCHAR(50),
        price DECIMAL(20, 8) NOT NULL,
        quantity DECIMAL(20, 8) NOT NULL,
        fee DECIMAL(20, 8) DEFAULT 0,
        fee_currency VARCHAR(10),
        is_buyer_maker BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Referrals Table
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        referral_code VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        bonus_paid DECIMAL(20, 8) DEFAULT 0,
        total_commission DECIMAL(20, 8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_referrer_status (referrer_id, status)
      );

      -- Audit Logs Table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        ip_address INET,
        user_agent TEXT,
        location VARCHAR(255),
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- API Keys Table
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        api_key VARCHAR(100) UNIQUE NOT NULL,
        api_secret VARCHAR(255) NOT NULL,
        label VARCHAR(100),
        permissions JSONB DEFAULT '["read", "trade"]',
        ip_whitelist TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON wallets(user_id, currency);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_transactions_type_created ON transactions(type, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_pair_created ON orders(pair, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_trades_pair_created ON trades(pair, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at);

      -- Create function to update updated_at timestamp
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Create triggers for updated_at
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
          CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wallets_updated_at') THEN
          CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at') THEN
          CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;
    `);

    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
};

runMigrations();