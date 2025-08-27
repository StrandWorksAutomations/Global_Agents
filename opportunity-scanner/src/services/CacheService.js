import Redis from 'ioredis';
import crypto from 'crypto';

export class CacheService {
  constructor(redisUrl = 'redis://localhost:6379') {
    this.client = new Redis(redisUrl);
    this.defaultTTL = 3600; // 1 hour default
  }

  generateKey(...parts) {
    return parts.join(':');
  }

  hashKey(data) {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  async get(key) {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, ttl = this.defaultTTL) {
    return await this.client.setex(key, ttl, JSON.stringify(value));
  }

  async del(key) {
    return await this.client.del(key);
  }

  async exists(key) {
    return await this.client.exists(key);
  }

  // Cache Reddit API responses
  async cacheRedditResponse(subreddit, timeFilter, data) {
    const key = this.generateKey('reddit', subreddit, timeFilter, this.hashKey(data));
    return await this.set(key, data, 1800); // 30 minutes
  }

  async getRedditCache(subreddit, timeFilter) {
    const pattern = this.generateKey('reddit', subreddit, timeFilter, '*');
    const keys = await this.client.keys(pattern);
    
    if (keys.length === 0) return null;
    
    const values = await Promise.all(keys.map(k => this.get(k)));
    return values.filter(v => v !== null);
  }

  // Cache opportunity scores
  async cacheOpportunityScore(opportunityId, score) {
    const key = this.generateKey('score', opportunityId);
    return await this.set(key, score, 86400); // 24 hours
  }

  async getOpportunityScore(opportunityId) {
    const key = this.generateKey('score', opportunityId);
    return await this.get(key);
  }

  // Cache aggregated stats
  async cacheStats(type, stats) {
    const key = this.generateKey('stats', type, new Date().toISOString().split('T')[0]);
    return await this.set(key, stats, 3600);
  }

  async getStats(type, date = null) {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const key = this.generateKey('stats', type, dateStr);
    return await this.get(key);
  }

  // Rate limiting cache
  async checkRateLimit(identifier, limit = 100, window = 3600) {
    const key = this.generateKey('ratelimit', identifier);
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, window);
    }
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      reset: await this.client.ttl(key)
    };
  }

  // Session cache
  async setSession(sessionId, data, ttl = 86400) {
    const key = this.generateKey('session', sessionId);
    return await this.set(key, data, ttl);
  }

  async getSession(sessionId) {
    const key = this.generateKey('session', sessionId);
    return await this.get(key);
  }

  async deleteSession(sessionId) {
    const key = this.generateKey('session', sessionId);
    return await this.del(key);
  }

  // Bulk operations
  async mget(keys) {
    const values = await this.client.mget(keys);
    return values.map(v => v ? JSON.parse(v) : null);
  }

  async mset(pairs, ttl = this.defaultTTL) {
    const pipeline = this.client.pipeline();
    
    for (const [key, value] of Object.entries(pairs)) {
      pipeline.setex(key, ttl, JSON.stringify(value));
    }
    
    return await pipeline.exec();
  }

  // Cleanup
  async flushPattern(pattern) {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      return await this.client.del(...keys);
    }
    return 0;
  }

  async cleanup() {
    await this.client.quit();
  }
}

export default CacheService;