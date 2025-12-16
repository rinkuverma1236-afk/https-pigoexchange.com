const { pgPool } = require('../src/config/database');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    console.log('🌱 Seeding database...');
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123!', 12);
    await pgPool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_admin, is_verified)
      VALUES ('admin@pigoexchange.com', $1, 'Admin', 'User', true, true)
      ON CONFLICT (email) DO NOTHING
    `, [adminPassword]);
    
    // Create test user
    const testPassword = await bcrypt.hash('Test123!', 12);
    await pgPool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, referral_code, is_verified)
      VALUES ('test@example.com', $1, 'Test', 'User', 'REF123456', true)
      ON CONFLICT (email) DO NOTHING
    `, [testPassword]);
    
    // Get test user ID
    const userResult = await pgPool.query(
      "SELECT id FROM users WHERE email = 'test@example.com'"
    );
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      // Add wallet balances for test user
      await pgPool.query(`
        INSERT INTO wallets (user_id, currency, available, locked)
        VALUES 
          ($1, 'USDT', 10000.00, 0),
          ($1, 'BTC', 0.5, 0),
          ($1, 'ETH', 5.0, 0),
          ($1, 'PIGO', 10000.00, 0)
        ON CONFLICT (user_id, currency) DO UPDATE SET
          available = EXCLUDED.available,
          locked = EXCLUDED.locked
      `, [userId]);
      
      // Add some sample orders
      await pgPool.query(`
        INSERT INTO orders (order_id, user_id, pair, type, side, price, quantity, status)
        VALUES 
          ('ORD-001', $1, 'BTC/USDT', 'LIMIT', 'BUY', 44000, 0.1, 'filled'),
          ('ORD-002', $1, 'ETH/USDT', 'MARKET', 'SELL', NULL, 2.0, 'filled'),
          ('ORD-003', $1, 'PIGO/USDT', 'LIMIT', 'BUY', 0.45, 1000, 'open')
        ON CONFLICT (order_id) DO NOTHING
      `, [userId]);
      
      // Add sample trades
      await pgPool.query(`
        INSERT INTO trades (trade_id, order_id, pair, price, quantity, is_buyer_maker)
        VALUES 
          ('TRD-001', 'ORD-001', 'BTC/USDT', 44000, 0.1, false),
          ('TRD-002', 'ORD-002', 'ETH/USDT', 2240.10, 2.0, true)
        ON CONFLICT (trade_id) DO NOTHING
      `);
    }
    
    console.log('✅ Database seeding completed!');
    console.log('📋 Test credentials:');
    console.log('   Email: test@example.com');
    console.log('   Password: Test123!');
    console.log('   Admin: admin@pigoexchange.com');
    console.log('   Admin Password: admin123!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await pgPool.end();
  }
};

seedDatabase();