import express from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateQueryParams } from '../middleware/validation.js';
import { moderateRateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get weather data
router.get('/weather',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    required: ['location'],
    properties: {
      location: { type: 'string', minLength: 1 },
      units: {
        type: 'string',
        enum: ['metric', 'imperial'],
        default: 'metric'
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const { location, units = 'metric' } = req.query;
    
    try {
      // Mock weather data (in production, use real weather API)
      const weatherData = {
        location: location,
        current: {
          temperature: units === 'metric' ? 22 : 72,
          description: 'Partly cloudy',
          humidity: 65,
          windSpeed: units === 'metric' ? 15 : 9,
          pressure: 1013,
          visibility: 10,
          uvIndex: 5
        },
        forecast: [
          {
            date: new Date().toISOString().split('T')[0],
            high: units === 'metric' ? 25 : 77,
            low: units === 'metric' ? 18 : 64,
            description: 'Sunny'
          },
          {
            date: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
            high: units === 'metric' ? 23 : 73,
            low: units === 'metric' ? 16 : 61,
            description: 'Cloudy'
          }
        ],
        units,
        lastUpdated: new Date().toISOString()
      };
      
      logger.info('Weather data requested', { location, units });
      
      res.json({
        success: true,
        data: weatherData,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
      
    } catch (error) {
      logger.error('Weather API error', { location, error: error.message });
      throw ApiError.serviceUnavailable('Weather service temporarily unavailable');
    }
  })
);

// Get news feed
router.get('/news',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['general', 'business', 'technology', 'science', 'health', 'sports']
      },
      limit: { type: 'string', pattern: '^([1-9]|[1-4][0-9]|50)$' },
      country: { type: 'string', pattern: '^[a-z]{2}$' },
      language: { type: 'string', pattern: '^[a-z]{2}$' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { 
      category = 'general', 
      limit = 10, 
      country = 'us',
      language = 'en'
    } = req.query;
    
    try {
      // Mock news data (in production, use real news API like NewsAPI)
      const newsData = {
        category,
        totalResults: 100,
        articles: Array.from({ length: parseInt(limit) }, (_, i) => ({
          id: `article_${i + 1}`,
          title: `Breaking News Article ${i + 1}`,
          description: `This is a description of news article ${i + 1} about ${category}.`,
          url: `https://example.com/article-${i + 1}`,
          urlToImage: `https://via.placeholder.com/400x200?text=News+${i + 1}`,
          publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          source: {
            id: `source_${i % 5 + 1}`,
            name: `News Source ${i % 5 + 1}`
          },
          author: `Reporter ${i % 3 + 1}`,
          content: `Full content of article ${i + 1}...`
        })),
        requestParams: {
          category,
          limit: parseInt(limit),
          country,
          language
        },
        lastUpdated: new Date().toISOString()
      };
      
      logger.info('News data requested', { category, limit, country });
      
      res.json({
        success: true,
        data: newsData,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
      
    } catch (error) {
      logger.error('News API error', { category, error: error.message });
      throw ApiError.serviceUnavailable('News service temporarily unavailable');
    }
  })
);

// Get stock data
router.get('/stocks',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    required: ['symbols'],
    properties: {
      symbols: { type: 'string', minLength: 1 },
      interval: {
        type: 'string',
        enum: ['1min', '5min', '15min', '30min', '1hour', '1day'],
        default: '1day'
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const { symbols, interval = '1day' } = req.query;
    
    try {
      const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
      
      // Mock stock data (in production, use real stock API like Alpha Vantage)
      const stockData = {
        symbols: symbolList,
        interval,
        quotes: symbolList.map(symbol => ({
          symbol,
          price: (Math.random() * 1000 + 50).toFixed(2),
          change: (Math.random() * 20 - 10).toFixed(2),
          changePercent: (Math.random() * 10 - 5).toFixed(2),
          volume: Math.floor(Math.random() * 10000000),
          marketCap: (Math.random() * 1000000000000).toFixed(0),
          pe: (Math.random() * 50 + 5).toFixed(2),
          high52Week: (Math.random() * 200 + 100).toFixed(2),
          low52Week: (Math.random() * 50 + 20).toFixed(2),
          lastUpdated: new Date().toISOString()
        })),
        marketStatus: 'open', // or 'closed', 'pre-market', 'after-hours'
        lastUpdated: new Date().toISOString()
      };
      
      logger.info('Stock data requested', { symbols: symbolList, interval });
      
      res.json({
        success: true,
        data: stockData,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
      
    } catch (error) {
      logger.error('Stock API error', { symbols, error: error.message });
      throw ApiError.serviceUnavailable('Stock service temporarily unavailable');
    }
  })
);

// Get cryptocurrency data
router.get('/crypto',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      symbols: { type: 'string' },
      currency: { type: 'string', default: 'usd' },
      limit: { type: 'string', pattern: '^([1-9]|[1-9]\\d|100)$' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { symbols, currency = 'usd', limit = 10 } = req.query;
    
    try {
      let cryptoList;
      
      if (symbols) {
        cryptoList = symbols.split(',').map(s => s.trim().toLowerCase());
      } else {
        // Default top cryptocurrencies
        cryptoList = ['bitcoin', 'ethereum', 'cardano', 'solana', 'polkadot'];
      }
      
      // Mock crypto data (in production, use real crypto API like CoinGecko)
      const cryptoData = {
        currency,
        coins: cryptoList.slice(0, parseInt(limit)).map(coin => ({
          id: coin,
          name: coin.charAt(0).toUpperCase() + coin.slice(1),
          symbol: coin.slice(0, 3).toUpperCase(),
          price: (Math.random() * 50000 + 100).toFixed(2),
          change24h: (Math.random() * 20 - 10).toFixed(2),
          changePercent24h: (Math.random() * 20 - 10).toFixed(2),
          marketCap: (Math.random() * 1000000000000).toFixed(0),
          volume24h: (Math.random() * 10000000000).toFixed(0),
          rank: Math.floor(Math.random() * 100) + 1,
          lastUpdated: new Date().toISOString()
        })),
        lastUpdated: new Date().toISOString()
      };
      
      logger.info('Crypto data requested', { symbols: cryptoList, currency });
      
      res.json({
        success: true,
        data: cryptoData,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
      
    } catch (error) {
      logger.error('Crypto API error', { symbols, error: error.message });
      throw ApiError.serviceUnavailable('Cryptocurrency service temporarily unavailable');
    }
  })
);

// Get social media trends (mock)
router.get('/social/trends',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['twitter', 'reddit', 'all'],
        default: 'all'
      },
      location: { type: 'string' },
      limit: { type: 'string', pattern: '^([1-9]|[1-4][0-9]|50)$' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { platform = 'all', location = 'worldwide', limit = 10 } = req.query;
    
    try {
      // Mock social trends data
      const trendsData = {
        platform,
        location,
        trends: Array.from({ length: parseInt(limit) }, (_, i) => ({
          rank: i + 1,
          topic: `Trending Topic ${i + 1}`,
          volume: Math.floor(Math.random() * 1000000),
          sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)],
          url: `https://example.com/trend-${i + 1}`,
          relatedKeywords: [`keyword${i + 1}`, `term${i + 1}`]
        })),
        lastUpdated: new Date().toISOString()
      };
      
      logger.info('Social trends requested', { platform, location, limit });
      
      res.json({
        success: true,
        data: trendsData,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
      
    } catch (error) {
      logger.error('Social trends API error', { platform, error: error.message });
      throw ApiError.serviceUnavailable('Social media service temporarily unavailable');
    }
  })
);

export default router;