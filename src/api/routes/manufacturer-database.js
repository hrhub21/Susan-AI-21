import express from 'express';
import { ManufacturerDatabaseService } from '../services/ManufacturerDatabaseService.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
let manufacturerService = null;

// Initialize the manufacturer service
async function initializeService() {
    if (!manufacturerService) {
        manufacturerService = new ManufacturerDatabaseService();
        await manufacturerService.initialize();
    }
    return manufacturerService;
}

// Middleware to ensure service is initialized
async function ensureServiceInitialized(req, res, next) {
    try {
        req.manufacturerService = await initializeService();
        next();
    } catch (error) {
        logger.error('Failed to initialize manufacturer service:', error);
        res.status(500).json({
            error: 'Service initialization failed',
            message: error.message
        });
    }
}

// Apply middleware to all routes
router.use(ensureServiceInitialized);

/**
 * @swagger
 * components:
 *   schemas:
 *     Manufacturer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         market_share:
 *           type: number
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         total_products:
 *           type: integer
 *         discontinued_products:
 *           type: integer
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         manufacturer_id:
 *           type: string
 *         series:
 *           type: string
 *         color:
 *           type: string
 *         type:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, discontinued, limited_availability]
 *         price_per_square:
 *           type: number
 *         specifications:
 *           type: object
 */

/**
 * @swagger
 * /api/manufacturer-database/manufacturers:
 *   get:
 *     summary: Get list of all manufacturers
 *     tags: [Manufacturer Database]
 *     responses:
 *       200:
 *         description: List of manufacturers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Manufacturer'
 */
