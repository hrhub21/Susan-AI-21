import { LegalComplianceService } from './LegalComplianceService.js';
import { ClaimTrackingDashboardService } from './ClaimTrackingDashboardService.js';
import { DocumentProcessingService } from './DocumentProcessingService.js';
import { EventEmitter } from 'events';

/**
 * Integrated Compliance Service
 * Coordinates legal compliance checking with existing Susan AI services
 */
export class IntegratedComplianceService extends EventEmitter {
    constructor() {
        super();
        
        // Initialize core services
        this.legalComplianceService = new LegalComplianceService();
        this.claimTrackingService = new ClaimTrackingDashboardService();
        this.documentProcessingService = new DocumentProcessingService();
        
        // Integration state
        this.integrationActive = false;
        this.monitoredClaims = new Map();
        this.complianceOverrides = new Map();
        
        this.setupServiceIntegrations();
    }

    async initialize() {
        try {
            console.log('🔄 Initializing Integrated Compliance Service...');
            
            // Initialize all services
            await this.legalComplianceService.initialize();
            await this.claimTrackingService.initialize();
            
            // Setup event listeners for service integration
            this.setupEventListeners();
            
            this.integrationActive = true;
            console.log('✅ Integrated Compliance Service ready');
            
            this.emit('integrationReady', {
                timestamp: new Date().toISOString(),
                services: ['legal-compliance', 'claim-tracking', 'document-processing']
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Integrated Compliance Service:', error);
            throw error;
        }
    }

    /**
     * Setup integration between services
     */
    setupServiceIntegrations() {
        // Extend claim creation to include compliance checking
        const originalCreateClaim = this.claimTrackingService.createClaim.bind(this.claimTrackingService);
        this.claimTrackingService.createClaim = async (claimData) => {
            const result = await originalCreateClaim(claimData);
            
            // Automatically validate compliance for new claims
            await this.validateNewClaimCompliance(result.claim);
            
            return result;
        };

        // Extend communication addition to include compliance checking
        const originalAddCommunication = this.claimTrackingService.addCommunication.bind(this.claimTrackingService);
        this.claimTrackingService.addCommunication = async (claimId, communicationData) => {
            // Check compliance before adding communication
            const complianceCheck = await this.validateCommunicationCompliance(communicationData, claimId);
            
            if (complianceCheck.overallCompliance === 'non_compliant') {
                throw new Error(`Communication violates compliance standards: ${complianceCheck.violations[0]?.message}`);
            }
            
            const result = await originalAddCommunication(claimId, communicationData);
            
            // Log compliance event
            await this.logIntegratedComplianceEvent({
                type: 'communication_compliance_checked',
                entityId: claimId,
                entityType: 'claim',
                action: 'communication_added',
                details: { communicationId: result.communicationId, complianceCheck }
            });
            
            return result;
        };
    }

    setupEventListeners() {
        // Listen to claim events for compliance monitoring
        this.claimTrackingService.on('claimCreated', async (event) => {
            await this.handleClaimCreated(event);
        });

        this.claimTrackingService.on('statusUpdated', async (event) => {
            await this.handleClaimStatusUpdated(event);
        });

        this.claimTrackingService.on('communicationAdded', async (event) => {
            await this.handleCommunicationAdded(event);
        });

        // Listen to compliance events for claim updates
        this.legalComplianceService.on('complianceAlert', async (alert) => {
            await this.handleComplianceAlert(alert);
        });

        this.legalComplianceService.on('riskAssessed', async (assessment) => {
            await this.handleRiskAssessment(assessment);
        });
    }

    /**
     * Validate compliance for newly created claims
     */
    async validateNewClaimCompliance(claim) {
        try {
            const claimData = {
                claimId: claim.id,
                state: claim.property?.state || 'TX', // Default to Texas
                status: claim.status,
                timestamps: {
                    created: claim.created,
                    submitted: claim.tracking?.submissionDate,
                    acknowledged: null,
                    approved: null,
                    paid: null
                },
                documents: claim.documents || {},
                communications: claim.communications || []
            };

            const validationReport = await this.legalComplianceService.validateClaimCompliance(claimData);
            
            // Store compliance status with claim
            claim.compliance = {
                lastChecked: new Date().toISOString(),
                overallStatus: validationReport.overallCompliance,
                score: validationReport.complianceScore,
                violations: validationReport.violations.length,
                warnings: validationReport.warnings.length,
                riskLevel: this.determineClaimRiskLevel(validationReport)
            };

            // Start monitoring if high risk
            if (claim.compliance.riskLevel === 'high' || claim.compliance.riskLevel === 'critical') {
                await this.startClaimComplianceMonitoring(claim.id);
            }

            // Emit compliance validation event
            this.emit('claimComplianceValidated', {
                claimId: claim.id,
                validationReport,
                complianceStatus: claim.compliance
            });

            return validationReport;

        } catch (error) {
            console.error(`❌ Error validating compliance for claim ${claim.id}:`, error);
            throw error;
        }
    }

    /**
     * Validate communication compliance before adding to claim
     */
    async validateCommunicationCompliance(communicationData, claimId) {
        try {
            const claim = this.claimTrackingService.getClaim(claimId);
            if (!claim) {
                throw new Error(`Claim not found: ${claimId}`);
            }

            const complianceData = {
                content: communicationData.content || '',
                type: communicationData.type || 'email',
                state: claim.property?.state || 'TX',
                recipientInfo: {
                    type: 'insurance_company',
                    company: claim.insurance?.company
                },
                context: {
                    claimId: claimId,
                    claimType: claim.damage?.type,
                    claimStatus: claim.status,
                    claimValue: claim.financial?.estimatedValue
                }
            };

            const complianceReport = await this.legalComplianceService.checkCommunicationCompliance(complianceData);

            // Add compliance metadata to communication
            communicationData.compliance = {
                checked: true,
                checkDate: new Date().toISOString(),
                overallCompliance: complianceReport.overallCompliance,
                score: complianceReport.complianceScore,
                violations: complianceReport.violations.length,
                warnings: complianceReport.warnings.length,
                reportId: complianceReport.communicationId
            };

            return complianceReport;

        } catch (error) {
            console.error(`❌ Error validating communication compliance:`, error);
            throw error;
        }
    }

    /**
     * Enhanced claim creation with compliance integration
     */
    async createComplianceClaim(claimData) {
        try {
            // Pre-compliance validation
            const preValidation = await this.preValidateClaimData(claimData);
            if (preValidation.blockingIssues.length > 0) {
                throw new Error(`Claim creation blocked due to compliance issues: ${preValidation.blockingIssues[0].message}`);
            }

            // Create claim through tracking service
            const claimResult = await this.claimTrackingService.createClaim(claimData);

            // Enhanced compliance validation
            const complianceValidation = await this.validateNewClaimCompliance(claimResult.claim);

            // Risk assessment
            const riskAssessment = await this.legalComplianceService.assessComplianceRisk({
                entityId: claimResult.claimId,
                entityType: 'claim',
                data: claimResult.claim,
                context: {
                    state: claimResult.claim.property?.state,
                    claimType: claimResult.claim.damage?.type,
                    estimatedValue: claimResult.claim.financial?.estimatedValue
                }
            });

            // Generate compliance recommendations
            const recommendations = await this.generateClaimComplianceRecommendations(
                claimResult.claim, 
                complianceValidation, 
                riskAssessment
            );

            return {
                ...claimResult,
                compliance: {
                    validation: complianceValidation,
                    riskAssessment: riskAssessment,
                    recommendations: recommendations,
                    monitoringEnabled: this.monitoredClaims.has(claimResult.claimId)
                }
            };

        } catch (error) {
            console.error('❌ Error creating compliance claim:', error);
            throw error;
        }
    }

    /**
     * Process documents with compliance analysis
     */
    async processDocumentWithCompliance(documentData) {
        try {
            // Process document content
            const processingResult = await this.documentProcessingService.processDocument(documentData.filePath);

            // Analyze compliance
            const complianceAnalysis = await this.legalComplianceService.analyzeDocumentCompliance({
                documentId: documentData.documentId || this.generateDocumentId(),
                content: processingResult.content,
                type: documentData.type || 'general',
                state: documentData.state || 'TX',
                context: documentData.context || {}
            });

            // Create integrated result
            const integratedResult = {
                documentId: documentData.documentId,
                processing: processingResult,
                compliance: complianceAnalysis,
                recommendations: this.generateDocumentRecommendations(complianceAnalysis),
                riskLevel: this.assessDocumentRisk(complianceAnalysis),
                requiredActions: complianceAnalysis.violations.length > 0 ? 
                    this.generateDocumentActions(complianceAnalysis) : []
            };

            // Log integrated processing event
            await this.logIntegratedComplianceEvent({
                type: 'document_processed_with_compliance',
                entityId: documentData.documentId,
                entityType: 'document',
                action: 'processed_and_analyzed',
                details: integratedResult
            });

            return integratedResult;

        } catch (error) {
            console.error('❌ Error processing document with compliance:', error);
            throw error;
        }
    }

    /**
     * Start monitoring a claim for compliance
     */
    async startClaimComplianceMonitoring(claimId) {
        try {
            const claim = this.claimTrackingService.getClaim(claimId);
            if (!claim) {
                throw new Error(`Claim not found: ${claimId}`);
            }

            const monitoringConfig = {
                claimId: claimId,
                state: claim.property?.state || 'TX',
                claimType: claim.damage?.type || 'unknown',
                startedAt: new Date().toISOString(),
                checkFrequency: 'daily', // daily, hourly, real-time
                alertThresholds: {
                    timelineViolations: 'immediate',
                    communicationIssues: 'daily',
                    documentationGaps: 'weekly'
                },
                escalationRules: {
                    criticalViolations: 'immediate_alert',
                    highRiskPatterns: 'daily_summary',
                    complianceDecline: 'weekly_review'
                }
            };

            // Add to legal compliance monitoring
            await this.legalComplianceService.activeMonitoring.set(claimId, {
                entityType: 'claim',
                alertOnWarnings: true,
                integratedMonitoring: true,
                ...monitoringConfig
            });

            // Store monitoring config
            this.monitoredClaims.set(claimId, monitoringConfig);

            console.log(`🔍 Started compliance monitoring for claim: ${claimId}`);
            
            this.emit('monitoringStarted', { claimId, config: monitoringConfig });

            return monitoringConfig;

        } catch (error) {
            console.error(`❌ Error starting compliance monitoring for claim ${claimId}:`, error);
            throw error;
        }
    }

    /**
     * Event Handlers
     */
    async handleClaimCreated(event) {
        try {
            const { claimId, claim } = event;
            
            // Automatic compliance validation for new claims
            await this.validateNewClaimCompliance(claim);
            
            // Auto-start monitoring for high-value or high-risk claims
            const shouldMonitor = this.shouldAutoMonitorClaim(claim);
            if (shouldMonitor) {
                await this.startClaimComplianceMonitoring(claimId);
            }

        } catch (error) {
            console.error(`❌ Error handling claim created event:`, error);
        }
    }

    async handleClaimStatusUpdated(event) {
        try {
            const { claimId, previousStatus, newStatus, claim } = event;
            
            // Check if status change creates compliance obligations
            const complianceImpact = await this.assessStatusChangeCompliance(claim, previousStatus, newStatus);
            
            if (complianceImpact.newObligations.length > 0) {
                // Generate compliance alerts for new obligations
                await this.generateStatusChangeComplianceAlerts(claimId, complianceImpact);
            }

            // Update monitoring configuration if needed
            if (this.monitoredClaims.has(claimId)) {
                await this.updateMonitoringForStatusChange(claimId, newStatus);
            }

        } catch (error) {
            console.error(`❌ Error handling status update event:`, error);
        }
    }

    async handleCommunicationAdded(event) {
        try {
            const { claimId, communication, claim } = event;
            
            // Validate communication compliance (if not already done)
            if (!communication.compliance?.checked) {
                await this.validateCommunicationCompliance(communication, claimId);
            }

            // Check for compliance pattern updates
            await this.updateCompliancePatterns(claimId, communication);

        } catch (error) {
            console.error(`❌ Error handling communication added event:`, error);
        }
    }

    async handleComplianceAlert(alert) {
        try {
            // If alert is for a monitored claim, update claim tracking
            if (this.monitoredClaims.has(alert.entityId)) {
                const claim = this.claimTrackingService.getClaim(alert.entityId);
                if (claim) {
                    // Add compliance alert to claim communications
                    await this.claimTrackingService.addCommunication(alert.entityId, {
                        type: 'compliance_alert',
                        direction: 'internal',
                        subject: `Compliance Alert: ${alert.type}`,
                        content: this.formatComplianceAlertForClaim(alert),
                        importance: alert.severity,
                        tags: ['compliance', 'alert', alert.severity],
                        automated: true
                    });
                }
            }

        } catch (error) {
            console.error(`❌ Error handling compliance alert:`, error);
        }
    }

    /**
     * Utility Methods
     */
    shouldAutoMonitorClaim(claim) {
        // Auto-monitor high-value claims
        if (claim.financial?.estimatedValue > 50000) return true;
        
        // Auto-monitor critical priority claims
        if (claim.priority === 'critical' || claim.priority === 'urgent') return true;
        
        // Auto-monitor claims in high-regulation states
        const highRegStates = ['CA', 'NY', 'FL', 'TX'];
        if (highRegStates.includes(claim.property?.state)) return true;
        
        return false;
    }

    determineClaimRiskLevel(validationReport) {
        const criticalViolations = validationReport.violations.filter(v => v.severity === 'critical').length;
        const highViolations = validationReport.violations.filter(v => v.severity === 'high').length;
        
        if (criticalViolations > 0) return 'critical';
        if (highViolations > 2) return 'high';
        if (validationReport.violations.length > 0) return 'medium';
        return 'low';
    }

    async preValidateClaimData(claimData) {
        const blockingIssues = [];
        const warnings = [];

        // Check for required state
        if (!claimData.property?.state) {
            blockingIssues.push({
                type: 'missing_required_field',
                field: 'property.state',
                message: 'Property state is required for compliance validation'
            });
        }

        // Check for valid state
        if (claimData.property?.state && !this.legalComplianceService.stateRegulations.has(claimData.property.state)) {
            warnings.push({
                type: 'unknown_state_regulations',
                field: 'property.state',
                message: `No specific regulations loaded for state: ${claimData.property.state}`
            });
        }

        return { blockingIssues, warnings };
    }

    async logIntegratedComplianceEvent(eventData) {
        return await this.legalComplianceService.logComplianceEvent({
            ...eventData,
            source: 'integrated_compliance_service',
            integrationVersion: '1.0.0'
        });
    }

    generateDocumentId() {
        return `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
    }

    formatComplianceAlertForClaim(alert) {
        return `COMPLIANCE ALERT: ${alert.type}

Severity: ${alert.severity.toUpperCase()}
Time: ${alert.timestamp}

${alert.violations?.length > 0 ? 'VIOLATIONS:\n' + alert.violations.map(v => `- ${v.message}`).join('\n') + '\n\n' : ''}
${alert.warnings?.length > 0 ? 'WARNINGS:\n' + alert.warnings.map(w => `- ${w.message}`).join('\n') + '\n\n' : ''}

Required Actions:
${alert.requiredActions?.map(a => `- ${a.description}`).join('\n') || 'Review compliance status and take appropriate action.'}

This is an automated compliance alert. Please review and take appropriate action.`;
    }

    // Public API Methods
    async getIntegratedClaimStatus(claimId) {
        const claim = this.claimTrackingService.getClaim(claimId);
        const complianceStatus = this.legalComplianceService.getComplianceStatus(claimId);
        const violations = this.legalComplianceService.getAllViolations(claimId);
        const monitoring = this.monitoredClaims.get(claimId);

        return {
            claimId,
            claim: claim ? {
                status: claim.status,
                priority: claim.priority,
                daysInProcess: claim.tracking?.daysInProcess,
                compliance: claim.compliance
            } : null,
            complianceStatus,
            violations: violations.length,
            monitoring: monitoring ? {
                active: true,
                config: monitoring
            } : { active: false },
            lastUpdated: new Date().toISOString()
        };
    }

    async generateComplianceReport(filters = {}) {
        const allClaims = this.claimTrackingService.getAllClaims();
        const complianceMetrics = this.legalComplianceService.getComplianceMetrics();

        const report = {
            summary: {
                totalClaims: allClaims.length,
                monitoredClaims: this.monitoredClaims.size,
                complianceMetrics
            },
            claimCompliance: [],
            recommendations: [],
            generatedAt: new Date().toISOString()
        };

        // Analyze each claim's compliance
        for (const claim of allClaims) {
            if (filters.state && claim.property?.state !== filters.state) continue;
            if (filters.status && claim.status !== filters.status) continue;

            const complianceStatus = this.legalComplianceService.getComplianceStatus(claim.id);
            const violations = this.legalComplianceService.getAllViolations(claim.id);

            report.claimCompliance.push({
                claimId: claim.id,
                propertyState: claim.property?.state,
                status: claim.status,
                compliance: complianceStatus,
                violationCount: violations.length,
                riskLevel: claim.compliance?.riskLevel || 'unknown',
                monitoring: this.monitoredClaims.has(claim.id)
            });
        }

        return report;
    }

    // Integration status
    getIntegrationStatus() {
        return {
            active: this.integrationActive,
            services: {
                legalCompliance: this.legalComplianceService ? 'connected' : 'disconnected',
                claimTracking: this.claimTrackingService ? 'connected' : 'disconnected',
                documentProcessing: this.documentProcessingService ? 'connected' : 'disconnected'
            },
            monitoring: {
                activeClaims: this.monitoredClaims.size,
                totalEntities: this.legalComplianceService.activeMonitoring?.size || 0
            },
            lastUpdated: new Date().toISOString()
        };
    }
}