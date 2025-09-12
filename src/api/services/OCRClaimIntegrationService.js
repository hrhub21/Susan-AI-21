import { EventEmitter } from 'events';
import DocumentOCRService from './DocumentOCRService.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * OCR Claim Integration Service
 * Integrates OCR document processing with claim tracking and insurance workflows
 * Automatically processes uploaded insurance documents and extracts claim-relevant data
 */
export class OCRClaimIntegrationService extends EventEmitter {
    constructor() {
        super();
        this.ocrService = new DocumentOCRService();
        this.claimTrackingService = null;
        this.roofingAnalysisService = null;
        
        // Document processing queues
        this.processingQueue = [];
        this.completedProcessing = new Map();
        this.failedProcessing = new Map();
        
        // Integration configurations
        this.integrationSettings = {
            autoProcessDocuments: true,
            autoCreateClaims: false, // Require manual approval for claim creation
            autoUpdateClaims: true,
            confidenceThreshold: 0.7,
            enableRealTimeProcessing: true,
            batchProcessingInterval: 300000 // 5 minutes
        };

        // Document type to claim field mappings
        this.documentFieldMappings = {
            'claim_form': {
                'policy_number': 'insurance.policyNumber',
                'claim_number': 'insurance.claimNumber',
                'date_of_loss': 'damage.dateOfLoss',
                'amount': 'financial.estimatedValue',
                'insured_name': 'property.owner',
                'adjuster': 'insurance.adjusterInfo.name'
            },
            'policy_document': {
                'policy_number': 'insurance.policyNumber',
                'effective_date': 'insurance.effectiveDate',
                'premium_amount': 'insurance.premiumAmount',
                'coverage_amount': 'insurance.coverageAmount',
                'deductible': 'insurance.deductible'
            },
            'estimate_form': {
                'estimate_number': 'documents.estimates[].number',
                'total_amount': 'financial.estimatedValue',
                'date': 'documents.estimates[].date',
                'contractor': 'team.contractor',
                'scope_of_work': 'damage.description'
            },
            'inspection_report': {
                'report_number': 'documents.reports[].number',
                'inspection_date': 'documents.reports[].date',
                'property_address': 'property.address',
                'inspector': 'documents.reports[].inspector',
                'damage_assessment': 'damage.description'
            }
        };

        // Workflow triggers based on document types
        this.workflowTriggers = {
            'claim_form': ['validate_claim_info', 'check_policy_status', 'schedule_inspection'],
            'policy_document': ['verify_coverage', 'update_policy_info'],
            'estimate_form': ['review_estimate', 'compare_estimates', 'validate_scope'],
            'inspection_report': ['process_findings', 'update_damage_assessment', 'generate_recommendations']
        };

        this.initialize();
    }

