import express from 'express';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

const router = express.Router();

// Import integration services
let crmService, calendarService, emailService, apiFramework;

// Initialize services
const initializeServices = async () => {
  try {
    const { CRMIntegrationService } = await import('../services/CRMIntegrationService.js');
    const { CalendarIntegrationService } = await import('../services/CalendarIntegrationService.js');
    const { EmailIntegrationService } = await import('../services/EmailIntegrationService.js');
    const { APIIntegrationFramework } = await import('../services/APIIntegrationFramework.js');

    crmService = new CRMIntegrationService();
    calendarService = new CalendarIntegrationService();
    emailService = new EmailIntegrationService();
    apiFramework = new APIIntegrationFramework();

    logger.info('Integration services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize integration services', error);
  }
};

// Initialize services on startup
initializeServices();

// Middleware to ensure services are initialized
const ensureServicesInitialized = (req, res, next) => {
  if (!crmService || !calendarService || !emailService || !apiFramework) {
    return res.status(503).json({
      success: false,
      error: 'Integration services not initialized'
    });
  }
  next();
};

// Apply middleware to all routes
router.use(ensureServicesInitialized);

// ===================
// CRM INTEGRATION ROUTES
// ===================

// Get CRM integration status
router.get('/crm/status', async (req, res, next) => {
  try {
    const status = crmService.getIntegrationStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// Initiate CRM OAuth flow
router.post('/crm/:crmId/auth', async (req, res, next) => {
  try {
    const { crmId } = req.params;
    const { state } = req.body;
    
    const result = await crmService.initiateOAuthFlow(crmId, state);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Complete CRM OAuth flow
router.post('/crm/:crmId/auth/callback', async (req, res, next) => {
  try {
    const { crmId } = req.params;
    const { code, state } = req.body;
    
    const result = await crmService.exchangeCodeForToken(crmId, code, state);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Test CRM connection
router.get('/crm/:crmId/test', async (req, res, next) => {
  try {
    const { crmId } = req.params;
    const result = await crmService.testConnection(crmId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create contact in CRM
router.post('/crm/:crmId/contacts', async (req, res, next) => {
  try {
    const { crmId } = req.params;
    const contactData = req.body;
    
    const result = await crmService.createContact(crmId, contactData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update contact in CRM
router.put('/crm/:crmId/contacts/:contactId', async (req, res, next) => {
  try {
    const { crmId, contactId } = req.params;
    const contactData = req.body;
    
    const result = await crmService.updateContact(crmId, contactId, contactData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get contact from CRM
router.get('/crm/:crmId/contacts/:contactId', async (req, res, next) => {
  try {
    const { crmId, contactId } = req.params;
    
    const result = await crmService.getContact(crmId, contactId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Search contacts in CRM
router.get('/crm/:crmId/contacts', async (req, res, next) => {
  try {
    const { crmId } = req.params;
    const searchCriteria = req.query;
    
    const result = await crmService.searchContacts(crmId, searchCriteria);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create company in CRM
router.post('/crm/:crmId/companies', async (req, res, next) => {
  try {
    const { crmId } = req.params;
    const companyData = req.body;
    
    const result = await crmService.createCompany(crmId, companyData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// CRM webhook handler
router.post('/crm/:crmId/webhook', async (req, res, next) => {
  try {
    const { crmId } = req.params;
    const webhookData = req.body;
    
    const handler = crmService.webhookHandlers.get(crmId);
    if (!handler) {
      throw new ApiError(`No webhook handler for CRM ${crmId}`, 404);
    }
    
    const result = await handler(webhookData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get CRM audit logs
router.get('/crm/audit', async (req, res, next) => {
  try {
    const { limit } = req.query;
    const logs = crmService.getAuditLogs(limit ? parseInt(limit) : undefined);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// ===================
// CALENDAR INTEGRATION ROUTES
// ===================

// Get calendar integration status
router.get('/calendar/status', async (req, res, next) => {
  try {
    const status = calendarService.getCalendarStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// Initiate calendar OAuth flow
router.post('/calendar/:calendarId/auth', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const { state } = req.body;
    
    const result = await calendarService.initiateOAuthFlow(calendarId, state);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Complete calendar OAuth flow
router.post('/calendar/:calendarId/auth/callback', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const { code, state } = req.body;
    
    const result = await calendarService.exchangeCodeForToken(calendarId, code, state);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Test calendar connection
router.get('/calendar/:calendarId/test', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const result = await calendarService.testConnection(calendarId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// List calendars
router.get('/calendar/:calendarId/calendars', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    
    const result = await calendarService.listCalendars(calendarId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create calendar event
router.post('/calendar/:calendarId/events', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const { targetCalendarId } = req.query;
    const eventData = req.body;
    
    const result = await calendarService.createEvent(calendarId, eventData, targetCalendarId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update calendar event
router.put('/calendar/:calendarId/events/:eventId', async (req, res, next) => {
  try {
    const { calendarId, eventId } = req.params;
    const { targetCalendarId } = req.query;
    const eventData = req.body;
    
    const result = await calendarService.updateEvent(calendarId, eventId, eventData, targetCalendarId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get calendar event
router.get('/calendar/:calendarId/events/:eventId', async (req, res, next) => {
  try {
    const { calendarId, eventId } = req.params;
    const { targetCalendarId } = req.query;
    
    const result = await calendarService.getEvent(calendarId, eventId, targetCalendarId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// List calendar events
router.get('/calendar/:calendarId/events', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const { targetCalendarId, startTime, endTime, maxResults, query } = req.query;
    
    const options = {
      startTime,
      endTime,
      maxResults: maxResults ? parseInt(maxResults) : undefined,
      query
    };
    
    const result = await calendarService.listEvents(calendarId, options, targetCalendarId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Delete calendar event
router.delete('/calendar/:calendarId/events/:eventId', async (req, res, next) => {
  try {
    const { calendarId, eventId } = req.params;
    const { targetCalendarId } = req.query;
    
    const result = await calendarService.deleteEvent(calendarId, eventId, targetCalendarId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Find available time slots
router.post('/calendar/:calendarId/slots', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const options = req.body;
    
    const result = await calendarService.findAvailableSlots(calendarId, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Auto-schedule event
router.post('/calendar/:calendarId/schedule', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const eventData = req.body.eventData;
    const options = req.body.options || {};
    
    const result = await calendarService.scheduleEvent(calendarId, eventData, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get busy times
router.post('/calendar/:calendarId/busy', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const options = req.body;
    
    const result = await calendarService.getBusyTimes(calendarId, options);
    res.json({
      success: true,
      data: result,
      calendarId
    });
  } catch (error) {
    next(error);
  }
});

// Calendar webhook handler
router.post('/calendar/:calendarId/webhook', async (req, res, next) => {
  try {
    const { calendarId } = req.params;
    const webhookData = req.body;
    
    const handler = calendarService.webhookHandlers.get(calendarId);
    if (!handler) {
      throw new ApiError(`No webhook handler for calendar ${calendarId}`, 404);
    }
    
    const result = await handler(webhookData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get/Set scheduling rules
router.get('/calendar/rules/:rulesId?', async (req, res, next) => {
  try {
    const { rulesId } = req.params;
    const rules = calendarService.getSchedulingRules(rulesId);
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    next(error);
  }
});

router.put('/calendar/rules/:rulesId', async (req, res, next) => {
  try {
    const { rulesId } = req.params;
    const rules = req.body;
    
    calendarService.setSchedulingRules(rulesId, rules);
    res.json({
      success: true,
      rulesId
    });
  } catch (error) {
    next(error);
  }
});

// Get calendar audit logs
router.get('/calendar/audit', async (req, res, next) => {
  try {
    const { limit } = req.query;
    const logs = calendarService.getAuditLogs(limit ? parseInt(limit) : undefined);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// ===================
// EMAIL INTEGRATION ROUTES
// ===================

// Get email provider status
router.get('/email/status', async (req, res, next) => {
  try {
    const status = emailService.getProviderStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// Initiate email OAuth flow
router.post('/email/:providerId/auth', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { state } = req.body;
    
    const result = await emailService.initiateOAuthFlow(providerId, state);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Complete email OAuth flow
router.post('/email/:providerId/auth/callback', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { code, state } = req.body;
    
    const result = await emailService.exchangeCodeForToken(providerId, code, state);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Test email connection
router.get('/email/:providerId/test', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const result = await emailService.testConnection(providerId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Send email
router.post('/email/:providerId/send', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const emailData = req.body.emailData;
    const options = req.body.options || {};
    
    const result = await emailService.sendEmail(providerId, emailData, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Send template email
router.post('/email/:providerId/send-template', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { templateId, variables, recipients, options = {} } = req.body;
    
    const result = await emailService.sendTemplateEmail(providerId, templateId, variables, recipients, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Email template management
router.get('/email/templates', async (req, res, next) => {
  try {
    const templates = emailService.listTemplates();
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    next(error);
  }
});

router.post('/email/templates', async (req, res, next) => {
  try {
    const templateData = req.body;
    const result = emailService.createTemplate(templateData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/email/templates/:templateId', async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const templateData = req.body;
    
    const result = emailService.updateTemplate(templateId, templateData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/email/templates/:templateId', async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const result = emailService.deleteTemplate(templateId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Render template
router.post('/email/templates/:templateId/render', async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const variables = req.body;
    
    const result = await emailService.renderTemplate(templateId, variables);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Email tracking
router.get('/email/tracking/:trackingId', async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    const tracking = emailService.getEmailTracking(trackingId);
    res.json({
      success: true,
      data: tracking
    });
  } catch (error) {
    next(error);
  }
});

// Email webhook handlers
router.post('/email/:providerId/webhook', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const webhookData = req.body;
    
    const handler = emailService.webhookHandlers.get(providerId);
    if (!handler) {
      throw new ApiError(`No webhook handler for email provider ${providerId}`, 404);
    }
    
    const result = await handler(webhookData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get email audit logs
router.get('/email/audit', async (req, res, next) => {
  try {
    const { limit } = req.query;
    const logs = emailService.getAuditLogs(limit ? parseInt(limit) : undefined);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// ===================
// API INTEGRATION FRAMEWORK ROUTES
// ===================

// List all integrations
router.get('/api', async (req, res, next) => {
  try {
    const integrations = apiFramework.listIntegrations();
    res.json({
      success: true,
      data: integrations
    });
  } catch (error) {
    next(error);
  }
});

// Register new integration
router.post('/api', async (req, res, next) => {
  try {
    const { integrationId, config } = req.body;
    const result = await apiFramework.registerIntegration(integrationId, config);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get integration details
router.get('/api/:integrationId', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const integration = apiFramework.getIntegration(integrationId);
    res.json({
      success: true,
      data: integration
    });
  } catch (error) {
    next(error);
  }
});

// Update integration
router.put('/api/:integrationId', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const updates = req.body;
    
    const result = await apiFramework.updateIntegration(integrationId, updates);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Remove integration
router.delete('/api/:integrationId', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const result = await apiFramework.removeIntegration(integrationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Enable/disable integration
router.post('/api/:integrationId/enable', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const result = await apiFramework.enableIntegration(integrationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/api/:integrationId/disable', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const result = await apiFramework.disableIntegration(integrationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Test integration connection
router.get('/api/:integrationId/test', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const result = await apiFramework.testConnection(integrationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Make API requests
router.get('/api/:integrationId/request', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const { url, ...params } = req.query;
    
    const result = await apiFramework.get(integrationId, url, params);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/api/:integrationId/request', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const { method = 'POST', url, data, options = {} } = req.body;
    
    let result;
    switch (method.toUpperCase()) {
      case 'GET':
        result = await apiFramework.get(integrationId, url, data, options);
        break;
      case 'POST':
        result = await apiFramework.post(integrationId, url, data, options);
        break;
      case 'PUT':
        result = await apiFramework.put(integrationId, url, data, options);
        break;
      case 'PATCH':
        result = await apiFramework.patch(integrationId, url, data, options);
        break;
      case 'DELETE':
        result = await apiFramework.delete(integrationId, url, options);
        break;
      default:
        throw new ApiError(`Unsupported method: ${method}`, 400);
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GraphQL requests
router.post('/api/:integrationId/graphql', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const { query, mutation, variables = {} } = req.body;
    
    let result;
    if (query) {
      result = await apiFramework.graphqlQuery(integrationId, query, variables);
    } else if (mutation) {
      result = await apiFramework.graphqlMutation(integrationId, mutation, variables);
    } else {
      throw new ApiError('Either query or mutation is required for GraphQL requests', 400);
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Webhook handler
router.post('/api/:integrationId/webhook', async (req, res, next) => {
  try {
    const { integrationId } = req.params;
    const data = req.body;
    const headers = req.headers;
    
    const result = await apiFramework.handleWebhook(integrationId, data, headers);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get integration status
router.get('/api/status', async (req, res, next) => {
  try {
    const status = apiFramework.getIntegrationStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// Get metrics
router.get('/api/metrics', async (req, res, next) => {
  try {
    const metrics = apiFramework.getMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

// Get audit logs
router.get('/api/audit', async (req, res, next) => {
  try {
    const { limit } = req.query;
    const logs = apiFramework.getAuditLogs(limit ? parseInt(limit) : undefined);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// Get available auth types and protocols
router.get('/api/config/auth-types', async (req, res, next) => {
  try {
    const authTypes = apiFramework.getAuthTypes();
    res.json({
      success: true,
      data: authTypes
    });
  } catch (error) {
    next(error);
  }
});

router.get('/api/config/protocols', async (req, res, next) => {
  try {
    const protocols = apiFramework.getProtocolTypes();
    res.json({
      success: true,
      data: protocols
    });
  } catch (error) {
    next(error);
  }
});

router.get('/api/config/defaults', async (req, res, next) => {
  try {
    const defaults = apiFramework.getDefaultConfig();
    res.json({
      success: true,
      data: defaults
    });
  } catch (error) {
    next(error);
  }
});

// ===================
// GENERAL INTEGRATION ROUTES
// ===================

// Get all integration services status
router.get('/status', async (req, res, next) => {
  try {
    const status = {
      crm: crmService.getIntegrationStatus(),
      calendar: calendarService.getCalendarStatus(),
      email: emailService.getProviderStatus(),
      api: apiFramework.getIntegrationStatus(),
      timestamp: new Date()
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// Get available integrations
router.get('/available', async (req, res, next) => {
  try {
    const available = {
      crm: crmService.integrations ? Array.from(crmService.integrations.keys()) : [],
      calendar: calendarService.getAvailableCalendars(),
      email: emailService.getAvailableProviders(),
      api: apiFramework.listIntegrations()
    };
    
    res.json({
      success: true,
      data: available
    });
  } catch (error) {
    next(error);
  }
});

// Consolidated audit logs
router.get('/audit', async (req, res, next) => {
  try {
    const { limit = 50, service } = req.query;
    const parsedLimit = parseInt(limit);
    
    let logs = [];
    
    if (!service || service === 'crm') {
      const crmLogs = crmService.getAuditLogs(parsedLimit).map(log => ({
        ...log,
        service: 'crm'
      }));
      logs.push(...crmLogs);
    }
    
    if (!service || service === 'calendar') {
      const calendarLogs = calendarService.getAuditLogs(parsedLimit).map(log => ({
        ...log,
        service: 'calendar'
      }));
      logs.push(...calendarLogs);
    }
    
    if (!service || service === 'email') {
      const emailLogs = emailService.getAuditLogs(parsedLimit).map(log => ({
        ...log,
        service: 'email'
      }));
      logs.push(...emailLogs);
    }
    
    if (!service || service === 'api') {
      const apiLogs = apiFramework.getAuditLogs(parsedLimit).map(log => ({
        ...log,
        service: 'api'
      }));
      logs.push(...apiLogs);
    }
    
    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit results
    if (logs.length > parsedLimit) {
      logs = logs.slice(0, parsedLimit);
    }
    
    res.json({
      success: true,
      data: logs,
      total: logs.length
    });
  } catch (error) {
    next(error);
  }
});

// Health check endpoint
router.get('/health', async (req, res, next) => {
  try {
    const health = {
      status: 'healthy',
      services: {
        crm: !!crmService,
        calendar: !!calendarService,
        email: !!emailService,
        api: !!apiFramework
      },
      timestamp: new Date()
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    next(error);
  }
});

export default router;