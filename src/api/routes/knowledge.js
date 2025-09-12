import express from 'express';
import { KnowledgeProcessingService } from '../services/KnowledgeProcessingService.js';
import { SemanticSearchEngine } from '../services/SemanticSearchEngine.js';
import { ResponseGenerationEngine } from '../services/ResponseGenerationEngine.js';
import { AntiHallucinationEngine } from '../services/AntiHallucinationEngine.js';
import { EscalationEngine } from '../services/EscalationEngine.js';
import { ContextAwarenessEngine } from '../services/ContextAwarenessEngine.js';
import { IntegrationService } from '../services/IntegrationService.js';
import { QualityAssuranceEngine } from '../services/QualityAssuranceEngine.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

const router = express.Router();

// Initialize all knowledge processing services
let knowledgeService, searchEngine, responseEngine, antiHallucinationEngine;
let escalationEngine, contextEngine, integrationService, qualityEngine;

async function initializeServices() {
  try {
    // Initialize core knowledge service
    knowledgeService = new KnowledgeProcessingService();
    
    // Initialize search engine
    searchEngine = new SemanticSearchEngine(knowledgeService);
    
    // Initialize response generation
    responseEngine = new ResponseGenerationEngine(knowledgeService, searchEngine);
    
    // Initialize anti-hallucination system
    antiHallucinationEngine = new AntiHallucinationEngine(knowledgeService);
    
    // Initialize escalation system
    escalationEngine = new EscalationEngine(knowledgeService);
    
    // Initialize context awareness
    contextEngine = new ContextAwarenessEngine(knowledgeService);
    
    // Initialize integration services
    integrationService = new IntegrationService();
    
    // Initialize quality assurance
    qualityEngine = new QualityAssuranceEngine();
    
    logger.info('Knowledge processing services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize knowledge services', { error: error.message });
    throw error;
  }
}

// Initialize services on startup
initializeServices().catch(error => {
  logger.error('Knowledge services initialization failed', { error: error.message });
});

/**
 * POST /api/knowledge/query
 * Main knowledge query endpoint - handles all employee questions
 */
