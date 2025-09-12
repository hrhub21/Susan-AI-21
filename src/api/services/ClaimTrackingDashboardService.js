import { EventEmitter } from 'events';

/**
 * Intelligent Claim Tracking Dashboard Service for Roof-ER
 * Comprehensive claim management with real-time status updates and intelligent insights
 * Enhanced with Real-Time Shingle Discontinuation Checker integration
 */
export class ClaimTrackingDashboardService extends EventEmitter {
    constructor() {
        super();
        this.claims = new Map();
        this.adjusters = new Map();
        this.companies = new Map();
        this.templates = new Map();
        this.analytics = new Map();
        
        // Manufacturer Database Service integration
        this.manufacturerDatabaseService = null;
        this.productDiscontinuationAlerts = new Map();
        
        this.claimStatuses = {
            draft: { order: 1, name: 'Draft', color: '#6B7280', category: 'preparation' },
            submitted: { order: 2, name: 'Submitted', color: '#3B82F6', category: 'active' },
            acknowledged: { order: 3, name: 'Acknowledged', color: '#8B5CF6', category: 'active' },
            under_review: { order: 4, name: 'Under Review', color: '#F59E0B', category: 'active' },
            inspection_scheduled: { order: 5, name: 'Inspection Scheduled', color: '#10B981', category: 'active' },
            inspection_completed: { order: 6, name: 'Inspection Completed', color: '#059669', category: 'evaluation' },
            additional_info_requested: { order: 7, name: 'Additional Info Requested', color: '#EF4444', category: 'action_required' },
            supplemental_submitted: { order: 8, name: 'Supplemental Submitted', color: '#8B5CF6', category: 'active' },
            approved: { order: 9, name: 'Approved', color: '#10B981', category: 'completed' },
            partial_approval: { order: 10, name: 'Partial Approval', color: '#F59E0B', category: 'partial' },
            denied: { order: 11, name: 'Denied', color: '#EF4444', category: 'completed' },
            payment_issued: { order: 12, name: 'Payment Issued', color: '#059669', category: 'completed' },
            closed: { order: 13, name: 'Closed', color: '#6B7280', category: 'completed' }
        };
        
        this.priorityLevels = {
            low: { score: 1, color: '#10B981', name: 'Low Priority' },
            medium: { score: 2, color: '#F59E0B', name: 'Medium Priority' },
            high: { score: 3, color: '#EF4444', name: 'High Priority' },
            urgent: { score: 4, color: '#DC2626', name: 'Urgent' },
            critical: { score: 5, color: '#991B1B', name: 'Critical' }
        };
        
        this.automationRules = new Map();
        this.notifications = new Map();
        this.workflowTemplates = new Map();
        
        this.initialize();
    }

    async initialize() {
        try {
            console.log('📊 Initializing Claim Tracking Dashboard Service...');
            
            // Setup automation rules
            this.setupAutomationRules();
            
            // Initialize workflow templates
            this.setupWorkflowTemplates();
            
            // Setup default adjuster and company profiles
            this.setupDefaultProfiles();
            
            // Start background processes
            this.startBackgroundProcesses();
            
            console.log('✅ Claim Tracking Dashboard Service ready');
        } catch (error) {
            console.error('❌ Failed to initialize claim tracking service:', error);
            throw error;
        }
    }

    /**
     * Create new insurance claim
     */
    async createClaim(claimData) {
        try {
            const claimId = this.generateClaimId();
            
            const claim = {
                id: claimId,
                created: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                status: 'draft',
                priority: this.calculateInitialPriority(claimData),
                
                // Property Information
                property: {
                    address: claimData.property?.address || '',
                    owner: claimData.property?.owner || '',
                    contactInfo: claimData.property?.contactInfo || {},
                    propertyType: claimData.property?.propertyType || 'residential',
                    squareFootage: claimData.property?.squareFootage || null,
                    yearBuilt: claimData.property?.yearBuilt || null,
                    roofType: claimData.property?.roofType || 'unknown'
                },
                
                // Insurance Information
                insurance: {
                    company: claimData.insurance?.company || '',
                    policyNumber: claimData.insurance?.policyNumber || '',
                    deductible: claimData.insurance?.deductible || 0,
                    coverageAmount: claimData.insurance?.coverageAmount || 0,
                    claimNumber: claimData.insurance?.claimNumber || '',
                    adjusterInfo: claimData.insurance?.adjusterInfo || {}
                },
                
                // Damage Information
                damage: {
                    type: claimData.damage?.type || 'unknown',
                    severity: claimData.damage?.severity || 'unknown',
                    dateOfLoss: claimData.damage?.dateOfLoss || '',
                    causeOfLoss: claimData.damage?.causeOfLoss || '',
                    description: claimData.damage?.description || '',
                    aiAnalysis: claimData.damage?.aiAnalysis || null
                },
                
                // Tracking Information
                tracking: {
                    submissionDate: null,
                    expectedResponseDate: null,
                    lastContactDate: null,
                    nextFollowUpDate: null,
                    daysInProcess: 0,
                    averageProcessingTime: null
                },
                
                // Communication History
                communications: [],
                
                // Documents and Evidence
                documents: {
                    photos: [],
                    reports: [],
                    estimates: [],
                    correspondence: [],
                    supplements: []
                },
                
                // Workflow and Automation
                workflow: {
                    currentStep: 1,
                    completedSteps: [],
                    automation: {
                        enabled: true,
                        rules: [],
                        lastRun: null
                    }
                },
                
                // Analytics and Performance
                analytics: {
                    responseTime: null,
                    approvalProbability: null,
                    strategiesUsed: [],
                    templatesUsed: [],
                    successFactors: []
                },
                
                // Team and Assignment
                team: {
                    primaryAdjuster: claimData.team?.primaryAdjuster || null,
                    assignedRep: claimData.team?.assignedRep || null,
                    teamMembers: claimData.team?.teamMembers || [],
                    contractor: claimData.team?.contractor || null
                },
                
                // Financial Tracking
                financial: {
                    estimatedValue: claimData.financial?.estimatedValue || 0,
                    approvedAmount: 0,
                    paidAmount: 0,
                    supplements: [],
                    depreciation: 0,
                    overhead: 0
                },
                
                // Quality and Compliance
                quality: {
                    score: null,
                    checklist: [],
                    complianceFlags: [],
                    reviewRequired: false
                }
            };
            
            // Store claim
            this.claims.set(claimId, claim);
            
            // Setup initial automation
            await this.setupClaimAutomation(claim);
            
            // Generate initial recommendations
            const recommendations = await this.generateClaimRecommendations(claim);
            
            // Log creation event
            this.logClaimEvent(claimId, 'claim_created', 'Claim created in system');
            
            // Emit event
            this.emit('claimCreated', { claimId, claim });
            
            console.log(`📋 Created claim: ${claimId}`);
            
            return {
                claimId,
                claim,
                recommendations,
                nextSteps: this.getNextSteps(claim),
                automationSetup: claim.workflow.automation
            };

        } catch (error) {
            console.error('❌ Error creating claim:', error);
            throw new Error(`Claim creation failed: ${error.message}`);
        }
    }

    /**
     * Update claim status with intelligent automation
     */
    async updateClaimStatus(claimId, newStatus, metadata = {}) {
        try {
            const claim = this.claims.get(claimId);
            if (!claim) {
                throw new Error('Claim not found');
            }
            
            const previousStatus = claim.status;
            const timestamp = new Date().toISOString();
            
            // Update status
            claim.status = newStatus;
            claim.lastUpdated = timestamp;
            
            // Update tracking information
            await this.updateTrackingInfo(claim, newStatus, metadata);
            
            // Run automation rules
            await this.executeAutomationRules(claim, previousStatus, newStatus);
            
            // Update analytics
            await this.updateClaimAnalytics(claim, previousStatus, newStatus);
            
            // Generate notifications
            const notifications = await this.generateStatusNotifications(claim, previousStatus, newStatus);
            
            // Update priority if needed
            const newPriority = await this.recalculatePriority(claim);
            if (newPriority !== claim.priority) {
                claim.priority = newPriority;
                this.logClaimEvent(claimId, 'priority_changed', `Priority updated to ${newPriority}`);
            }
            
            // Log status change
            this.logClaimEvent(claimId, 'status_changed', `Status changed from ${previousStatus} to ${newStatus}`, {
                previousStatus,
                newStatus,
                metadata
            });
            
            // Emit event
            this.emit('statusUpdated', { claimId, previousStatus, newStatus, claim });
            
            return {
                claimId,
                previousStatus,
                newStatus,
                notifications,
                nextSteps: this.getNextSteps(claim),
                automationTriggered: claim.workflow.automation.lastRun === timestamp
            };

        } catch (error) {
            console.error('❌ Error updating claim status:', error);
            throw new Error(`Status update failed: ${error.message}`);
        }
    }

