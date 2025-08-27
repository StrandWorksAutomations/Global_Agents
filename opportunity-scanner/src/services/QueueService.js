import Bull from 'bull';
import RedditCollector from '../collectors/RedditCollector.js';
import OpportunityScorer from '../analyzers/OpportunityScorer.js';
import Opportunity from '../models/Opportunity.js';

export class QueueService {
  constructor(redisUrl = 'redis://localhost:6379') {
    this.scraperQueue = new Bull('scraper', redisUrl);
    this.analysisQueue = new Bull('analysis', redisUrl);
    this.notificationQueue = new Bull('notifications', redisUrl);
    
    this.setupWorkers();
  }

  setupWorkers() {
    // Scraper worker - handles data collection
    this.scraperQueue.process(5, async (job) => {
      const { subreddit, options } = job.data;
      console.log(`Processing scrape job for r/${subreddit}`);
      
      const collector = new RedditCollector({
        clientId: process.env.REDDIT_CLIENT_ID,
        clientSecret: process.env.REDDIT_CLIENT_SECRET,
        refreshToken: process.env.REDDIT_REFRESH_TOKEN
      });
      
      const opportunities = await collector.collectFromSubreddit(subreddit, options);
      
      // Queue each opportunity for analysis
      for (const opp of opportunities) {
        await this.analysisQueue.add('analyze', { opportunity: opp });
      }
      
      return { subreddit, count: opportunities.length };
    });

    // Analysis worker - scores and categorizes
    this.analysisQueue.process(10, async (job) => {
      const { opportunity } = job.data;
      const scorer = new OpportunityScorer();
      
      const scored = scorer.scoreOpportunity(opportunity);
      
      const savedOpp = await Opportunity.findOneAndUpdate(
        { 'source.url': opportunity.source.url },
        {
          ...opportunity,
          potentialScore: scored.totalScore,
          category: scored.category,
          sentiment: scored.breakdown.sentiment,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      // High-score opportunities trigger notifications
      if (scored.totalScore >= 80) {
        await this.notificationQueue.add('high-score', { 
          opportunity: savedOpp,
          score: scored.totalScore 
        });
      }
      
      return { id: savedOpp._id, score: scored.totalScore };
    });

    // Notification worker
    this.notificationQueue.process(async (job) => {
      const { opportunity, score } = job.data;
      
      // Send webhook notifications
      if (process.env.WEBHOOK_URL) {
        await fetch(process.env.WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🎯 High-value opportunity detected! Score: ${score}`,
            opportunity: {
              text: opportunity.text,
              url: opportunity.source.url,
              category: opportunity.category
            }
          })
        });
      }
      
      return { notified: true };
    });
  }

  async queueSubredditScan(subreddit, options = {}) {
    return await this.scraperQueue.add('scrape', { subreddit, options }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }

  async queueBulkScan(subreddits) {
    const jobs = subreddits.map(subreddit => ({
      name: 'scrape',
      data: { subreddit, options: { limit: 50, timeFilter: 'day' } }
    }));
    
    return await this.scraperQueue.addBulk(jobs);
  }

  async getQueueStats() {
    const [scraperStats, analysisStats, notificationStats] = await Promise.all([
      this.getQueueMetrics(this.scraperQueue),
      this.getQueueMetrics(this.analysisQueue),
      this.getQueueMetrics(this.notificationQueue)
    ]);
    
    return {
      scraper: scraperStats,
      analysis: analysisStats,
      notifications: notificationStats
    };
  }

  async getQueueMetrics(queue) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount()
    ]);
    
    return { waiting, active, completed, failed };
  }

  async cleanup() {
    await Promise.all([
      this.scraperQueue.close(),
      this.analysisQueue.close(),
      this.notificationQueue.close()
    ]);
  }
}

export default QueueService;