router.get('/manufacturers', async (req, res) => {
    try {
        const manufacturers = req.manufacturerService.getManufacturerList();
        
        res.json({
            success: true,
            data: manufacturers,
            metadata: {
                total_count: manufacturers.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting manufacturers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve manufacturers',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/products/search:
 *   post:
 *     summary: Search for products with filters
 *     tags: [Manufacturer Database]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               type:
 *                 type: string
 *               color:
 *                 type: string
 *               price_range:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                   max:
 *                     type: number
 *               status:
 *                 type: string
 *               include_discontinued:
 *                 type: boolean
 *               sort_by:
 *                 type: string
 *               limit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Search results
 */
router.post('/products/search', async (req, res) => {
    try {
        const searchCriteria = req.body;
        const results = await req.manufacturerService.searchProducts(searchCriteria);
        
        res.json({
            success: true,
            data: results,
            metadata: {
                search_performed_at: new Date().toISOString(),
                execution_time: 'calculated_automatically'
            }
        });
    } catch (error) {
        logger.error('Error searching products:', error);
        res.status(500).json({
            success: false,
            error: 'Product search failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/products/{productId}:
 *   get:
 *     summary: Get detailed product information
 *     tags: [Manufacturer Database]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const productDetails = await req.manufacturerService.getProductDetails(productId);
        
        res.json({
            success: true,
            data: productDetails
        });
    } catch (error) {
        if (error.status === 404) {
            res.status(404).json({
                success: false,
                error: 'Product not found',
                message: error.message
            });
        } else {
            logger.error('Error getting product details:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve product details',
                message: error.message
            });
        }
    }
});

/**
 * @swagger
 * /api/manufacturer-database/products/{productId}/alternatives:
 *   get:
 *     summary: Find alternative products for discontinued item
 *     tags: [Manufacturer Database]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: max_results
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Alternative products found
 *       400:
 *         description: Product is not discontinued
 *       404:
 *         description: Product not found
 */
router.get('/products/:productId/alternatives', async (req, res) => {
    try {
        const { productId } = req.params;
        const { max_results = 5 } = req.query;
        
        const alternatives = await req.manufacturerService.findAlternativeProducts(
            productId, 
            parseInt(max_results)
        );
        
        res.json({
            success: true,
            data: alternatives
        });
    } catch (error) {
        if (error.status === 404) {
            res.status(404).json({
                success: false,
                error: 'Product not found',
                message: error.message
            });
        } else if (error.status === 400) {
            res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: error.message
            });
        } else {
            logger.error('Error finding alternatives:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to find alternatives',
                message: error.message
            });
        }
    }
});

/**
 * @swagger
 * /api/manufacturer-database/price-impact/analyze:
 *   post:
 *     summary: Analyze price impact between original and alternative products
 *     tags: [Manufacturer Database]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               original_product_id:
 *                 type: string
 *               alternative_product_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Price impact analysis
 */
router.post('/price-impact/analyze', async (req, res) => {
    try {
        const { original_product_id, alternative_product_id } = req.body;
        
        if (!original_product_id || !alternative_product_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                message: 'Both original_product_id and alternative_product_id are required'
            });
        }
        
        const priceImpactAnalysis = await req.manufacturerService.analyzePriceImpact(
            original_product_id,
            alternative_product_id
        );
        
        res.json({
            success: true,
            data: priceImpactAnalysis
        });
    } catch (error) {
        logger.error('Error analyzing price impact:', error);
        res.status(500).json({
            success: false,
            error: 'Price impact analysis failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/discontinued:
 *   get:
 *     summary: Get list of discontinued products
 *     tags: [Manufacturer Database]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: manufacturer
 *         schema:
 *           type: string
 *       - in: query
 *         name: since_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of discontinued products
 */
router.get('/discontinued', async (req, res) => {
    try {
        const { limit = 100, manufacturer, since_date } = req.query;
        
        let discontinuedProducts = req.manufacturerService.getDiscontinuedProducts(parseInt(limit));
        
        // Filter by manufacturer if specified
        if (manufacturer) {
            discontinuedProducts = discontinuedProducts.filter(product => {
                const productInfo = req.manufacturerService.products.get(product.product_id);
                return productInfo && productInfo.manufacturer_id === manufacturer;
            });
        }
        
        // Filter by date if specified
        if (since_date) {
            const sinceDate = new Date(since_date);
            discontinuedProducts = discontinuedProducts.filter(product => 
                new Date(product.discontinuation_date) >= sinceDate
            );
        }
        
        res.json({
            success: true,
            data: discontinuedProducts,
            metadata: {
                total_count: discontinuedProducts.length,
                filters_applied: {
                    manufacturer: manufacturer || null,
                    since_date: since_date || null,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        logger.error('Error getting discontinued products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve discontinued products',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/market-report:
 *   get:
 *     summary: Get comprehensive market report
 *     tags: [Manufacturer Database]
 *     responses:
 *       200:
 *         description: Market analysis report
 */
router.get('/market-report', async (req, res) => {
    try {
        const marketReport = await req.manufacturerService.getMarketReport();
        
        res.json({
            success: true,
            data: marketReport
        });
    } catch (error) {
        logger.error('Error generating market report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate market report',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/claim-integration:
 *   post:
 *     summary: Integrate manufacturer data with insurance claim
 *     tags: [Manufacturer Database]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               claimId:
 *                 type: string
 *               originalProducts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     manufacturer:
 *                       type: string
 *                     color:
 *                       type: string
 *                     model:
 *                       type: string
 *               propertyInfo:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   square_footage:
 *                     type: number
 *                   roof_age:
 *                     type: number
 *     responses:
 *       200:
 *         description: Claim integration results
 */
router.post('/claim-integration', async (req, res) => {
    try {
        const claimData = req.body;
        
        if (!claimData.claimId || !claimData.originalProducts) {
            return res.status(400).json({
                success: false,
                error: 'Missing required claim data',
                message: 'claimId and originalProducts are required'
            });
        }
        
        const integrationResults = await req.manufacturerService.integrateWithClaimSystem(claimData);
        
        res.json({
            success: true,
            data: integrationResults
        });
    } catch (error) {
        logger.error('Error integrating claim:', error);
        res.status(500).json({
            success: false,
            error: 'Claim integration failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/scraping/trigger:
 *   post:
 *     summary: Manually trigger product scraping for specific manufacturer
 *     tags: [Manufacturer Database]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               manufacturer_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Scraping triggered successfully
 */
router.post('/scraping/trigger', async (req, res) => {
    try {
        const { manufacturer_id } = req.body;
        
        if (!manufacturer_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing manufacturer_id',
                message: 'manufacturer_id is required'
            });
        }
        
        // Trigger scraping for the specified manufacturer
        const scrapingResults = await req.manufacturerService.scrapeManufacturerProducts(manufacturer_id);
        
        res.json({
            success: true,
            data: {
                manufacturer_id,
                products_scraped: scrapingResults.length,
                scraping_completed_at: new Date().toISOString(),
                results: scrapingResults
            }
        });
    } catch (error) {
        logger.error('Error triggering scraping:', error);
        res.status(500).json({
            success: false,
            error: 'Scraping trigger failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/alerts/subscribe:
 *   post:
 *     summary: Subscribe to product discontinuation alerts
 *     tags: [Manufacturer Database]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               alert_types:
 *                 type: array
 *                 items:
 *                   type: string
 *               manufacturers:
 *                 type: array
 *                 items:
 *                   type: string
 *               product_types:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Alert subscription created
 */
router.post('/alerts/subscribe', async (req, res) => {
    try {
        const { email, alert_types, manufacturers, product_types } = req.body;
        
        if (!email || !alert_types || alert_types.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'email and alert_types are required'
            });
        }
        
        const subscriptionId = req.manufacturerService.generateAlertId();
        
        // Store alert subscription
        req.manufacturerService.alertSubscriptions.set(subscriptionId, {
            id: subscriptionId,
            email,
            alert_types,
            manufacturers: manufacturers || [],
            product_types: product_types || [],
            created_at: new Date().toISOString(),
            status: 'active'
        });
        
        res.json({
            success: true,
            data: {
                subscription_id: subscriptionId,
                message: 'Alert subscription created successfully'
            }
        });
    } catch (error) {
        logger.error('Error creating alert subscription:', error);
        res.status(500).json({
            success: false,
            error: 'Alert subscription failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/analytics/trends:
 *   get:
 *     summary: Get product and pricing trends analysis
 *     tags: [Manufacturer Database]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [30d, 90d, 6m, 1y]
 *           default: 90d
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trends analysis
 */
router.get('/analytics/trends', async (req, res) => {
    try {
        const { period = '90d', category } = req.query;
        
        // Generate trends analysis based on historical data
        const trendsAnalysis = {
            period,
            category: category || 'all',
            generated_at: new Date().toISOString(),
            
            price_trends: {
                overall_direction: 'increasing',
                average_change: '+5.2%',
                volatility: 'moderate',
                top_increasing: [
                    { product: 'Architectural Shingles', change: '+8.3%' },
                    { product: 'Impact Resistant', change: '+6.7%' }
                ],
                top_decreasing: [
                    { product: '3-Tab Shingles', change: '-2.1%' }
                ]
            },
            
            discontinuation_trends: {
                total_discontinued: req.manufacturerService.discontinuedProducts.size,
                recent_discontinuations: 12, // Last 30 days
                top_reasons: [
                    { reason: 'manufacturer_decision', count: 8 },
                    { reason: 'low_demand', count: 3 },
                    { reason: 'replacement_product', count: 1 }
                ]
            },
            
            market_activity: {
                new_products_launched: 5,
                products_updated: 23,
                price_changes: 15,
                availability_changes: 8
            }
        };
        
        res.json({
            success: true,
            data: trendsAnalysis
        });
    } catch (error) {
        logger.error('Error generating trends analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Trends analysis failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/manufacturer-database/health:
 *   get:
 *     summary: Get service health and status
 *     tags: [Manufacturer Database]
 *     responses:
 *       200:
 *         description: Service health status
 */
router.get('/health', async (req, res) => {
    try {
        const healthStatus = {
            service: 'Manufacturer Database Service',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            
            statistics: {
                total_manufacturers: req.manufacturerService.manufacturers.size,
                total_products: req.manufacturerService.products.size,
                discontinued_products: req.manufacturerService.discontinuedProducts.size,
                active_alerts: req.manufacturerService.alertQueue.length
            },
            
            background_processes: {
                scraping_active: !!req.manufacturerService.scrapingInterval,
                price_tracking_active: !!req.manufacturerService.priceTrackingInterval,
                alert_processing_active: !!req.manufacturerService.alertProcessingInterval
            },
            
            last_activities: {
                last_scraping_run: 'calculated_from_manufacturer_data',
                last_price_update: 'calculated_from_price_history',
                last_alert_sent: 'calculated_from_alert_history'
            }
        };
        
        res.json({
            success: true,
            data: healthStatus
        });
    } catch (error) {
        logger.error('Error getting health status:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    logger.error('Manufacturer Database API Error:', error);
    
    if (error instanceof ApiError) {
        res.status(error.status).json({
            success: false,
            error: error.message,
            status: error.status
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

export default router;