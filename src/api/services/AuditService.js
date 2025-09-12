import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AuditService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/audit');
    this.logsDir = path.join(this.dataDir, 'logs');
    this.reportsDir = path.join(this.dataDir, 'reports');
    this.configDir = path.join(this.dataDir, 'config');
    
    // In-memory audit log buffer for real-time processing
    this.auditBuffer = [];
    this.auditConfigs = new Map();
    this.retentionPolicies = new Map();
    this.complianceRules = new Map();
    
    // Audit event categories
    this.eventCategories = {
      AUTHENTICATION: 'authentication',
      AUTHORIZATION: 'authorization',
      DATA_ACCESS: 'data_access',
      DATA_MODIFICATION: 'data_modification',
      CONFIGURATION: 'configuration',
      ADMINISTRATION: 'administration',
      SECURITY: 'security',
      COMPLIANCE: 'compliance',
      SYSTEM: 'system',
      USER_ACTIVITY: 'user_activity',
      API_ACCESS: 'api_access',
      FILE_ACCESS: 'file_access'
    };

    // Risk levels
    this.riskLevels = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
      INFO: 'info'
    };

    // Compliance frameworks
    this.complianceFrameworks = {
      SOX: 'sox',
      GDPR: 'gdpr',
      HIPAA: 'hipaa',
      SOC2: 'soc2',
      ISO27001: 'iso27001',
      PCI_DSS: 'pci_dss'
    };

    this.ensureDirectories();
    this.setupDefaultConfigurations();
    this.setupEventProcessing();
    this.setupRetentionManagement();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.logsDir);
    await fs.ensureDir(this.reportsDir);
    await fs.ensureDir(this.configDir);
  }

  /**
   * Log an audit event
   */
  async logEvent(eventData, options = {}) {
    const {
      category,
      action,
      resource,
      userId,
      tenantId,
      outcome = 'success',
      riskLevel = 'info',
      metadata = {},
      request = {},
      sensitive = false,
      compliance = []
    } = eventData;

    const {
      immediate = false,
      encrypt = false,
      signature = false
    } = options;

    try {
      const eventId = this.generateEventId();
      const timestamp = new Date();

      // Validate event data
      this.validateEventData(eventData);

      // Create audit log entry
      const auditEntry = {
        id: eventId,
        timestamp,
        category,
        action,
        resource,
        userId,
        tenantId,
        outcome,
        riskLevel,
        metadata: {
          ...metadata,
          eventVersion: '1.0',
          auditVersion: '2.0',
          source: 'susan-ai-api'
        },
        request: {
          method: request.method,
          endpoint: request.endpoint,
          userAgent: request.userAgent,
          ipAddress: request.ipAddress,
          correlationId: request.correlationId,
          sessionId: request.sessionId,
          ...this.sanitizeRequestData(request, sensitive)
        },
        response: {
          statusCode: request.responseStatus,
          processingTime: request.processingTime,
          size: request.responseSize
        },
        security: {
          sensitive,
          encrypted: encrypt,
          signed: signature,
          integrity: null, // Will be calculated
          classification: this.classifyEvent(category, riskLevel, sensitive)
        },
        compliance: {
          frameworks: compliance,
          retention: this.calculateRetentionPeriod(category, compliance),
          tags: this.generateComplianceTags(category, compliance)
        }
      };

      // Add digital signature if required
      if (signature) {
        auditEntry.security.signature = await this.signAuditEntry(auditEntry);
      }

      // Calculate integrity hash
      auditEntry.security.integrity = this.calculateIntegrityHash(auditEntry);

      // Encrypt sensitive data if required
      if (encrypt && sensitive) {
        auditEntry.encryptedData = await this.encryptSensitiveData(auditEntry, metadata);
      }

      // Process event through compliance rules
      await this.processComplianceRules(auditEntry);

      // Add to buffer or process immediately
      if (immediate) {
        await this.processAuditEntry(auditEntry);
      } else {
        this.auditBuffer.push(auditEntry);
      }

      // Emit event for real-time monitoring
      this.emit('audit:logged', { eventId, auditEntry });

      // Check for security alerts
      await this.checkSecurityAlerts(auditEntry);

      logger.debug('Audit event logged', {
        eventId,
        category,
        action,
        userId,
        tenantId,
        riskLevel
      });

      return eventId;

    } catch (error) {
      logger.error('Failed to log audit event', {
        category,
        action,
        userId,
        tenantId,
        error: error.message
      });

      // Log the audit logging failure (meta-audit)
      await this.logMetaAuditEvent('audit_logging_failed', error, eventData);
      
      throw error;
    }
  }

  /**
   * Query audit logs with filtering and search
   */
  async queryAuditLogs(query, options = {}) {
    const {
      tenantId,
      userId,
      category,
      action,
      resource,
      outcome,
      riskLevel,
      startDate,
      endDate,
      ipAddress,
      userAgent,
      compliance = []
    } = query;

    const {
      limit = 100,
      offset = 0,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      includeMetadata = true,
      decrypt = false
    } = options;

    try {
      const searchCriteria = {
        tenantId,
        userId,
        category,
        action,
        resource,
        outcome,
        riskLevel,
        dateRange: startDate && endDate ? { start: startDate, end: endDate } : null,
        ipAddress,
        userAgent,
        compliance
      };

      // Search audit logs
      const results = await this.searchAuditLogs(searchCriteria, {
        limit,
        offset,
        sortBy,
        sortOrder
      });

      // Decrypt sensitive data if authorized
      if (decrypt) {
        results.entries = await this.decryptAuditEntries(results.entries);
      }

      // Remove sensitive metadata if not authorized
      if (!includeMetadata) {
        results.entries = results.entries.map(entry => this.sanitizeAuditEntry(entry));
      }

      logger.info('Audit logs queried', {
        criteria: searchCriteria,
        resultsCount: results.entries.length,
        totalCount: results.total
      });

      // Log the audit query itself
      await this.logEvent({
        category: this.eventCategories.DATA_ACCESS,
        action: 'audit_logs_queried',
        resource: 'audit_logs',
        userId: options.requestedBy,
        tenantId,
        riskLevel: this.riskLevels.MEDIUM,
        metadata: {
          searchCriteria,
          resultsCount: results.entries.length
        }
      });

      return results;

    } catch (error) {
      logger.error('Failed to query audit logs', {
        query,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(options = {}) {
    const {
      tenantId,
      framework,
      startDate,
      endDate,
      includeRecommendations = true,
      format = 'json'
    } = options;

    try {
      const reportId = this.generateReportId();
      const generatedAt = new Date();

      // Query relevant audit events for the timeframe
      const auditData = await this.queryAuditLogs({
        tenantId,
        startDate,
        endDate,
        compliance: framework ? [framework] : []
      }, { limit: 10000 });

      // Generate compliance analysis
      const analysis = await this.analyzeComplianceData(auditData.entries, framework);

      // Generate recommendations if requested
      let recommendations = [];
      if (includeRecommendations) {
        recommendations = await this.generateComplianceRecommendations(analysis, framework);
      }

      const report = {
        id: reportId,
        type: 'compliance',
        framework,
        tenantId,
        period: { startDate, endDate },
        generatedAt,
        summary: {
          totalEvents: auditData.total,
          criticalEvents: analysis.criticalEvents,
          complianceScore: analysis.complianceScore,
          riskScore: analysis.riskScore
        },
        analysis,
        recommendations,
        metadata: {
          version: '1.0',
          generator: 'susan-ai-audit-service',
          processingTime: Date.now() - generatedAt.getTime()
        }
      };

      // Save report
      await this.saveComplianceReport(report, format);

      // Log report generation
      await this.logEvent({
        category: this.eventCategories.COMPLIANCE,
        action: 'compliance_report_generated',
        resource: 'compliance_report',
        userId: options.requestedBy,
        tenantId,
        riskLevel: this.riskLevels.LOW,
        metadata: {
          reportId,
          framework,
          period: { startDate, endDate },
          eventsAnalyzed: auditData.total
        }
      });

      logger.info('Compliance report generated', {
        reportId,
        framework,
        tenantId,
        eventsAnalyzed: auditData.total,
        complianceScore: analysis.complianceScore
      });

      return report;

    } catch (error) {
      logger.error('Failed to generate compliance report', {
        framework,
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Configure audit settings for tenant
   */
  async configureTenantAudit(tenantId, configuration, options = {}) {
    const {
      enabled = true,
      categories = Object.values(this.eventCategories),
      retentionPeriod = 2555, // 7 years in days
      encryption = false,
      signing = false,
      realTimeMonitoring = true,
      complianceFrameworks = [],
      customRules = [],
      alerting = {}
    } = configuration;

    const { userId } = options;

    try {
      const configId = this.generateConfigId();
      
      const auditConfig = {
        id: configId,
        tenantId,
        enabled,
        categories,
        retentionPeriod,
        security: {
          encryption,
          signing,
          integrityChecking: true
        },
        monitoring: {
          realTime: realTimeMonitoring,
          alerting,
          dashboards: true
        },
        compliance: {
          frameworks: complianceFrameworks,
          customRules,
          automatedReporting: true
        },
        metadata: {
          createdAt: new Date(),
          createdBy: userId,
          lastUpdated: new Date(),
          version: '1.0'
        }
      };

      this.auditConfigs.set(tenantId, auditConfig);

      // Set up retention policy
      await this.setupRetentionPolicy(tenantId, retentionPeriod);

      // Configure compliance rules
      if (complianceFrameworks.length > 0) {
        await this.setupComplianceRules(tenantId, complianceFrameworks, customRules);
      }

      // Save configuration
      await this.saveAuditConfiguration(auditConfig);

      // Log configuration change
      await this.logEvent({
        category: this.eventCategories.CONFIGURATION,
        action: 'audit_configuration_updated',
        resource: 'audit_configuration',
        userId,
        tenantId,
        riskLevel: this.riskLevels.MEDIUM,
        metadata: {
          configId,
          changes: configuration
        }
      });

      logger.info('Audit configuration updated', {
        configId,
        tenantId,
        updatedBy: userId,
        frameworks: complianceFrameworks
      });

      return { configId, status: 'configured' };

    } catch (error) {
      logger.error('Failed to configure tenant audit', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Export audit logs for external analysis
   */
  async exportAuditLogs(query, options = {}) {
    const {
      format = 'json', // json, csv, syslog
      encryption = false,
      compression = true,
      includeIntegrityProof = true,
      destination = 'local'
    } = options;

    try {
      const exportId = this.generateExportId();
      const startTime = Date.now();

      // Query audit logs
      const auditData = await this.queryAuditLogs(query, {
        limit: 50000, // Large export limit
        includeMetadata: true,
        decrypt: false // Keep encrypted for export
      });

      // Format data for export
      let exportData;
      switch (format) {
        case 'json':
          exportData = this.formatAsJSON(auditData.entries);
          break;
        case 'csv':
          exportData = this.formatAsCSV(auditData.entries);
          break;
        case 'syslog':
          exportData = this.formatAsSyslog(auditData.entries);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Add integrity proof if requested
      if (includeIntegrityProof) {
        const integrityProof = await this.generateIntegrityProof(auditData.entries);
        exportData = this.addIntegrityProof(exportData, integrityProof, format);
      }

      // Compress if requested
      if (compression) {
        exportData = await this.compressData(exportData);
      }

      // Encrypt if requested
      if (encryption) {
        exportData = await this.encryptExportData(exportData);
      }

      // Save export file
      const exportFile = await this.saveExportFile(exportId, exportData, format, {
        compression,
        encryption
      });

      const processingTime = Date.now() - startTime;

      // Log export operation
      await this.logEvent({
        category: this.eventCategories.DATA_ACCESS,
        action: 'audit_logs_exported',
        resource: 'audit_logs',
        userId: options.requestedBy,
        tenantId: query.tenantId,
        riskLevel: this.riskLevels.HIGH,
        metadata: {
          exportId,
          format,
          recordCount: auditData.entries.length,
          fileSize: exportData.length,
          encryption,
          compression,
          processingTime
        }
      });

      logger.info('Audit logs exported', {
        exportId,
        format,
        recordCount: auditData.entries.length,
        processingTime
      });

      return {
        exportId,
        filename: exportFile,
        recordCount: auditData.entries.length,
        format,
        encryption,
        compression,
        processingTime
      };

    } catch (error) {
      logger.error('Failed to export audit logs', {
        query,
        format,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods

  validateEventData(eventData) {
    const required = ['category', 'action', 'resource'];
    
    for (const field of required) {
      if (!eventData[field]) {
        throw new Error(`Required audit field missing: ${field}`);
      }
    }

    if (!Object.values(this.eventCategories).includes(eventData.category)) {
      throw new Error(`Invalid event category: ${eventData.category}`);
    }

    if (!Object.values(this.riskLevels).includes(eventData.riskLevel)) {
      throw new Error(`Invalid risk level: ${eventData.riskLevel}`);
    }
  }

  sanitizeRequestData(request, sensitive = false) {
    if (!sensitive) {
      return {
        headers: request.headers ? this.sanitizeHeaders(request.headers) : {},
        parameters: request.parameters || {},
        body: request.body ? '[BODY_PRESENT]' : null
      };
    }

    // For sensitive requests, remove all potentially sensitive data
    return {
      headers: request.headers ? '[HEADERS_REDACTED]' : null,
      parameters: '[PARAMETERS_REDACTED]',
      body: '[BODY_REDACTED]'
    };
  }

  sanitizeHeaders(headers) {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized = { ...headers };
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header.toLowerCase()]) {
        sanitized[header.toLowerCase()] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  classifyEvent(category, riskLevel, sensitive) {
    if (sensitive || riskLevel === 'critical') {
      return 'confidential';
    } else if (riskLevel === 'high') {
      return 'restricted';
    } else if (category === this.eventCategories.ADMINISTRATION) {
      return 'internal';
    } else {
      return 'public';
    }
  }

  calculateRetentionPeriod(category, compliance) {
    let maxRetention = 2555; // Default: 7 years

    // Compliance framework requirements
    if (compliance.includes(this.complianceFrameworks.SOX)) {
      maxRetention = Math.max(maxRetention, 2555); // 7 years for SOX
    }
    if (compliance.includes(this.complianceFrameworks.HIPAA)) {
      maxRetention = Math.max(maxRetention, 2190); // 6 years for HIPAA
    }
    if (compliance.includes(this.complianceFrameworks.GDPR)) {
      maxRetention = Math.max(maxRetention, 1095); // 3 years for GDPR (with exceptions)
    }

    return maxRetention;
  }

  generateComplianceTags(category, compliance) {
    const tags = [category];
    
    // Add compliance-specific tags
    compliance.forEach(framework => {
      switch (framework) {
        case this.complianceFrameworks.SOX:
          tags.push('financial_reporting', 'internal_controls');
          break;
        case this.complianceFrameworks.GDPR:
          tags.push('data_protection', 'privacy');
          break;
        case this.complianceFrameworks.HIPAA:
          tags.push('healthcare', 'phi');
          break;
        case this.complianceFrameworks.SOC2:
          tags.push('security', 'availability', 'confidentiality');
          break;
      }
    });

    return tags;
  }

  async signAuditEntry(auditEntry) {
    // Generate digital signature for audit entry
    const data = JSON.stringify({
      id: auditEntry.id,
      timestamp: auditEntry.timestamp,
      category: auditEntry.category,
      action: auditEntry.action,
      userId: auditEntry.userId,
      tenantId: auditEntry.tenantId
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  calculateIntegrityHash(auditEntry) {
    // Calculate hash for integrity verification
    const data = JSON.stringify(auditEntry, Object.keys(auditEntry).sort());
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async encryptSensitiveData(auditEntry, sensitiveData) {
    // Encrypt sensitive portions of audit data
    const algorithm = 'aes-256-gcm';
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(sensitiveData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      algorithm,
      encrypted,
      key: key.toString('hex'),
      iv: iv.toString('hex')
    };
  }

  async processComplianceRules(auditEntry) {
    // Process audit entry through compliance rules
    const rules = this.complianceRules.get(auditEntry.tenantId) || [];
    
    for (const rule of rules) {
      if (this.matchesRule(auditEntry, rule)) {
        await this.applyComplianceRule(auditEntry, rule);
      }
    }
  }

  matchesRule(auditEntry, rule) {
    // Check if audit entry matches compliance rule criteria
    if (rule.category && rule.category !== auditEntry.category) return false;
    if (rule.action && rule.action !== auditEntry.action) return false;
    if (rule.riskLevel && rule.riskLevel !== auditEntry.riskLevel) return false;
    
    return true;
  }

  async applyComplianceRule(auditEntry, rule) {
    // Apply compliance rule actions
    switch (rule.action) {
      case 'alert':
        await this.sendComplianceAlert(auditEntry, rule);
        break;
      case 'escalate':
        await this.escalateEvent(auditEntry, rule);
        break;
      case 'block':
        await this.blockResource(auditEntry, rule);
        break;
    }
  }

  async checkSecurityAlerts(auditEntry) {
    // Check for security-related alerts
    if (auditEntry.riskLevel === this.riskLevels.CRITICAL) {
      await this.sendSecurityAlert(auditEntry);
    }

    // Check for suspicious patterns
    await this.checkSuspiciousPatterns(auditEntry);
  }

  async logMetaAuditEvent(action, error, originalEvent) {
    // Log audit system events (meta-audit)
    try {
      const metaEvent = {
        category: this.eventCategories.SYSTEM,
        action,
        resource: 'audit_system',
        userId: 'system',
        tenantId: originalEvent.tenantId,
        outcome: 'failure',
        riskLevel: this.riskLevels.HIGH,
        metadata: {
          error: error.message,
          originalEvent: originalEvent.category + ':' + originalEvent.action
        }
      };

      // Process immediately to avoid recursion
      await this.processAuditEntry(metaEvent);

    } catch (metaError) {
      // Last resort: log to system logger
      logger.error('Meta-audit logging failed', {
        action,
        error: error.message,
        metaError: metaError.message
      });
    }
  }

  setupEventProcessing() {
    // Process audit buffer every 30 seconds
    setInterval(() => {
      this.flushAuditBuffer();
    }, 30000);

    // Process compliance checks every 5 minutes
    setInterval(() => {
      this.processComplianceChecks();
    }, 5 * 60 * 1000);
  }

  async flushAuditBuffer() {
    if (this.auditBuffer.length === 0) return;

    try {
      const entries = [...this.auditBuffer];
      this.auditBuffer = [];

      // Process all buffered entries
      await Promise.all(entries.map(entry => this.processAuditEntry(entry)));

      logger.debug('Audit buffer flushed', {
        entriesProcessed: entries.length
      });

    } catch (error) {
      logger.error('Failed to flush audit buffer', {
        bufferSize: this.auditBuffer.length,
        error: error.message
      });
    }
  }

  async processAuditEntry(auditEntry) {
    // Save audit entry to persistent storage
    await this.saveAuditEntry(auditEntry);

    // Index for searching
    await this.indexAuditEntry(auditEntry);

    // Emit for real-time monitoring
    this.emit('audit:processed', auditEntry);
  }

  async saveAuditEntry(auditEntry) {
    // Save to daily log file
    const date = auditEntry.timestamp.toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `audit-${date}.json`);
    
    // Append to log file
    const logLine = JSON.stringify(auditEntry) + '\n';
    await fs.appendFile(logFile, logLine);
  }

  setupDefaultConfigurations() {
    // Set up default compliance rules for common frameworks
    this.setupDefaultSOXRules();
    this.setupDefaultGDPRRules();
    this.setupDefaultHIPAARules();
  }

  setupDefaultSOXRules() {
    // SOX compliance rules for financial reporting
    const soxRules = [
      {
        name: 'Financial Data Access',
        category: this.eventCategories.DATA_ACCESS,
        resource: 'financial_data',
        action: 'alert',
        retention: 2555 // 7 years
      }
    ];
    
    this.complianceRules.set('sox_default', soxRules);
  }

  setupRetentionManagement() {
    // Clean up old audit logs based on retention policies
    setInterval(() => {
      this.cleanupExpiredLogs();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  async cleanupExpiredLogs() {
    // Implementation would remove logs older than retention period
    logger.info('Audit log cleanup completed');
  }

  // ID generators
  generateEventId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateConfigId() {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateExportId() {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getTenantAuditConfig(tenantId) {
    return this.auditConfigs.get(tenantId);
  }

  getAuditStats() {
    return {
      bufferSize: this.auditBuffer.length,
      configurationsCount: this.auditConfigs.size,
      retentionPolicies: this.retentionPolicies.size,
      complianceRules: this.complianceRules.size,
      supportedFrameworks: Object.values(this.complianceFrameworks)
    };
  }

  async validateIntegrity(auditEntry) {
    // Validate audit entry integrity
    const calculatedHash = this.calculateIntegrityHash({
      ...auditEntry,
      security: { ...auditEntry.security, integrity: null }
    });

    return calculatedHash === auditEntry.security.integrity;
  }
}