router.post('/query', async (req, res, next) => {
  try {
    const {
      query,
      userContext = {},
      includeExamples = true,
      includeNextSteps = true,
      responseStyle = 'helpful'
    } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw ApiError.badRequest('Query is required and must be a non-empty string');
    }

    logger.info('Processing knowledge query', {
      query: query.substring(0, 50),
      employeeId: userContext.employeeId,
      department: userContext.department,
      role: userContext.role
    });

    const startTime = Date.now();

    // Step 1: Build comprehensive user context
    const comprehensiveContext = await contextEngine.buildUserContext(userContext);

    // Step 2: Query integrated systems for additional data
    const integratedData = await integrationService.queryIntegratedSystems(
      query,
      comprehensiveContext,
      'auto'
    );

    // Step 3: Perform semantic search
    const searchResults = await searchEngine.performSemanticSearch(
      await knowledgeService.generateEmbedding(query),
      query,
      {
        department: comprehensiveContext.employee?.department,
        role: comprehensiveContext.employee?.role,
        maxResults: 10,
        threshold: 0.7
      }
    );

    // Step 4: Analyze escalation needs
    const escalationAnalysis = await escalationEngine.analyzeEscalationNeed(
      query,
      searchResults.results,
      comprehensiveContext
    );

    // Step 5: Generate response or escalation
    let response;
    if (escalationAnalysis.shouldEscalate) {
      response = await escalationEngine.generateEscalationResponse(
        escalationAnalysis,
        query,
        searchResults.results,
        comprehensiveContext
      );
    } else {
      // Generate knowledge-based response
      response = await responseEngine.generateResponse(
        query,
        searchResults.results,
        {
          ...comprehensiveContext.employee,
          responseStyle,
          includeExamples,
          includeNextSteps
        }
      );

      // Step 6: Verify response accuracy
      const verificationResult = await antiHallucinationEngine.verifyResponse(
        response.content,
        searchResults.results,
        query
      );

      // Use verified response
      response.content = verificationResult.verifiedResponse;
      response.verification = {
        confidenceScore: verificationResult.confidenceScore,
        verificationPassed: verificationResult.metadata?.verificationPassed,
        sourceAttribution: verificationResult.sourceAttribution
      };
    }

    // Step 7: Quality assurance validation
    const qualityResults = await qualityEngine.validateResponse(
      response,
      query,
      comprehensiveContext,
      searchResults.results
    );

    // Step 8: Apply contextual enhancements
    const contextualEnhancements = await contextEngine.generateContextualEnhancements(
      response,
      comprehensiveContext,
      query
    );

    const totalTime = Date.now() - startTime;

    const finalResponse = {
      response: {
        content: response.content,
        examples: response.examples || [],
        nextSteps: response.nextSteps || [],
        sources: response.sources || [],
        escalation: response.escalation || null
      },
      context: {
        userProfile: {
          department: comprehensiveContext.employee?.department,
          role: comprehensiveContext.employee?.role,
          hasCompleteContext: comprehensiveContext.context_metadata?.hasCompleteInfo
        },
        searchResults: {
          totalFound: searchResults.metadata?.totalFound || 0,
          afterFiltering: searchResults.metadata?.afterContextFiltering || 0,
          avgConfidence: searchResults.metadata?.avgConfidence || 0
        },
        integrationData: {
          systemsQueried: integratedData.systemsQueried || [],
          totalItems: integratedData.totalItems || 0
        }
      },
      quality: {
        overallScore: qualityResults.qualityScore,
        grade: qualityResults.qualityReport?.grade,
        passesThreshold: qualityResults.passesThreshold,
        recommendations: qualityResults.recommendations.slice(0, 3)
      },
      enhancements: contextualEnhancements,
      metadata: {
        processingTime: totalTime,
        queryLength: query.length,
        escalationAnalyzed: escalationAnalysis.shouldEscalate,
        qualityValidated: true,
        timestamp: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      data: finalResponse,
      processingTime: totalTime
    });

    logger.info('Knowledge query processed successfully', {
      query: query.substring(0, 50),
      processingTime: totalTime,
      qualityScore: qualityResults.qualityScore,
      escalated: escalationAnalysis.shouldEscalate
    });

  } catch (error) {
    logger.error('Knowledge query processing failed', {
      query: req.body.query?.substring(0, 50),
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * POST /api/knowledge/documents/ingest
 * Document ingestion endpoint for adding new knowledge to the system
 */
router.post('/documents/ingest', async (req, res, next) => {
  try {
    const {
      documentData,
      source = 'upload',
      category = 'general',
      department = null,
      confidentiality = 'internal',
      version = '1.0',
      tags = [],
      author = 'system'
    } = req.body;

    if (!documentData || typeof documentData !== 'string') {
      throw ApiError.badRequest('Document data is required and must be a string');
    }

    logger.info('Starting document ingestion', {
      source,
      category,
      department,
      size: documentData.length
    });

    const ingestionResult = await knowledgeService.ingestDocument(documentData, {
      source,
      category,
      department,
      confidentiality,
      version,
      tags,
      author
    });

    res.json({
      success: true,
      data: ingestionResult
    });

    logger.info('Document ingestion completed', {
      documentId: ingestionResult.documentId,
      chunksProcessed: ingestionResult.chunksProcessed
    });

  } catch (error) {
    logger.error('Document ingestion failed', {
      error: error.message,
      source: req.body.source,
      category: req.body.category
    });
    next(error);
  }
});

/**
 * GET /api/knowledge/search
 * Direct search endpoint for testing and debugging
 */
router.get('/search', async (req, res, next) => {
  try {
    const {
      q: query,
      department,
      role,
      maxResults = 10,
      threshold = 0.7,
      method = 'semantic'
    } = req.query;

    if (!query) {
      throw ApiError.badRequest('Query parameter "q" is required');
    }

    logger.info('Direct search request', {
      query: query.substring(0, 50),
      department,
      role,
      method
    });

    let searchResults;
    
    if (method === 'semantic') {
      const queryEmbedding = await knowledgeService.generateEmbedding(query);
      searchResults = await searchEngine.performSemanticSearch(
        queryEmbedding,
        query,
        {
          department,
          role,
          maxResults: parseInt(maxResults),
          threshold: parseFloat(threshold)
        }
      );
    } else {
      searchResults = await searchEngine.performKeywordSearch(query, {
        department,
        role,
        maxResults: parseInt(maxResults)
      });
    }

    res.json({
      success: true,
      data: searchResults
    });

  } catch (error) {
    logger.error('Direct search failed', {
      query: req.query.q?.substring(0, 50),
      error: error.message
    });
    next(error);
  }
});

/**
 * GET /api/knowledge/context/employee/:employeeId
 * Get or update employee context
 */
router.get('/context/employee/:employeeId', async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { includeProfile = true } = req.query;

    const userContext = await contextEngine.buildUserContext({
      employeeId,
      department: req.query.department,
      role: req.query.role
    });

    if (!includeProfile && userContext.employee?.profile) {
      delete userContext.employee.profile;
    }

    res.json({
      success: true,
      data: userContext
    });

  } catch (error) {
    logger.error('Failed to get employee context', {
      employeeId: req.params.employeeId,
      error: error.message
    });
    next(error);
  }
});

/**
 * PUT /api/knowledge/context/employee/:employeeId
 * Update employee context and profile
 */
router.put('/context/employee/:employeeId', async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const updates = req.body;

    const updatedProfile = await contextEngine.updateEmployeeProfile(employeeId, updates);

    res.json({
      success: true,
      data: updatedProfile
    });

    logger.info('Employee profile updated', { employeeId });

  } catch (error) {
    logger.error('Failed to update employee profile', {
      employeeId: req.params.employeeId,
      error: error.message
    });
    next(error);
  }
});

/**
 * GET /api/knowledge/quality/metrics
 * Get quality assurance metrics and reports
 */
