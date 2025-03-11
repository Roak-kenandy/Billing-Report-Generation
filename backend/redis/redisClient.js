const Redis = require('ioredis');

// Create a Redis client
const redis = new Redis({
    host: '127.0.0.1',  // Redis server address
    port: 6379,         // Default Redis port
});

// Event listeners
redis.on('connect', () => {
    console.log('✅ Connected to Redis');
});
redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
});

module.exports = redis;