    /**
     * Get comprehensive dashboard data
     */
    async getDashboardData(filters = {}) {
        try {
            const allClaims = Array.from(this.claims.values());
            const filteredClaims = this.applyFilters(allClaims, filters);
            
            // Generate dashboard metrics
            const metrics = this.calculateDashboardMetrics(filteredClaims);
            
            // Get status distribution
            const statusDistribution = this.getStatusDistribution(filteredClaims);
            
            // Get priority breakdown
            const priorityBreakdown = this.getPriorityBreakdown(filteredClaims);
            
            // Get performance analytics
            const performance = this.getPerformanceAnalytics(filteredClaims);
            
            // Get alerts and notifications
            const alerts = this.getActiveAlerts(filteredClaims);
            
            // Get workflow insights
            const workflowInsights = this.getWorkflowInsights(filteredClaims);
            
            // Get recent activity
            const recentActivity = this.getRecentActivity(filteredClaims, 20);
            
            return {
                summary: {
                    totalClaims: filteredClaims.length,
                    activeClaims: filteredClaims.filter(c => this.claimStatuses[c.status]?.category === 'active').length,
                    completedClaims: filteredClaims.filter(c => this.claimStatuses[c.status]?.category === 'completed').length,
                    avgProcessingTime: metrics.avgProcessingTime,
                    successRate: metrics.successRate,
                    totalValue: metrics.totalValue
                },
                metrics,
                statusDistribution,
                priorityBreakdown,
                performance,
                alerts,
                workflowInsights,
                recentActivity,
                claims: this.formatClaimsForDashboard(filteredClaims),
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error getting dashboard data:', error);
            throw new Error(`Dashboard data retrieval failed: ${error.message}`);
        }
    }

    /**
     * Add communication to claim
     */
    async addCommunication(claimId, communicationData) {
        try {
            const claim = this.claims.get(claimId);
            if (!claim) {
                throw new Error('Claim not found');
            }
            
            const communication = {
                id: this.generateCommunicationId(),
                timestamp: new Date().toISOString(),
                type: communicationData.type || 'note', // email, call, note, meeting, document
                direction: communicationData.direction || 'outbound', // inbound, outbound
                from: communicationData.from || '',
                to: communicationData.to || '',
                subject: communicationData.subject || '',
                content: communicationData.content || '',
                attachments: communicationData.attachments || [],
                template: communicationData.template || null,
                followUpRequired: communicationData.followUpRequired || false,
                followUpDate: communicationData.followUpDate || null,
                sentiment: communicationData.sentiment || 'neutral',
                importance: communicationData.importance || 'medium',
                tags: communicationData.tags || [],
                aiAnalysis: communicationData.aiAnalysis || null
            };
            
            // Add to claim communications
            claim.communications.push(communication);
            
            // Update last contact date
            claim.tracking.lastContactDate = communication.timestamp;
            claim.lastUpdated = communication.timestamp;
            
            // Update next follow-up if required
            if (communication.followUpRequired && communication.followUpDate) {
                claim.tracking.nextFollowUpDate = communication.followUpDate;
            }
            
            // Run automation based on communication
            await this.processCommunicationAutomation(claim, communication);
            
            // Log event
            this.logClaimEvent(claimId, 'communication_added', `${communication.type} communication added`, {
                communicationId: communication.id,
                type: communication.type,
                direction: communication.direction
            });
            
            // Emit event
            this.emit('communicationAdded', { claimId, communication, claim });
            
            return {
                claimId,
                communicationId: communication.id,
                communication,
                automationTriggered: await this.checkAutomationTriggers(claim, communication)
            };

        } catch (error) {
            console.error('❌ Error adding communication:', error);
            throw new Error(`Communication addition failed: ${error.message}`);
        }
    }

    /**
     * Get claim analytics and insights
     */
    async getClaimAnalytics(claimId) {
        try {
            const claim = this.claims.get(claimId);
            if (!claim) {
                throw new Error('Claim not found');
            }
            
            // Generate comprehensive analytics
            const timeline = this.generateClaimTimeline(claim);
            const communicationAnalysis = this.analyzeCommunications(claim);
            const performanceMetrics = this.calculateClaimPerformanceMetrics(claim);
            const predictiveInsights = await this.generatePredictiveInsights(claim);
            const benchmarking = this.benchmarkClaim(claim);
            const recommendations = await this.generateClaimRecommendations(claim);
            
            return {
                claimId,
                overview: {
                    daysInProcess: this.calculateDaysInProcess(claim),
                    totalCommunications: claim.communications.length,
                    statusChanges: this.countStatusChanges(claim),
                    documentsAttached: this.countDocuments(claim),
                    currentPriority: claim.priority
                },
                timeline,
                communicationAnalysis,
                performanceMetrics,
                predictiveInsights,
                benchmarking,
                recommendations,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error getting claim analytics:', error);
            throw new Error(`Analytics retrieval failed: ${error.message}`);
        }
    }

    // Helper Methods for Dashboard Functionality

    calculateInitialPriority(claimData) {
        let score = 1; // Base priority
        
        // Damage severity impact
        if (claimData.damage?.severity === 'severe') score += 2;
        else if (claimData.damage?.severity === 'moderate') score += 1;
        
        // Financial impact
        const estimatedValue = claimData.financial?.estimatedValue || 0;
        if (estimatedValue > 50000) score += 2;
        else if (estimatedValue > 25000) score += 1;
        
        // Property type impact
        if (claimData.property?.propertyType === 'commercial') score += 1;
        
        // Date of loss (older claims get higher priority)
        if (claimData.damage?.dateOfLoss) {
            const daysSinceLoss = (new Date() - new Date(claimData.damage.dateOfLoss)) / (1000 * 60 * 60 * 24);
            if (daysSinceLoss > 30) score += 1;
            if (daysSinceLoss > 60) score += 1;
        }
        
        // Convert score to priority level
        if (score >= 5) return 'critical';
        if (score >= 4) return 'urgent';
        if (score >= 3) return 'high';
        if (score >= 2) return 'medium';
        return 'low';
    }

    async setupClaimAutomation(claim) {
        // Setup default automation rules for the claim
        const defaultRules = [
            {
                trigger: 'status_change',
                condition: 'status === "submitted"',
                action: 'schedule_follow_up',
                parameters: { days: 3, message: 'Follow up on submitted claim' }
            },
            {
                trigger: 'no_response',
                condition: 'days_since_contact > 7',
                action: 'send_reminder',
                parameters: { template: 'follow_up_reminder' }
            },
            {
                trigger: 'status_change',
                condition: 'status === "approved"',
                action: 'notify_team',
                parameters: { message: 'Claim approved - begin work scheduling' }
            }
        ];
        
        claim.workflow.automation.rules = defaultRules;
        claim.workflow.automation.lastRun = new Date().toISOString();
    }

    async updateTrackingInfo(claim, newStatus, metadata) {
        const now = new Date().toISOString();
        
        // Update submission date
        if (newStatus === 'submitted' && !claim.tracking.submissionDate) {
            claim.tracking.submissionDate = now;
            
            // Calculate expected response date (typically 5-10 business days)
            const expectedDays = this.getExpectedResponseDays(claim.insurance.company);
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() + expectedDays);
            claim.tracking.expectedResponseDate = expectedDate.toISOString();
        }
        
        // Update days in process
        if (claim.tracking.submissionDate) {
            const submissionDate = new Date(claim.tracking.submissionDate);
            const currentDate = new Date();
            claim.tracking.daysInProcess = Math.floor((currentDate - submissionDate) / (1000 * 60 * 60 * 24));
        }
        
        // Update contact tracking
        if (metadata.contactMade) {
            claim.tracking.lastContactDate = now;
        }
        
        // Set next follow-up date based on status
        claim.tracking.nextFollowUpDate = this.calculateNextFollowUpDate(newStatus, claim);
    }

    getExpectedResponseDays(insuranceCompany) {
        // Company-specific response time expectations
        const companyProfile = this.companies.get(insuranceCompany);
        return companyProfile?.avgResponseDays || 7; // Default 7 days
    }

    calculateNextFollowUpDate(status, claim) {
        const followUpSchedule = {
            'submitted': 3, // 3 days after submission
            'acknowledged': 5, // 5 days after acknowledgment
            'under_review': 7, // 7 days during review
            'inspection_scheduled': 1, // 1 day before inspection
            'additional_info_requested': 2 // 2 days to provide info
        };
        
        const days = followUpSchedule[status];
        if (!days) return null;
        
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + days);
        return followUpDate.toISOString();
    }

