import mongoose from 'mongoose';

// Enhanced Opportunity Schema with better indexing
const opportunitySchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    index: 'text' // Full-text search
  },
  source: {
    platform: { type: String, index: true },
    url: { type: String, unique: true, sparse: true },
    subreddit: { type: String, index: true },
    author: String,
    timestamp: { type: Date, index: true }
  },
  patterns: [{
    type: { type: String, index: true },
    phrase: String,
    confidence: Number
  }],
  category: {
    type: String,
    enum: ['product', 'service', 'feature', 'improvement', 'automation', 'other'],
    index: true
  },
  sentiment: {
    score: Number,
    magnitude: Number
  },
  engagement: {
    upvotes: { type: Number, index: true },
    comments: Number,
    shares: Number,
    engagementScore: { type: Number, index: true } // Composite metric
  },
  keywords: [{
    type: String,
    index: true
  }],
  potentialScore: {
    type: Number,
    min: 0,
    max: 100,
    index: true
  },
  scoring: {
    breakdown: {
      engagement: Number,
      pattern: Number,
      sentiment: Number,
      recency: Number,
      keywords: Number
    },
    lastCalculated: Date
  },
  status: {
    type: String,
    enum: ['new', 'reviewed', 'validated', 'archived', 'actioned'],
    default: 'new',
    index: true
  },
  tags: [{ type: String, index: true }],
  notes: String,
  actionsTaken: [{
    action: String,
    timestamp: Date,
    user: String,
    notes: String
  }],
  metadata: {
    processedAt: Date,
    processingTime: Number,
    version: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: Date
}, {
  timestamps: true,
  optimisticConcurrency: true
});

// Compound indexes for common queries
opportunitySchema.index({ potentialScore: -1, createdAt: -1 });
opportunitySchema.index({ category: 1, status: 1, potentialScore: -1 });
opportunitySchema.index({ 'source.platform': 1, 'source.timestamp': -1 });
opportunitySchema.index({ status: 1, createdAt: -1 });
opportunitySchema.index({ 'engagement.engagementScore': -1 });

// Virtual for age in hours
opportunitySchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

// Pre-save middleware to calculate engagement score
opportunitySchema.pre('save', function(next) {
  if (this.engagement) {
    this.engagement.engagementScore = 
      (this.engagement.upvotes * 1) + 
      (this.engagement.comments * 2) + 
      (this.engagement.shares * 3);
  }
  this.updatedAt = new Date();
  next();
});

// User Schema for authentication
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'analyst', 'viewer'],
    default: 'viewer'
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  preferences: {
    notificationThreshold: { type: Number, default: 80 },
    emailNotifications: { type: Boolean, default: true },
    webhookUrl: String,
    favoriteCategories: [String],
    timezone: { type: String, default: 'UTC' }
  },
  usage: {
    lastLogin: Date,
    totalLogins: { type: Number, default: 0 },
    opportunitiesReviewed: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  metrics: {
    totalOpportunities: Number,
    newOpportunities: Number,
    avgScore: Number,
    topCategories: [{
      category: String,
      count: Number,
      avgScore: Number
    }],
    topSubreddits: [{
      subreddit: String,
      count: Number,
      avgScore: Number
    }],
    patternDistribution: [{
      pattern: String,
      count: Number,
      avgScore: Number
    }]
  },
  performance: {
    scanDuration: Number,
    opportunitiesProcessed: Number,
    errorsEncountered: Number,
    cacheHitRate: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

analyticsSchema.index({ date: -1 });

// Scan History Schema
const scanHistorySchema = new mongoose.Schema({
  startTime: Date,
  endTime: Date,
  status: {
    type: String,
    enum: ['running', 'completed', 'failed'],
    default: 'running'
  },
  stats: {
    subredditsScanned: Number,
    postsAnalyzed: Number,
    opportunitiesFound: Number,
    newOpportunities: Number,
    errors: [String]
  },
  duration: Number,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Aggregation helpers
opportunitySchema.statics.getTopOpportunities = function(limit = 10) {
  return this.find({ status: { $ne: 'archived' } })
    .sort({ potentialScore: -1, createdAt: -1 })
    .limit(limit);
};

opportunitySchema.statics.getByDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ createdAt: -1 });
};

opportunitySchema.statics.getCategoryStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgScore: { $avg: '$potentialScore' },
        maxScore: { $max: '$potentialScore' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Export models
export const Opportunity = mongoose.model('Opportunity', opportunitySchema);
export const User = mongoose.model('User', userSchema);
export const Analytics = mongoose.model('Analytics', analyticsSchema);
export const ScanHistory = mongoose.model('ScanHistory', scanHistorySchema);

export default {
  Opportunity,
  User,
  Analytics,
  ScanHistory
};