router.get('/quality/metrics', async (req, res, next) => {
  try {
    const qualityMetrics = qualityEngine.getQualityMetrics();

    res.json({
      success: true,
      data: qualityMetrics
    });

  } catch (error) {
    logger.error('Failed to get quality metrics', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/knowledge/quality/test-suite
 * Run quality assurance test suite
 */
router.post('/quality/test-suite', async (req, res, next) => {
  try {
    logger.info('Running quality assurance test suite');

    const testResults = await qualityEngine.runTestSuite();

    res.json({
      success: true,
      data: testResults
    });

    logger.info('Quality test suite completed', {
      totalTests: testResults.totalTests,
      passedTests: testResults.passedTests,
      failedTests: testResults.failedTests
    });

  } catch (error) {
    logger.error('Quality test suite failed', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/knowledge/integrations/status
 * Get integration status and health
 */
router.get('/integrations/status', async (req, res, next) => {
  try {
    const integrationStatus = integrationService.getIntegrationStatus();

    res.json({
      success: true,
      data: integrationStatus
    });

  } catch (error) {
    logger.error('Failed to get integration status', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/knowledge/integrations/:integrationId/test
 * Test specific integration
 */
router.post('/integrations/:integrationId/test', async (req, res, next) => {
  try {
    const { integrationId } = req.params;

    const testResult = await integrationService.testIntegration(integrationId);

    res.json({
      success: true,
      data: testResult
    });

  } catch (error) {
    logger.error('Integration test failed', {
      integrationId: req.params.integrationId,
      error: error.message
    });
    next(error);
  }
});

/**
 * GET /api/knowledge/escalation/metrics
 * Get escalation metrics and patterns
 */
router.get('/escalation/metrics', async (req, res, next) => {
  try {
    const escalationMetrics = escalationEngine.getEscalationMetrics();

    res.json({
      success: true,
      data: escalationMetrics
    });

  } catch (error) {
    logger.error('Failed to get escalation metrics', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/knowledge/context/departments
 * Get available departments and their configurations
 */
router.get('/context/departments', async (req, res, next) => {
  try {
    const departments = contextEngine.getAvailableDepartments();
    const departmentInfo = departments.map(dept => ({
      name: dept,
      info: contextEngine.getDepartmentInfo(dept)
    }));

    res.json({
      success: true,
      data: departmentInfo
    });

  } catch (error) {
    logger.error('Failed to get department information', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/knowledge/context/roles
 * Get available roles and their configurations
 */
router.get('/context/roles', async (req, res, next) => {
  try {
    const roles = contextEngine.getAvailableRoles();
    const roleInfo = roles.map(role => ({
      name: role,
      info: contextEngine.getRoleInfo(role)
    }));

    res.json({
      success: true,
      data: roleInfo
    });

  } catch (error) {
    logger.error('Failed to get role information', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/knowledge/quality/export
 * Export quality report for specified date range
 */
router.post('/quality/export', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      throw ApiError.badRequest('Start date and end date are required');
    }

    const exportPath = await qualityEngine.exportQualityReport(startDate, endDate);

    res.json({
      success: true,
      data: {
        exportPath,
        message: 'Quality report exported successfully'
      }
    });

  } catch (error) {
    logger.error('Quality report export failed', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/knowledge/system/health
 * System health check for all knowledge processing components
 */
router.get('/system/health', async (req, res, next) => {
  try {
    const healthStatus = {
      knowledgeService: !!knowledgeService,
      searchEngine: !!searchEngine,
      responseEngine: !!responseEngine,
      antiHallucinationEngine: !!antiHallucinationEngine,
      escalationEngine: !!escalationEngine,
      contextEngine: !!contextEngine,
      integrationService: !!integrationService,
      qualityEngine: !!qualityEngine,
      timestamp: new Date().toISOString()
    };

    const allHealthy = Object.values(healthStatus).every(status => 
      typeof status === 'boolean' ? status : true
    );

    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: healthStatus,
      message: allHealthy ? 'All systems operational' : 'Some systems unavailable'
    });

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * GET /api/knowledge/system/stats
 * Get system statistics and performance metrics
 */
router.get('/system/stats', async (req, res, next) => {
  try {
    const stats = {
      knowledge: {
        documentsIndexed: knowledgeService?.documentIndex?.size || 0,
        vectorIndex: knowledgeService?.vectorIndex?.size || 0,
        companyTerminology: knowledgeService?.companyTerminology?.size || 0
      },
      quality: qualityEngine?.getQualityMetrics() || {},
      escalation: escalationEngine?.getEscalationMetrics() || {},
      integrations: integrationService?.getIntegrationStatus() || {},
      context: {
        departments: contextEngine?.getAvailableDepartments()?.length || 0,
        roles: contextEngine?.getAvailableRoles()?.length || 0,
        employeeProfiles: contextEngine?.employeeProfiles?.size || 0
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get system stats', { error: error.message });
    next(error);
  }
});

// Error handling middleware specific to knowledge routes
router.use((error, req, res, next) => {
  logger.error('Knowledge API error', {
    method: req.method,
    path: req.path,
    error: error.message,
    stack: error.stack
  });

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.statusCode
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Internal server error in knowledge processing',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

export default router;