    async executeAutomationRules(claim, previousStatus, newStatus) {
        const applicableRules = claim.workflow.automation.rules.filter(rule => {
            return this.evaluateRuleCondition(rule, claim, previousStatus, newStatus);
        });
        
        for (const rule of applicableRules) {
            await this.executeAutomationAction(rule, claim);
        }
        
        if (applicableRules.length > 0) {
            claim.workflow.automation.lastRun = new Date().toISOString();
        }
    }

    evaluateRuleCondition(rule, claim, previousStatus, newStatus) {
        try {
            // Simple condition evaluation (in production, use a proper expression parser)
            const context = {
                status: newStatus,
                previousStatus,
                days_since_contact: this.calculateDaysSinceContact(claim),
                days_in_process: claim.tracking.daysInProcess,
                priority: claim.priority
            };
            
            // For demo purposes, basic string matching
            if (rule.condition.includes('status ===')) {
                const targetStatus = rule.condition.match(/"([^"]+)"/)?.[1];
                return newStatus === targetStatus;
            }
            
            if (rule.condition.includes('days_since_contact >')) {
                const threshold = parseInt(rule.condition.match(/> (\d+)/)?.[1]);
                return context.days_since_contact > threshold;
            }
            
            return false;

        } catch (error) {
            console.error('❌ Error evaluating rule condition:', error);
            return false;
        }
    }

    async executeAutomationAction(rule, claim) {
        try {
            switch (rule.action) {
                case 'schedule_follow_up':
                    await this.scheduleFollowUp(claim, rule.parameters);
                    break;
                    
                case 'send_reminder':
                    await this.sendAutomatedReminder(claim, rule.parameters);
                    break;
                    
                case 'notify_team':
                    await this.notifyTeam(claim, rule.parameters);
                    break;
                    
                case 'update_priority':
                    await this.updatePriority(claim, rule.parameters);
                    break;
                    
                case 'generate_report':
                    await this.generateAutomatedReport(claim, rule.parameters);
                    break;
                    
                default:
                    console.warn(`Unknown automation action: ${rule.action}`);
            }

        } catch (error) {
            console.error(`❌ Error executing automation action ${rule.action}:`, error);
        }
    }

    async scheduleFollowUp(claim, parameters) {
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + (parameters.days || 3));
        
        claim.tracking.nextFollowUpDate = followUpDate.toISOString();
        
        // Add to notifications
        this.addNotification(claim.id, {
            type: 'follow_up_scheduled',
            message: parameters.message || 'Follow-up scheduled',
            scheduledFor: followUpDate.toISOString(),
            priority: 'medium'
        });
    }

    async sendAutomatedReminder(claim, parameters) {
        // In production, this would integrate with email/SMS services
        this.addNotification(claim.id, {
            type: 'reminder_sent',
            message: `Automated reminder sent using template: ${parameters.template}`,
            timestamp: new Date().toISOString(),
            priority: 'low'
        });
    }

    async notifyTeam(claim, parameters) {
        this.addNotification(claim.id, {
            type: 'team_notification',
            message: parameters.message,
            timestamp: new Date().toISOString(),
            priority: 'medium',
            recipients: claim.team.teamMembers
        });
    }

    calculateDashboardMetrics(claims) {
        const now = new Date();
        
        // Processing time calculations
        const completedClaims = claims.filter(c => this.claimStatuses[c.status]?.category === 'completed');
        const processingTimes = completedClaims
            .filter(c => c.tracking.submissionDate)
            .map(c => {
                const submitted = new Date(c.tracking.submissionDate);
                const completed = new Date(c.lastUpdated);
                return (completed - submitted) / (1000 * 60 * 60 * 24);
            });
        
        const avgProcessingTime = processingTimes.length > 0 
            ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length)
            : 0;
        
        // Success rate calculation
        const approvedClaims = claims.filter(c => ['approved', 'payment_issued'].includes(c.status));
        const successRate = completedClaims.length > 0 
            ? Math.round((approvedClaims.length / completedClaims.length) * 100)
            : 0;
        
        // Financial metrics
        const totalValue = claims.reduce((sum, claim) => sum + (claim.financial.estimatedValue || 0), 0);
        const approvedValue = claims.reduce((sum, claim) => sum + (claim.financial.approvedAmount || 0), 0);
        
        // Response time metrics
        const responseTimes = claims
            .filter(c => c.analytics.responseTime)
            .map(c => c.analytics.responseTime);
        
        const avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
            : 0;
        
        return {
            avgProcessingTime,
            avgResponseTime,
            successRate,
            totalValue,
            approvedValue,
            conversionRate: totalValue > 0 ? Math.round((approvedValue / totalValue) * 100) : 0,
            activeClaimsCount: claims.filter(c => this.claimStatuses[c.status]?.category === 'active').length,
            overdueClaimsCount: claims.filter(c => this.isClaimOverdue(c)).length
        };
    }

    getStatusDistribution(claims) {
        const distribution = {};
        
        Object.keys(this.claimStatuses).forEach(status => {
            distribution[status] = {
                count: claims.filter(c => c.status === status).length,
                percentage: 0,
                ...this.claimStatuses[status]
            };
        });
        
        // Calculate percentages
        const total = claims.length;
        if (total > 0) {
            Object.values(distribution).forEach(item => {
                item.percentage = Math.round((item.count / total) * 100);
            });
        }
        
        return distribution;
    }

    getPriorityBreakdown(claims) {
        const breakdown = {};
        
        Object.keys(this.priorityLevels).forEach(priority => {
            breakdown[priority] = {
                count: claims.filter(c => c.priority === priority).length,
                percentage: 0,
                ...this.priorityLevels[priority]
            };
        });
        
        // Calculate percentages
        const total = claims.length;
        if (total > 0) {
            Object.values(breakdown).forEach(item => {
                item.percentage = Math.round((item.count / total) * 100);
            });
        }
        
        return breakdown;
    }

    getPerformanceAnalytics(claims) {
        // Monthly performance trends
        const monthlyStats = this.calculateMonthlyStats(claims);
        
        // Adjuster performance
        const adjusterStats = this.calculateAdjusterStats(claims);
        
        // Company performance
        const companyStats = this.calculateCompanyStats(claims);
        
        // Template effectiveness
        const templateStats = this.calculateTemplateStats(claims);
        
        return {
            monthly: monthlyStats,
            adjusters: adjusterStats,
            companies: companyStats,
            templates: templateStats,
            trends: this.calculateTrends(claims)
        };
    }

    calculateMonthlyStats(claims) {
        const monthlyData = {};
        const months = 12; // Last 12 months
        
        for (let i = 0; i < months; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            const monthClaims = claims.filter(claim => {
                const claimDate = new Date(claim.created);
                return claimDate.getFullYear() === date.getFullYear() && 
                       claimDate.getMonth() === date.getMonth();
            });
            
            monthlyData[monthKey] = {
                total: monthClaims.length,
                approved: monthClaims.filter(c => c.status === 'approved').length,
                denied: monthClaims.filter(c => c.status === 'denied').length,
                value: monthClaims.reduce((sum, c) => sum + (c.financial.estimatedValue || 0), 0)
            };
        }
        
        return monthlyData;
    }

    calculateAdjusterStats(claims) {
        const adjusterStats = new Map();
        
        claims.forEach(claim => {
            if (claim.team.primaryAdjuster) {
                const adjusterId = claim.team.primaryAdjuster;
                
                if (!adjusterStats.has(adjusterId)) {
                    adjusterStats.set(adjusterId, {
                        totalClaims: 0,
                        approvedClaims: 0,
                        avgResponseTime: 0,
                        totalValue: 0,
                        responseTimes: []
                    });
                }
                
                const stats = adjusterStats.get(adjusterId);
                stats.totalClaims++;
                
                if (claim.status === 'approved') {
                    stats.approvedClaims++;
                }
                
                stats.totalValue += claim.financial.estimatedValue || 0;
                
                if (claim.analytics.responseTime) {
                    stats.responseTimes.push(claim.analytics.responseTime);
                }
            }
        });
        
        // Calculate averages
        adjusterStats.forEach(stats => {
            stats.successRate = stats.totalClaims > 0 
                ? Math.round((stats.approvedClaims / stats.totalClaims) * 100)
                : 0;
            
            stats.avgResponseTime = stats.responseTimes.length > 0
                ? Math.round(stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length)
                : 0;
        });
        
        return Object.fromEntries(adjusterStats);
    }

    getActiveAlerts(claims) {
        const alerts = [];
        
        claims.forEach(claim => {
            // Overdue follow-ups
            if (claim.tracking.nextFollowUpDate && new Date(claim.tracking.nextFollowUpDate) < new Date()) {
                alerts.push({
                    claimId: claim.id,
                    type: 'overdue_followup',
                    severity: 'warning',
                    message: `Follow-up overdue for claim ${claim.id}`,
                    daysOverdue: Math.floor((new Date() - new Date(claim.tracking.nextFollowUpDate)) / (1000 * 60 * 60 * 24))
                });
            }
            
            // Long processing times
            if (claim.tracking.daysInProcess > 30) {
                alerts.push({
                    claimId: claim.id,
                    type: 'long_processing',
                    severity: claim.tracking.daysInProcess > 60 ? 'critical' : 'warning',
                    message: `Claim processing for ${claim.tracking.daysInProcess} days`,
                    daysInProcess: claim.tracking.daysInProcess
                });
            }
            
            // High priority claims without recent activity
            if (claim.priority === 'urgent' || claim.priority === 'critical') {
                const daysSinceUpdate = Math.floor((new Date() - new Date(claim.lastUpdated)) / (1000 * 60 * 60 * 24));
                if (daysSinceUpdate > 3) {
                    alerts.push({
                        claimId: claim.id,
                        type: 'priority_stale',
                        severity: 'critical',
                        message: `High priority claim without activity for ${daysSinceUpdate} days`,
                        priority: claim.priority
                    });
                }
            }
        });
        
        return alerts.sort((a, b) => {
            const severityOrder = { critical: 3, warning: 2, info: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
    }

    formatClaimsForDashboard(claims) {
        return claims.map(claim => ({
            id: claim.id,
            propertyAddress: claim.property.address,
            owner: claim.property.owner,
            status: claim.status,
            statusDisplay: this.claimStatuses[claim.status]?.name || claim.status,
            priority: claim.priority,
            priorityDisplay: this.priorityLevels[claim.priority]?.name || claim.priority,
            created: claim.created,
            lastUpdated: claim.lastUpdated,
            daysInProcess: claim.tracking.daysInProcess,
            estimatedValue: claim.financial.estimatedValue,
            approvedAmount: claim.financial.approvedAmount,
            insuranceCompany: claim.insurance.company,
            nextFollowUp: claim.tracking.nextFollowUpDate,
            communicationCount: claim.communications.length,
            isOverdue: this.isClaimOverdue(claim),
            hasAlerts: this.hasClaimAlerts(claim)
        }));
    }

    isClaimOverdue(claim) {
        if (!claim.tracking.nextFollowUpDate) return false;
        return new Date(claim.tracking.nextFollowUpDate) < new Date();
    }

    hasClaimAlerts(claim) {
        return this.isClaimOverdue(claim) || 
               claim.tracking.daysInProcess > 30 || 
               (claim.priority === 'urgent' || claim.priority === 'critical');
    }

    // Utility methods
    applyFilters(claims, filters) {
        let filtered = [...claims];
        
        if (filters.status) {
            filtered = filtered.filter(c => c.status === filters.status);
        }
        
        if (filters.priority) {
            filtered = filtered.filter(c => c.priority === filters.priority);
        }
        
        if (filters.insuranceCompany) {
            filtered = filtered.filter(c => c.insurance.company === filters.insuranceCompany);
        }
        
        if (filters.dateRange) {
            const { start, end } = filters.dateRange;
            filtered = filtered.filter(c => {
                const claimDate = new Date(c.created);
                return claimDate >= new Date(start) && claimDate <= new Date(end);
            });
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(c => 
                c.property.address.toLowerCase().includes(searchTerm) ||
                c.property.owner.toLowerCase().includes(searchTerm) ||
                c.id.toLowerCase().includes(searchTerm)
            );
        }
        
        return filtered;
    }

    logClaimEvent(claimId, eventType, description, metadata = {}) {
        // In production, this would log to a proper logging system
        console.log(`[${new Date().toISOString()}] ${claimId}: ${eventType} - ${description}`, metadata);
    }

    addNotification(claimId, notification) {
        if (!this.notifications.has(claimId)) {
            this.notifications.set(claimId, []);
        }
        
        this.notifications.get(claimId).push({
            id: this.generateNotificationId(),
            ...notification,
            timestamp: notification.timestamp || new Date().toISOString(),
            read: false
        });
    }

    setupAutomationRules() {
        // Global automation rules that apply to all claims
        this.automationRules.set('overdue_followup', {
            trigger: 'scheduled_check',
            condition: 'nextFollowUpDate < now',
            action: 'send_reminder',
            enabled: true
        });
        
        this.automationRules.set('long_processing', {
            trigger: 'scheduled_check',
            condition: 'daysInProcess > 30',
            action: 'escalate_priority',
            enabled: true
        });
        
        this.automationRules.set('approved_notification', {
            trigger: 'status_change',
            condition: 'status === "approved"',
            action: 'notify_all_stakeholders',
            enabled: true
        });
    }

    setupWorkflowTemplates() {
        // Pre-defined workflow templates for different claim types
        this.workflowTemplates.set('hail_damage', {
            name: 'Hail Damage Workflow',
            steps: [
                { order: 1, name: 'Initial Contact', estimatedDays: 1 },
                { order: 2, name: 'Photo Documentation', estimatedDays: 2 },
                { order: 3, name: 'Claim Submission', estimatedDays: 1 },
                { order: 4, name: 'Adjuster Assignment', estimatedDays: 3 },
                { order: 5, name: 'Inspection Scheduling', estimatedDays: 5 },
                { order: 6, name: 'Inspection Completion', estimatedDays: 1 },
                { order: 7, name: 'Report Review', estimatedDays: 7 },
                { order: 8, name: 'Approval/Denial', estimatedDays: 3 }
            ]
        });
    }

    setupDefaultProfiles() {
        // Setup default adjuster profiles
        this.adjusters.set('default', {
            name: 'Default Adjuster',
            avgResponseDays: 5,
            successRate: 75,
            preferredCommunication: 'email'
        });
        
        // Setup default company profiles
        this.companies.set('default', {
            name: 'Default Insurance Company',
            avgResponseDays: 7,
            payoutRatio: 0.8,
            processingTime: 21
        });
    }

    startBackgroundProcesses() {
        // Start periodic processes
        setInterval(() => {
            this.runScheduledAutomation();
        }, 60000 * 60); // Run every hour
        
        setInterval(() => {
            this.updateAnalytics();
        }, 60000 * 60 * 6); // Run every 6 hours
    }

    async runScheduledAutomation() {
        // Run automation rules that are triggered by time
        for (const [claimId, claim] of this.claims) {
            await this.checkTimeBasedRules(claim);
        }
    }

    async updateAnalytics() {
        // Update performance analytics for all claims
        for (const [claimId, claim] of this.claims) {
            await this.updateClaimAnalytics(claim);
        }
    }

    // ID Generators
    generateClaimId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `CLM-${timestamp}-${random}`.toUpperCase();
    }

    generateCommunicationId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        return `COM-${timestamp}-${random}`.toUpperCase();
    }

    generateNotificationId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        return `NOT-${timestamp}-${random}`.toUpperCase();
    }

    // Additional helper methods would be implemented here...
    calculateDaysSinceContact(claim) {
        if (!claim.tracking.lastContactDate) return 999;
        const lastContact = new Date(claim.tracking.lastContactDate);
        const now = new Date();
        return Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
    }

    getNextSteps(claim) {
        // Generate intelligent next steps based on current claim status
        const status = claim.status;
        const statusInfo = this.claimStatuses[status];
        
        switch (status) {
            case 'draft':
                return [
                    'Complete damage documentation',
                    'Gather supporting evidence',
                    'Submit claim to insurance company'
                ];
            case 'submitted':
                return [
                    'Wait for adjuster assignment',
                    'Prepare for follow-up communication',
                    'Document any additional damage'
                ];
            case 'under_review':
                return [
                    'Follow up on review status',
                    'Provide additional information if requested',
                    'Prepare for potential inspection'
                ];
            case 'approved':
                return [
                    'Review approval details',
                    'Schedule work with contractor',
                    'Submit any necessary supplements'
                ];
            default:
                return ['Monitor claim progress', 'Maintain communication with adjuster'];
        }
    }

    // Public API methods for external use
    getClaim(claimId) {
        return this.claims.get(claimId);
    }

    getAllClaims() {
        return Array.from(this.claims.values());
    }

    getClaimsByStatus(status) {
        return Array.from(this.claims.values()).filter(claim => claim.status === status);
    }

    getClaimsByPriority(priority) {
        return Array.from(this.claims.values()).filter(claim => claim.priority === priority);
    }

    getOverdueClaims() {
        return Array.from(this.claims.values()).filter(claim => this.isClaimOverdue(claim));
    }

    /**
     * Attach Hover/EagleView measurement report to claim
     */
    async attachMeasurementReport(claimId, measurementReport) {
        try {
            const claim = this.claims.get(claimId);
            if (!claim) {
                throw new Error('Claim not found');
            }

            console.log(`🔗 Attaching measurement report ${measurementReport.id} to claim ${claimId}`);

            // Initialize measurements object if not exists
            if (!claim.measurements) {
                claim.measurements = {};
            }

            // Attach measurement report
            claim.measurements.hoverEagleView = {
                reportId: measurementReport.id,
                timestamp: measurementReport.timestamp,
                source: measurementReport.metadata.sources,
                confidence: measurementReport.quality.overallConfidence,
                roofArea: measurementReport.measurements.enhanced.totalRoofArea,
                complexity: measurementReport.measurements.enhanced.complexity,
                damagePercentage: measurementReport.damageAssessment?.damagePercentage || 0,
                costEstimate: measurementReport.costEstimates.total,
                visualization: measurementReport.visualization ? {
                    available: true,
                    modelUrl: measurementReport.visualization.model?.url,
                    viewerUrl: measurementReport.visualization.model?.viewerUrl
                } : { available: false }
            };

            // Update claim with enhanced data
            claim.lastUpdated = new Date().toISOString();
            
            // Update damage assessment if available
            if (measurementReport.damageAssessment) {
                claim.damage.aiAssessment = {
                    totalDamageArea: measurementReport.damageAssessment.totalDamageArea,
                    damagePercentage: measurementReport.damageAssessment.damagePercentage,
                    priorityAreas: measurementReport.damageAssessment.priorityAreas.length,
                    urgentRepairs: measurementReport.damageAssessment.repairRequirements.immediateAction,
                    estimatedCost: measurementReport.damageAssessment.damagesByPlane.reduce((sum, damage) => sum + damage.estimatedCost, 0)
                };
            }

            // Update cost estimates with precise measurements
            if (!claim.costEstimates) {
                claim.costEstimates = {};
            }
            
            claim.costEstimates.measurements = {
                source: 'hover_eagleview',
                total: measurementReport.costEstimates.total,
                breakdown: measurementReport.costEstimates.breakdown,
                materials: measurementReport.costEstimates.materials.total,
                labor: measurementReport.costEstimates.labor.total,
                lastUpdated: new Date().toISOString()
            };

            // Update priority based on damage assessment
            if (measurementReport.damageAssessment?.priorityAreas?.length > 0) {
                const urgentDamage = measurementReport.damageAssessment.priorityAreas.length;
                if (urgentDamage > 3 && claim.priority !== 'critical') {
                    claim.priority = 'critical';
                    this.logClaimEvent(claimId, 'priority_escalated', `Priority escalated to critical due to ${urgentDamage} urgent damage areas`);
                } else if (urgentDamage > 0 && ['low', 'medium'].includes(claim.priority)) {
                    claim.priority = 'high';
                    this.logClaimEvent(claimId, 'priority_escalated', `Priority escalated to high due to urgent damage`);
                }
            }

            // Log the attachment
            this.logClaimEvent(claimId, 'measurement_report_attached', 'Hover/EagleView measurement report attached', {
                reportId: measurementReport.id,
                confidence: measurementReport.quality.overallConfidence,
                roofArea: measurementReport.measurements.enhanced.totalRoofArea,
                estimatedCost: measurementReport.costEstimates.total
            });

            // Emit event
            this.emit('measurementReportAttached', { claimId, measurementReport, claim });

            return {
                success: true,
                claimId: claimId,
                reportId: measurementReport.id,
                integration: {
                    measurementsAttached: true,
                    damageAssessmentUpdated: !!measurementReport.damageAssessment,
                    costEstimatesUpdated: true,
                    priorityAdjusted: true
                }
            };

        } catch (error) {
            console.error('❌ Error attaching measurement report:', error);
            throw new Error(`Failed to attach measurement report: ${error.message}`);
        }
    }

    /**
     * Update claim with Hover/EagleView data
     */
    async updateClaim(claimId, updateData) {
        try {
            const claim = this.claims.get(claimId);
            if (!claim) {
                throw new Error('Claim not found');
            }

            console.log(`📝 Updating claim ${claimId} with Hover/EagleView data`);

            // Merge update data into claim
            const updatedClaim = { ...claim, ...updateData, lastUpdated: new Date().toISOString() };
            this.claims.set(claimId, updatedClaim);

            // Log the update
            this.logClaimEvent(claimId, 'claim_updated', 'Claim updated with measurement data', updateData);

            // Emit event
            this.emit('claimUpdated', { claimId, updateData, claim: updatedClaim });

            return updatedClaim;

        } catch (error) {
            console.error('❌ Error updating claim:', error);
            throw new Error(`Failed to update claim: ${error.message}`);
        }
    }

    /**
     * Get claims with measurement reports
     */
    getClaimsWithMeasurements() {
        return Array.from(this.claims.values()).filter(claim => 
            claim.measurements?.hoverEagleView?.reportId
        );
    }

    /**
     * Get measurement summary for dashboard
     */
    getMeasurementSummary() {
        const claimsWithMeasurements = this.getClaimsWithMeasurements();
        
        if (claimsWithMeasurements.length === 0) {
            return {
                totalClaims: 0,
                averageConfidence: 0,
                totalRoofArea: 0,
                totalEstimatedCost: 0,
                urgentRepairs: 0
            };
        }

        const totalRoofArea = claimsWithMeasurements.reduce((sum, claim) => 
            sum + (claim.measurements.hoverEagleView.roofArea || 0), 0
        );

        const totalEstimatedCost = claimsWithMeasurements.reduce((sum, claim) => 
            sum + (claim.measurements.hoverEagleView.costEstimate || 0), 0
        );

        const averageConfidence = claimsWithMeasurements.reduce((sum, claim) => 
            sum + (claim.measurements.hoverEagleView.confidence || 0), 0
        ) / claimsWithMeasurements.length;

        const urgentRepairs = claimsWithMeasurements.reduce((sum, claim) => 
            sum + (claim.damage?.aiAssessment?.priorityAreas || 0), 0
        );

        return {
            totalClaims: claimsWithMeasurements.length,
            averageConfidence: Math.round(averageConfidence * 100) / 100,
            totalRoofArea: Math.round(totalRoofArea),
            totalEstimatedCost: Math.round(totalEstimatedCost),
            urgentRepairs: urgentRepairs,
            claimsWithVisualization: claimsWithMeasurements.filter(claim => 
                claim.measurements.hoverEagleView.visualization?.available
            ).length
        };
    }

    /**
     * Get claims requiring urgent attention based on measurements
     */
    getUrgentMeasurementClaims() {
        return Array.from(this.claims.values()).filter(claim => {
            const measurements = claim.measurements?.hoverEagleView;
            const damage = claim.damage?.aiAssessment;
            
            return measurements && (
                damage?.urgentRepairs ||
                damage?.priorityAreas > 0 ||
                measurements.damagePercentage > 25 ||
                measurements.confidence < 0.7
            );
        });
    }

    /**
     * Generate measurement-enhanced claim report
     */
    generateEnhancedClaimReport(claimId) {
        const claim = this.claims.get(claimId);
        if (!claim) {
            throw new Error('Claim not found');
        }

        const measurements = claim.measurements?.hoverEagleView;
        if (!measurements) {
            throw new Error('No measurement data available for this claim');
        }

        return {
            claimId: claimId,
            claimInfo: {
                status: claim.status,
                priority: claim.priority,
                created: claim.created,
                lastUpdated: claim.lastUpdated
            },
            property: claim.property,
            measurements: {
                source: 'Hover/EagleView Integration',
                reportId: measurements.reportId,
                confidence: measurements.confidence,
                roofArea: measurements.roofArea,
                complexity: measurements.complexity,
                visualizationAvailable: measurements.visualization?.available || false
            },
            damageAssessment: claim.damage?.aiAssessment || null,
            costEstimates: claim.costEstimates?.measurements || null,
            recommendations: this.generateMeasurementRecommendations(claim),
            complianceCheck: this.checkMeasurementCompliance(claim)
        };
    }

    /**
     * Generate recommendations based on measurement data
     */
    generateMeasurementRecommendations(claim) {
        const recommendations = [];
        const measurements = claim.measurements?.hoverEagleView;
        const damage = claim.damage?.aiAssessment;

        if (!measurements) {
            return ['Obtain professional measurement report for accurate assessment'];
        }

        // Confidence-based recommendations
        if (measurements.confidence < 0.8) {
            recommendations.push('Consider professional verification due to lower measurement confidence');
        }

        // Damage-based recommendations
        if (damage?.urgentRepairs) {
            recommendations.push('Schedule emergency repairs immediately for priority damage areas');
        }

        if (damage?.damagePercentage > 40) {
            recommendations.push('Consider full roof replacement rather than repairs');
        } else if (damage?.damagePercentage > 15) {
            recommendations.push('Plan for significant roof repairs');
        }

        // Complexity-based recommendations
        if (measurements.complexity === 'extreme') {
            recommendations.push('Engage specialized contractors experienced with complex roof structures');
        }

        // Visualization recommendations
        if (measurements.visualization?.available) {
            recommendations.push('Utilize 3D visualization for adjuster and contractor communications');
        }

        return recommendations.length > 0 ? recommendations : ['Proceed with standard claim processing'];
    }

    /**
     * Check measurement compliance with industry standards
     */
    checkMeasurementCompliance(claim) {
        const measurements = claim.measurements?.hoverEagleView;
        if (!measurements) {
            return { compliant: false, reason: 'No measurement data available' };
        }

        const checks = {
            confidence: measurements.confidence >= 0.8,
            dataComplete: measurements.roofArea > 0 && measurements.costEstimate > 0,
            sourceVerified: measurements.source?.hover || measurements.source?.eagleView,
            recentData: this.isDataRecent(measurements.timestamp)
        };

        const passedChecks = Object.values(checks).filter(check => check).length;
        const totalChecks = Object.keys(checks).length;
        const complianceScore = passedChecks / totalChecks;

        return {
            compliant: complianceScore >= 0.75,
            score: complianceScore,
            checks: checks,
            recommendations: complianceScore < 0.75 ? 
                ['Update measurement data', 'Verify data sources', 'Ensure recent measurements'] : 
                ['Measurement data meets compliance standards']
        };
    }

    /**
     * Check if measurement data is recent (within 30 days)
     */
    isDataRecent(timestamp) {
        const measurementDate = new Date(timestamp);
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
        return measurementDate > thirtyDaysAgo;
    }

    /**
     * Integrate with Manufacturer Database Service
     */
    async integrateWithManufacturerDatabase(manufacturerDatabaseService) {
        try {
            console.log('🏭 Integrating Claim Tracking with Manufacturer Database Service...');
            
            this.manufacturerDatabaseService = manufacturerDatabaseService;
            
            // Listen for product discontinuation alerts
            manufacturerDatabaseService.on('alertGenerated', async (alert) => {
                if (alert.type === 'product_discontinued') {
                    await this.handleProductDiscontinuationAlert(alert);
                }
            });
            
            // Listen for price change alerts
            manufacturerDatabaseService.on('alertGenerated', async (alert) => {
                if (alert.type === 'price_increase' || alert.type === 'price_decrease') {
                    await this.handlePriceChangeAlert(alert);
                }
            });
            
            // Analyze existing claims for manufacturer database insights
            for (const [claimId, claim] of this.claims) {
                await this.enhanceClaimWithManufacturerData(claimId, claim);
            }
            
            console.log('✅ Manufacturer Database Service integration complete');
            this.emit('manufacturerDatabaseIntegrated', { service: manufacturerDatabaseService });
            
        } catch (error) {
            console.error('❌ Failed to integrate Manufacturer Database Service:', error);
            throw error;
        }
    }

    /**
     * Handle product discontinuation alerts for active claims
     */
    async handleProductDiscontinuationAlert(alert) {
        try {
            const discontinuedProductId = alert.data.product_id;
            const affectedClaims = this.findClaimsWithProduct(discontinuedProductId);
            
            for (const claimId of affectedClaims) {
                const claim = this.claims.get(claimId);
                
                // Add discontinuation alert to claim
                await this.addCommunication(claimId, {
                    type: 'alert',
                    direction: 'internal',
                    subject: 'CRITICAL: Product Discontinuation Alert',
                    content: `DISCONTINUATION ALERT: ${alert.data.product_name} has been discontinued by ${alert.data.manufacturer}. This may significantly impact claim settlement values. Immediate action required to identify suitable alternatives and assess price impact.`,
                    tags: ['discontinuation', 'critical', 'manufacturer-alert'],
                    importance: 'critical',
                    followUpRequired: true,
                    followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
                    aiAnalysis: {
                        alert_type: 'product_discontinuation',
                        product_id: discontinuedProductId,
                        manufacturer: alert.data.manufacturer,
                        impact_level: 'high',
                        recommended_actions: [
                            'Identify alternative products immediately',
                            'Assess price impact for claim settlement',
                            'Document discontinuation in claim file',
                            'Negotiate with adjuster if significant cost increase'
                        ]
                    }
                });
                
                // Update claim priority if not already critical
                if (claim.priority !== 'critical') {
                    claim.priority = 'critical';
                    this.logClaimEvent(claimId, 'priority_escalated', 
                        `Priority escalated to critical due to product discontinuation: ${alert.data.product_name}`);
                }
                
                // Generate manufacturer database analysis for the claim
                const manufacturerAnalysis = await this.generateManufacturerAnalysisForClaim(claimId);
                
                // Store discontinuation alert reference
                this.productDiscontinuationAlerts.set(`${claimId}-${discontinuedProductId}`, {
                    claimId,
                    productId: discontinuedProductId,
                    alertId: alert.id,
                    detectedAt: new Date().toISOString(),
                    status: 'active',
                    manufacturerAnalysis
                });
            }
            
            // Emit claim discontinuation event
            this.emit('productDiscontinuationDetected', {
                productId: discontinuedProductId,
                affectedClaims: affectedClaims,
                alert: alert
            });
            
        } catch (error) {
            console.error('❌ Error handling product discontinuation alert:', error);
        }
    }

    /**
     * Handle price change alerts for active claims
     */
    async handlePriceChangeAlert(alert) {
        try {
            const productId = alert.data.product_id;
            const affectedClaims = this.findClaimsWithProduct(productId);
            
            if (affectedClaims.length > 0 && Math.abs(parseFloat(alert.data.percentage)) >= 10) {
                for (const claimId of affectedClaims) {
                    await this.addCommunication(claimId, {
                        type: 'note',
                        direction: 'internal',
                        subject: `Price Change Alert: ${alert.data.product_name}`,
                        content: `PRICE CHANGE: ${alert.data.product_name} price changed from $${alert.data.old_price} to $${alert.data.new_price} (${alert.data.percentage}% change). Review claim settlement impact.`,
                        tags: ['price-change', 'manufacturer-alert'],
                        importance: 'medium',
                        aiAnalysis: {
                            alert_type: 'price_change',
                            product_id: productId,
                            old_price: alert.data.old_price,
                            new_price: alert.data.new_price,
                            percentage_change: alert.data.percentage
                        }
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Error handling price change alert:', error);
        }
    }

    /**
     * Find claims that reference a specific product
     */
    findClaimsWithProduct(productId) {
        const affectedClaims = [];
        
        for (const [claimId, claim] of this.claims) {
            // Check if claim has manufacturer data with this product
            if (claim.manufacturerData?.products?.some(p => p.id === productId)) {
                affectedClaims.push(claimId);
                continue;
            }
            
            // Check communications for product references
            if (claim.communications?.some(comm => 
                comm.content?.includes(productId) || 
                comm.aiAnalysis?.product_id === productId
            )) {
                affectedClaims.push(claimId);
                continue;
            }
            
            // Check documents for product references
            if (claim.documents?.reports?.some(report => 
                report.content?.includes(productId) || 
                report.metadata?.products?.includes(productId)
            )) {
                affectedClaims.push(claimId);
            }
        }
        
        return affectedClaims;
    }

    /**
     * Enhance claim with manufacturer database data
     */
    async enhanceClaimWithManufacturerData(claimId, claim) {
        try {
            if (!this.manufacturerDatabaseService) {
                return null;
            }
            
            // Extract roof material information from claim
            const roofMaterials = this.extractRoofMaterialsFromClaim(claim);
            
            if (roofMaterials.length === 0) {
                return null;
            }
            
            // Get manufacturer database analysis
            const manufacturerAnalysis = await this.manufacturerDatabaseService.integrateWithClaimSystem({
                claimId: claimId,
                originalProducts: roofMaterials,
                propertyInfo: {
                    address: claim.property.address,
                    square_footage: claim.property.squareFootage,
                    roof_age: this.calculateRoofAge(claim)
                }
            });
            
            // Store manufacturer data in claim
            claim.manufacturerData = {
                analysis: manufacturerAnalysis,
                lastUpdated: new Date().toISOString(),
                productsAnalyzed: manufacturerAnalysis.products_analyzed,
                discontinuationRisk: this.assessDiscontinuationRisk(manufacturerAnalysis),
                priceImpactSummary: this.calculatePriceImpactSummary(manufacturerAnalysis)
            };
            
            // Add manufacturer insights to claim
            if (manufacturerAnalysis.total_impact_score > 0.7) {
                await this.addCommunication(claimId, {
                    type: 'note',
                    direction: 'internal',
                    subject: 'Manufacturer Database Analysis - High Impact Detected',
                    content: this.formatManufacturerAnalysisReport(manufacturerAnalysis),
                    tags: ['manufacturer-analysis', 'high-impact'],
                    importance: 'high',
                    aiAnalysis: manufacturerAnalysis
                });
            }
            
            return manufacturerAnalysis;
            
        } catch (error) {
            console.error('❌ Error enhancing claim with manufacturer data:', error);
            return null;
        }
    }

    /**
     * Generate comprehensive manufacturer analysis for a claim
     */
    async generateManufacturerAnalysisForClaim(claimId) {
        try {
            const claim = this.claims.get(claimId);
            if (!claim || !this.manufacturerDatabaseService) {
                return null;
            }
            
            const roofMaterials = this.extractRoofMaterialsFromClaim(claim);
            const analysis = {
                claimId: claimId,
                generatedAt: new Date().toISOString(),
                products: [],
                overallImpact: {
                    discontinuation_risk: 'low',
                    price_impact: 'minimal',
                    alternatives_available: true,
                    settlement_adjustment_needed: false
                },
                recommendations: []
            };
            
            for (const material of roofMaterials) {
                try {
                    // Search for the product in manufacturer database
                    const searchResults = await this.manufacturerDatabaseService.searchProducts({
                        query: material.name,
                        manufacturer: material.manufacturer,
                        color: material.color,
                        include_discontinued: true,
                        limit: 1
                    });
                    
                    if (searchResults.products.length > 0) {
                        const product = searchResults.products[0];
                        const productAnalysis = {
                            originalMaterial: material,
                            databaseProduct: product,
                            status: product.status,
                            analysis: {}
                        };
                        
                        if (product.status === 'discontinued') {
                            // Get alternatives and price impact
                            const alternatives = await this.manufacturerDatabaseService.findAlternativeProducts(product.id);
                            productAnalysis.analysis = {
                                discontinuation_date: product.discontinuation_date,
                                alternatives: alternatives.alternatives,
                                price_impact: alternatives.analysis.price_impact_range,
                                settlement_impact: this.calculateSettlementImpact(alternatives)
                            };
                            
                            analysis.overallImpact.discontinuation_risk = 'high';
                            if (alternatives.alternatives.length === 0) {
                                analysis.overallImpact.alternatives_available = false;
                                analysis.recommendations.push('Critical: No suitable alternatives found for discontinued product');
                            }
                        }
                        
                        analysis.products.push(productAnalysis);
                    }
                } catch (error) {
                    console.error(`Error analyzing product ${material.name}:`, error);
                }
            }
            
            // Generate overall recommendations
            analysis.recommendations.push(...this.generateManufacturerRecommendations(analysis));
            
            return analysis;
            
        } catch (error) {
            console.error('❌ Error generating manufacturer analysis:', error);
            return null;
        }
    }

    /**
     * Extract roof material information from claim
     */
    extractRoofMaterialsFromClaim(claim) {
        const materials = [];
        
        // Extract from damage description
        if (claim.damage.description) {
            const materialMatches = this.extractMaterialsFromText(claim.damage.description);
            materials.push(...materialMatches);
        }
        
        // Extract from documents
        if (claim.documents?.reports) {
            claim.documents.reports.forEach(report => {
                if (report.content) {
                    const materialMatches = this.extractMaterialsFromText(report.content);
                    materials.push(...materialMatches);
                }
            });
        }
        
        // Extract from property information
        if (claim.property.roofType) {
            materials.push({
                type: 'shingle',
                name: claim.property.roofType,
                manufacturer: 'unknown',
                color: 'unknown',
                source: 'property_info'
            });
        }
        
        // Remove duplicates
        return this.removeDuplicateMaterials(materials);
    }

    /**
     * Extract material information from text using pattern matching
     */
    extractMaterialsFromText(text) {
        const materials = [];
        const lowerText = text.toLowerCase();
        
        // Common shingle patterns
        const shinglePatterns = [
            /(\w+)\s+(duration|timberline|landmark|heritage|dynasty)\s+(\w+)/g,
            /(\w+\s+corning|gaf|certainteed|tamko|malarkey|atlas|iko)\s+(\w+)/g,
            /(architectural|dimensional|3-tab|luxury)\s+shingles?\s+(\w+)/g
        ];
        
        shinglePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(lowerText)) !== null) {
                materials.push({
                    type: 'shingle',
                    name: match[0],
                    manufacturer: this.identifyManufacturer(match[0]),
                    color: this.extractColor(match[0]),
                    source: 'text_extraction'
                });
            }
        });
        
        return materials;
    }

    /**
     * Calculate roof age from claim data
     */
    calculateRoofAge(claim) {
        if (claim.property.yearBuilt) {
            return new Date().getFullYear() - claim.property.yearBuilt;
        }
        return null;
    }

    /**
     * Assess discontinuation risk from manufacturer analysis
     */
    assessDiscontinuationRisk(manufacturerAnalysis) {
        if (!manufacturerAnalysis.products_analyzed || manufacturerAnalysis.products_analyzed.length === 0) {
            return 'unknown';
        }
        
        const discontinuedProducts = manufacturerAnalysis.products_analyzed.filter(
            p => p.status === 'discontinued'
        );
        
        if (discontinuedProducts.length === 0) return 'low';
        if (discontinuedProducts.length / manufacturerAnalysis.products_analyzed.length > 0.5) return 'high';
        return 'medium';
    }

    /**
     * Calculate price impact summary
     */
    calculatePriceImpactSummary(manufacturerAnalysis) {
        if (!manufacturerAnalysis.products_analyzed) {
            return { total_impact: 0, impact_level: 'minimal' };
        }
        
        let totalImpact = 0;
        let significantImpacts = 0;
        
        manufacturerAnalysis.products_analyzed.forEach(product => {
            if (product.analysis?.price_impact?.percentage_change) {
                const impact = Math.abs(parseFloat(product.analysis.price_impact.percentage_change));
                totalImpact += impact;
                if (impact > 15) significantImpacts++;
            }
        });
        
        const averageImpact = totalImpact / manufacturerAnalysis.products_analyzed.length;
        
        return {
            total_impact: totalImpact,
            average_impact: averageImpact,
            significant_impacts: significantImpacts,
            impact_level: averageImpact > 25 ? 'high' : averageImpact > 10 ? 'medium' : 'low'
        };
    }

    /**
     * Format manufacturer analysis into readable report
     */
    formatManufacturerAnalysisReport(analysis) {
        let report = 'MANUFACTURER DATABASE ANALYSIS REPORT\n\n';
        
        report += `Claim ID: ${analysis.claimId}\n`;
        report += `Products Analyzed: ${analysis.products_analyzed.length}\n`;
        report += `Total Impact Score: ${(analysis.total_impact_score * 100).toFixed(1)}%\n\n`;
        
        analysis.products_analyzed.forEach((product, index) => {
            report += `PRODUCT ${index + 1}: ${product.original_product.name}\n`;
            report += `Status: ${product.status.toUpperCase()}\n`;
            
            if (product.status === 'discontinued') {
                report += `Discontinuation Impact: ${product.analysis.discontinuation.impact.impact_level.toUpperCase()}\n`;
                report += `Alternatives Available: ${product.analysis.alternatives.alternatives.length}\n`;
                
                if (product.analysis.price_impact) {
                    report += `Price Impact: ${product.analysis.price_impact.price_analysis.percentage_change.toFixed(1)}%\n`;
                }
            }
            
            report += `Recommendations:\n`;
            product.recommendations.forEach(rec => {
                report += `- ${rec}\n`;
            });
            report += '\n';
        });
        
        return report;
    }

    /**
     * Calculate settlement impact from alternatives analysis
     */
    calculateSettlementImpact(alternatives) {
        if (!alternatives.alternatives || alternatives.alternatives.length === 0) {
            return { impact: 'extreme', reason: 'no_alternatives' };
        }
        
        const bestAlternative = alternatives.alternatives[0];
        const priceImpact = Math.abs(bestAlternative.price_difference || 0);
        
        if (priceImpact > 50) return { impact: 'extreme', reason: 'high_cost_increase' };
        if (priceImpact > 25) return { impact: 'high', reason: 'significant_cost_increase' };
        if (priceImpact > 10) return { impact: 'medium', reason: 'moderate_cost_increase' };
        return { impact: 'low', reason: 'minimal_cost_increase' };
    }

    /**
     * Generate manufacturer-specific recommendations
     */
    generateManufacturerRecommendations(analysis) {
        const recommendations = [];
        
        if (analysis.overallImpact.discontinuation_risk === 'high') {
            recommendations.push('HIGH PRIORITY: Multiple discontinued products detected - immediate action required');
            recommendations.push('Document all product discontinuations in claim file');
            recommendations.push('Negotiate settlement adjustment with insurance adjuster');
        }
        
        if (!analysis.overallImpact.alternatives_available) {
            recommendations.push('CRITICAL: No suitable alternatives found - may require custom solution');
            recommendations.push('Consider contacting manufacturer directly for remaining stock');
        }
        
        if (analysis.overallImpact.price_impact === 'high') {
            recommendations.push('Significant price increases detected - review claim settlement amount');
            recommendations.push('Prepare documentation for supplemental claim if necessary');
        }
        
        return recommendations;
    }

    /**
     * Helper methods for material extraction
     */
    identifyManufacturer(productText) {
        const manufacturers = {
            'owens corning': ['owens', 'corning', 'duration', 'oakridge'],
            'gaf': ['gaf', 'timberline', 'grand sequoia', 'camelot'],
            'certainteed': ['certainteed', 'landmark', 'northgate', 'presidential'],
            'tamko': ['tamko', 'heritage', 'titan'],
            'malarkey': ['malarkey', 'vista', 'legacy'],
            'atlas': ['atlas', 'pinnacle', 'stratamax'],
            'iko': ['iko', 'dynasty', 'cambridge']
        };
        
        const lowerText = productText.toLowerCase();
        
        for (const [manufacturer, keywords] of Object.entries(manufacturers)) {
            if (keywords.some(keyword => lowerText.includes(keyword))) {
                return manufacturer;
            }
        }
        
        return 'unknown';
    }

    extractColor(productText) {
        const colors = [
            'charcoal', 'weathered wood', 'driftwood', 'onyx black', 'storm cloud',
            'brown', 'gray', 'black', 'blue', 'green', 'red', 'white', 'tan'
        ];
        
        const lowerText = productText.toLowerCase();
        
        for (const color of colors) {
            if (lowerText.includes(color)) {
                return color;
            }
        }
        
        return 'unknown';
    }

    removeDuplicateMaterials(materials) {
        const unique = new Map();
        
        materials.forEach(material => {
            const key = `${material.name}-${material.manufacturer}-${material.color}`;
            if (!unique.has(key)) {
                unique.set(key, material);
            }
        });
        
        return Array.from(unique.values());
    }

    /**
     * Get manufacturer analysis summary for dashboard
     */
    getManufacturerAnalysisSummary() {
        const summary = {
            total_claims_analyzed: 0,
            claims_with_discontinued_products: 0,
            average_impact_score: 0,
            high_impact_claims: 0,
            active_discontinuation_alerts: this.productDiscontinuationAlerts.size,
            top_discontinued_products: [],
            recommendations_summary: {
                critical_actions_needed: 0,
                settlement_adjustments_needed: 0,
                alternatives_research_needed: 0
            }
        };
        
        let totalImpactScore = 0;
        
        for (const [claimId, claim] of this.claims) {
            if (claim.manufacturerData) {
                summary.total_claims_analyzed++;
                
                if (claim.manufacturerData.discontinuationRisk === 'high') {
                    summary.claims_with_discontinued_products++;
                }
                
                const impactScore = claim.manufacturerData.analysis?.total_impact_score || 0;
                totalImpactScore += impactScore;
                
                if (impactScore > 0.7) {
                    summary.high_impact_claims++;
                }
            }
        }
        
        if (summary.total_claims_analyzed > 0) {
            summary.average_impact_score = totalImpactScore / summary.total_claims_analyzed;
        }
        
        return summary;
    }
}