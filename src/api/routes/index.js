import express from 'express';
import conversationRoutes from './conversations.js';
import voiceRoutes from './voice.js';
import modelsRoutes from './models.js';
import memoryRoutes from './memory.js';
import pluginsRoutes from './plugins.js';
import dataRoutes from './data.js';
import filesRoutes from './files.js';
import usersRoutes from './users.js';
import authRoutes from './auth.js';
import adminRoutes from './admin.js';
import knowledgeRoutes from './knowledge.js';
import roofERKnowledgeRoutes from './roofer-knowledge.js';
import roofingAnalysisRoutes from './roofing-analysis.js';
import hoverEagleViewRoutes from './hover-eagleview.js';
import templateRoutes from './templates.js';
import predictiveAnalyticsRoutes from './predictive-analytics.js';
import legalComplianceRoutes from './legal-compliance.js';
import legalPrecedentRoutes from './legal-precedents.js';
import integrationRoutes from './integrations.js';
import weatherRoutes from './weather.js';
import manufacturerDatabaseRoutes from './manufacturer-database.js';
import buildingCodesRoutes from './building-codes.js';
import documentOCRRoutes from './document-ocr.js';
import claimOCRIntegrationRoutes from './claim-ocr-integration.js';
import enterpriseUserRoutes from './enterprise-users.js';
import rbacRoutes from './rbac.js';
import multiLanguageRoutes from './multi-language.js';
import trainingRoutes from './training.js';
import videoGenerationRoutes from './video-generation.js';
import photoAnalysisRoutes from './photo-analysis.js';
import anythingLLMRoutes from './anythingllm.js';
import rynnecAnalysisRoutes from './rynnec-analysis.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { validationMiddleware } from '../middleware/validation.js';
import { errorHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    api: {
      version: 'v1',
      documentation: '/api/v1/docs'
    }
  });
});

// API Documentation endpoint
router.get('/docs', (req, res) => {
  res.redirect('/docs');
});

// Apply global middleware
router.use(rateLimitMiddleware);
router.use(validationMiddleware);

// Public routes (no authentication required)
router.use('/auth', authRoutes);
router.use('/voice', voiceRoutes); // Voice routes public for development
router.use('/roofer-knowledge', roofERKnowledgeRoutes); // Company knowledge base
router.use('/roofing-analysis', roofingAnalysisRoutes); // AI-powered roofing damage analysis
router.use('/building-codes', buildingCodesRoutes); // Multi-state building code compliance engine
router.use('/multi-language', multiLanguageRoutes); // Comprehensive multi-language support
router.use('/video-generation', videoGenerationRoutes); // Dynamic video generation for insurance claims
router.use('/', photoAnalysisRoutes); // Enhanced photo analysis with Qwen2.5-VL integration
router.use('/rynnec', rynnecAnalysisRoutes); // RynnEC enhanced visual reasoning and damage analysis

// Protected routes (authentication required)
router.use(authMiddleware);

// Core API routes
router.use('/conversations', conversationRoutes);
router.use('/models', modelsRoutes);
router.use('/memory', memoryRoutes);
router.use('/plugins', pluginsRoutes);
router.use('/data', dataRoutes);
router.use('/files', filesRoutes);
router.use('/users', usersRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/templates', templateRoutes);
router.use('/hover-eagleview', hoverEagleViewRoutes);
router.use('/predictive-analytics', predictiveAnalyticsRoutes);
router.use('/legal-compliance', legalComplianceRoutes);
router.use('/legal-precedents', legalPrecedentRoutes);
router.use('/integrations', integrationRoutes);
router.use('/weather', weatherRoutes);
router.use('/manufacturer-database', manufacturerDatabaseRoutes);
router.use('/ocr', documentOCRRoutes);
router.use('/claim-ocr', claimOCRIntegrationRoutes);
router.use('/training', trainingRoutes);
router.use('/anythingllm', anythingLLMRoutes);

// Enterprise and RBAC routes (role-based authorization)
router.use('/enterprise', enterpriseUserRoutes);
router.use('/rbac', rbacRoutes);

// Admin routes (additional authorization required)
router.use('/admin', adminRoutes);

// Error handling middleware (must be last)
router.use(errorHandler);

export default router;