    async initialize() {
        try {
            console.log('🔗 Initializing OCR Claim Integration Service...');
            
            // Validate OCR engines
            await this.ocrService.validateEngines();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start background processing
            this.startBackgroundProcessing();
            
            console.log('✅ OCR Claim Integration Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize OCR Claim Integration Service:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners for claim and document events
     */
    setupEventListeners() {
        // Listen for new documents uploaded to claims
        this.on('document_uploaded', async (data) => {
            if (this.integrationSettings.autoProcessDocuments) {
                await this.processClaimDocument(data.claimId, data.documentPath, data.metadata);
            }
        });

        // Listen for OCR processing completion
        this.on('ocr_completed', async (data) => {
            await this.handleOCRResults(data.claimId, data.results);
        });

        // Listen for batch processing requests
        this.on('batch_process_request', async (data) => {
            await this.processBatchDocuments(data.documents, data.options);
        });
    }

    /**
     * Process a single document for a specific claim
     */
    async processClaimDocument(claimId, documentPath, metadata = {}) {
        try {
            console.log(`📄 Processing document for claim ${claimId}: ${path.basename(documentPath)}`);

            const processingId = this.generateProcessingId();
            
            // Add to processing queue
            const queueItem = {
                id: processingId,
                claimId,
                documentPath,
                metadata,
                status: 'queued',
                startTime: new Date().toISOString()
            };
            
            this.processingQueue.push(queueItem);

            // Process document with OCR
            const ocrOptions = {
                language: metadata.language || 'en',
                documentType: metadata.documentType || 'auto',
                enhanceImage: true,
                extractStructuredData: true
            };

            const ocrResults = await this.ocrService.processDocument(documentPath, ocrOptions);

            // Update processing status
            queueItem.status = ocrResults.success ? 'completed' : 'failed';
            queueItem.endTime = new Date().toISOString();
            queueItem.results = ocrResults;

            if (ocrResults.success) {
                // Process successful OCR results
                await this.processOCRResults(claimId, ocrResults, metadata);
                this.completedProcessing.set(processingId, queueItem);
                
                console.log(`✅ Document processed successfully for claim ${claimId}`);
            } else {
                // Handle processing failure
                this.failedProcessing.set(processingId, queueItem);
                console.error(`❌ OCR processing failed for claim ${claimId}:`, ocrResults.error);
            }

            // Emit completion event
            this.emit('ocr_completed', {
                claimId,
                processingId,
                results: ocrResults,
                success: ocrResults.success
            });

            return queueItem;

        } catch (error) {
            console.error(`❌ Error processing document for claim ${claimId}:`, error);
            throw error;
        }
    }

    /**
     * Process OCR results and integrate with claim data
     */
    async processOCRResults(claimId, ocrResults, metadata) {
        try {
            if (!this.claimTrackingService) {
                console.warn('⚠️ Claim tracking service not available, storing results for later integration');
                return;
            }

            const claim = await this.claimTrackingService.getClaim(claimId);
            if (!claim) {
                throw new Error(`Claim ${claimId} not found`);
            }

            // Extract structured data
            const structuredData = ocrResults.structuredData || {};
            const documentType = ocrResults.documentType;

            // Update claim with extracted data
            const updates = await this.mapOCRDataToClaim(structuredData, documentType, claim);
            
            if (Object.keys(updates).length > 0) {
                await this.claimTrackingService.updateClaim(claimId, updates);
                console.log(`📊 Updated claim ${claimId} with OCR extracted data`);
            }

            // Add document to claim records
            await this.addDocumentToClaim(claimId, ocrResults, metadata);

            // Trigger workflows based on document type
            await this.triggerWorkflows(claimId, documentType, ocrResults);

            // Generate insights and recommendations
            await this.generateDocumentInsights(claimId, ocrResults);

        } catch (error) {
            console.error('❌ Error processing OCR results:', error);
            throw error;
        }
    }

    /**
     * Map OCR extracted data to claim fields
     */
    async mapOCRDataToClaim(structuredData, documentType, claim) {
        const updates = {};
        const fieldMappings = this.documentFieldMappings[documentType];

        if (!fieldMappings || !structuredData.fields) {
            return updates;
        }

        for (const [ocrField, claimPath] of Object.entries(fieldMappings)) {
            const extractedField = structuredData.fields[ocrField];
            
            if (extractedField && extractedField.confidence >= this.integrationSettings.confidenceThreshold) {
                // Map the extracted value to the claim structure
                this.setNestedProperty(updates, claimPath, extractedField.value);
                
                console.log(`📋 Mapped ${ocrField} -> ${claimPath}: ${extractedField.value}`);
            }
        }

        // Special handling for specific document types
        if (documentType === 'claim_form') {
            updates.lastUpdated = new Date().toISOString();
            updates.tracking = updates.tracking || {};
            updates.tracking.lastDocumentUpdate = new Date().toISOString();
        }

        return updates;
    }

    /**
     * Add processed document to claim records
     */
    async addDocumentToClaim(claimId, ocrResults, metadata) {
        if (!this.claimTrackingService) return;

        const documentRecord = {
            id: this.generateDocumentId(),
            filename: ocrResults.fileName,
            type: ocrResults.documentType,
            uploadDate: new Date().toISOString(),
            processedDate: ocrResults.metadata.processedAt,
            ocrResults: {
                confidence: ocrResults.confidence,
                engine: ocrResults.engine,
                extractedText: ocrResults.text,
                structuredData: ocrResults.structuredData,
                qualityAssessment: ocrResults.qualityAssessment
            },
            metadata: metadata
        };

        // Add to appropriate document category
        const documentCategory = this.getDocumentCategory(ocrResults.documentType);
        await this.claimTrackingService.addClaimDocument(claimId, documentCategory, documentRecord);

        console.log(`📁 Added ${ocrResults.documentType} document to claim ${claimId}`);
    }

    /**
     * Trigger workflows based on document type
     */
    async triggerWorkflows(claimId, documentType, ocrResults) {
        const triggers = this.workflowTriggers[documentType];
        if (!triggers) return;

        for (const trigger of triggers) {
            try {
                await this.executeWorkflowTrigger(claimId, trigger, ocrResults);
            } catch (error) {
                console.error(`❌ Failed to execute workflow trigger ${trigger}:`, error);
            }
        }
    }

    /**
     * Execute specific workflow trigger
     */
    async executeWorkflowTrigger(claimId, triggerName, ocrResults) {
        console.log(`🔄 Executing workflow trigger: ${triggerName} for claim ${claimId}`);

        switch (triggerName) {
            case 'validate_claim_info':
                await this.validateClaimInformation(claimId, ocrResults);
                break;
            case 'schedule_inspection':
                await this.scheduleInspection(claimId, ocrResults);
                break;
            case 'review_estimate':
                await this.reviewEstimate(claimId, ocrResults);
                break;
            case 'process_findings':
                await this.processInspectionFindings(claimId, ocrResults);
                break;
            default:
                console.log(`⚠️ Unknown workflow trigger: ${triggerName}`);
        }
    }

    /**
     * Generate insights and recommendations from document analysis
     */
    async generateDocumentInsights(claimId, ocrResults) {
        const insights = {
            documentType: ocrResults.documentType,
            confidence: ocrResults.confidence,
            qualityScore: ocrResults.qualityAssessment?.overallScore || 0,
            extractedFieldsCount: Object.keys(ocrResults.structuredData?.fields || {}).length,
            missingFields: ocrResults.structuredData?.missingRequiredFields || [],
            recommendations: [],
            alerts: []
        };

        // Generate recommendations based on quality and completeness
        if (insights.qualityScore < 0.7) {
            insights.recommendations.push({
                type: 'quality_improvement',
                message: 'Document quality is low, consider requesting a higher quality scan',
                priority: 'medium'
            });
        }

        if (insights.missingFields.length > 0) {
            insights.recommendations.push({
                type: 'missing_information',
                message: `Missing required fields: ${insights.missingFields.join(', ')}`,
                priority: 'high'
            });
        }

        // Document-specific insights
        if (ocrResults.documentType === 'claim_form') {
            await this.generateClaimFormInsights(insights, ocrResults);
        } else if (ocrResults.documentType === 'estimate_form') {
            await this.generateEstimateInsights(insights, ocrResults);
        }

        // Store insights
        if (this.claimTrackingService) {
            await this.claimTrackingService.addClaimInsight(claimId, insights);
        }

        console.log(`💡 Generated insights for claim ${claimId} document`);
    }

    /**
     * Process batch documents
     */
    async processBatchDocuments(documents, options = {}) {
        console.log(`🔄 Starting batch processing of ${documents.length} documents`);

        const results = await this.ocrService.batchProcess(
            documents.map(doc => doc.path),
            {
                maxConcurrent: options.maxConcurrent || 3,
                progressCallback: (progress) => {
                    this.emit('batch_progress', progress);
                }
            }
        );

        // Process each result
        for (let i = 0; i < results.results.length; i++) {
            const document = documents[i];
            const result = results.results[i];

            if (result.success && document.claimId) {
                await this.processOCRResults(document.claimId, result, document.metadata || {});
            }
        }

        this.emit('batch_completed', {
            total: documents.length,
            successful: results.successful,
            failed: results.failed,
            results: results
        });

        return results;
    }

    /**
     * Start background processing for queued items
     */
    startBackgroundProcessing() {
        if (!this.integrationSettings.enableRealTimeProcessing) return;

        setInterval(async () => {
            await this.processQueuedItems();
        }, this.integrationSettings.batchProcessingInterval);
    }

    /**
     * Process queued items
     */
    async processQueuedItems() {
        const queuedItems = this.processingQueue.filter(item => item.status === 'queued');
        
        if (queuedItems.length === 0) return;

        console.log(`🔄 Processing ${queuedItems.length} queued documents`);

        for (const item of queuedItems) {
            try {
                await this.processClaimDocument(item.claimId, item.documentPath, item.metadata);
            } catch (error) {
                console.error(`❌ Failed to process queued item ${item.id}:`, error);
                item.status = 'failed';
                item.error = error.message;
            }
        }
    }

    /**
     * Set the claim tracking service for integration
     */
    setClaimTrackingService(claimTrackingService) {
        this.claimTrackingService = claimTrackingService;
        console.log('🔗 Connected to Claim Tracking Service');
    }

    /**
     * Set the roofing analysis service for integration
     */
    setRoofingAnalysisService(roofingAnalysisService) {
        this.roofingAnalysisService = roofingAnalysisService;
        console.log('🔗 Connected to Roofing Analysis Service');
    }

    /**
     * Get processing statistics
     */
    getProcessingStatistics() {
        const totalProcessed = this.completedProcessing.size + this.failedProcessing.size;
        const successRate = totalProcessed > 0 ? this.completedProcessing.size / totalProcessed : 0;

        return {
            totalProcessed,
            completed: this.completedProcessing.size,
            failed: this.failedProcessing.size,
            queued: this.processingQueue.filter(item => item.status === 'queued').length,
            successRate,
            averageProcessingTime: this.calculateAverageProcessingTime(),
            ocrEngineStats: this.ocrService.getStatistics()
        };
    }

    // Helper methods
    generateProcessingId() {
        return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateDocumentId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (key.includes('[')) {
                // Handle array notation like 'estimates[].number'
                const [arrayKey] = key.split('[');
                if (!current[arrayKey]) current[arrayKey] = [];
                // For simplicity, we'll add to the first element or create one
                if (current[arrayKey].length === 0) current[arrayKey].push({});
                current = current[arrayKey][0];
            } else {
                if (!current[key]) current[key] = {};
                current = current[key];
            }
        }

        const finalKey = keys[keys.length - 1];
        current[finalKey] = value;
    }

    getDocumentCategory(documentType) {
        const categoryMap = {
            'claim_form': 'correspondence',
            'policy_document': 'correspondence',
            'estimate_form': 'estimates',
            'inspection_report': 'reports'
        };
        return categoryMap[documentType] || 'correspondence';
    }

    calculateAverageProcessingTime() {
        const completedItems = Array.from(this.completedProcessing.values());
        if (completedItems.length === 0) return 0;

        const totalTime = completedItems.reduce((sum, item) => {
            if (item.startTime && item.endTime) {
                return sum + (new Date(item.endTime) - new Date(item.startTime));
            }
            return sum;
        }, 0);

        return totalTime / completedItems.length;
    }

    // Workflow trigger implementations (simplified)
    async validateClaimInformation(claimId, ocrResults) {
        // Implementation for claim validation workflow
        console.log(`✓ Validating claim information for ${claimId}`);
    }

    async scheduleInspection(claimId, ocrResults) {
        // Implementation for inspection scheduling workflow
        console.log(`📅 Triggering inspection scheduling for ${claimId}`);
    }

    async reviewEstimate(claimId, ocrResults) {
        // Implementation for estimate review workflow
        console.log(`💰 Triggering estimate review for ${claimId}`);
    }

    async processInspectionFindings(claimId, ocrResults) {
        // Implementation for inspection findings processing
        console.log(`🔍 Processing inspection findings for ${claimId}`);
    }

    async generateClaimFormInsights(insights, ocrResults) {
        // Generate specific insights for claim forms
        const claimNumber = ocrResults.structuredData?.fields?.claim_number?.value;
        if (claimNumber) {
            insights.alerts.push({
                type: 'claim_number_detected',
                message: `Claim number ${claimNumber} extracted from form`,
                priority: 'info'
            });
        }
    }

    async generateEstimateInsights(insights, ocrResults) {
        // Generate specific insights for estimates
        const amount = ocrResults.structuredData?.fields?.total_amount?.value;
        if (amount) {
            insights.alerts.push({
                type: 'estimate_amount',
                message: `Estimate amount of ${amount} detected`,
                priority: 'info'
            });
        }
    }
}

export default OCRClaimIntegrationService;