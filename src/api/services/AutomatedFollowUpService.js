import { EventEmitter } from 'events';
import cron from 'node-cron';

/**
 * Automated Follow-Up and Scheduling Service for Roof-ER
 * Intelligent automation for claim follow-ups, reminders, and scheduling
 */
export class AutomatedFollowUpService extends EventEmitter {
    constructor() {
        super();
        this.followUps = new Map();
        this.scheduledTasks = new Map();
        this.reminderTemplates = new Map();
        this.escalationRules = new Map();
        this.communicationHistory = new Map();
        
        this.followUpTypes = {
            claim_submission: { 
                defaultDelay: 3, 
                maxAttempts: 5, 
                escalationThreshold: 7,
                priority: 'high'
            },
            adjuster_response: { 
                defaultDelay: 5, 
                maxAttempts: 3, 
                escalationThreshold: 10,
                priority: 'medium'
            },
            inspection_scheduling: { 
                defaultDelay: 2, 
                maxAttempts: 4, 
                escalationThreshold: 5,
                priority: 'high'
            },
            payment_follow_up: { 
                defaultDelay: 7, 
                maxAttempts: 3, 
                escalationThreshold: 14,
                priority: 'critical'
            },
            supplement_review: { 
                defaultDelay: 4, 
                maxAttempts: 3, 
                escalationThreshold: 8,
                priority: 'medium'
            },
            final_inspection: { 
                defaultDelay: 1, 
                maxAttempts: 2, 
                escalationThreshold: 3,
                priority: 'high'
            }
        };
        
        this.communicationChannels = {
            email: { enabled: true, cost: 0, effectiveness: 0.75 },
            sms: { enabled: true, cost: 0.05, effectiveness: 0.85 },
            phone: { enabled: true, cost: 2.50, effectiveness: 0.90 },
            automated_call: { enabled: false, cost: 0.25, effectiveness: 0.65 },
            letter: { enabled: false, cost: 0.75, effectiveness: 0.60 }
        };
        
        this.timeZones = new Map();
        this.businessHours = {
            start: '08:00',
            end: '18:00',
            timeZone: 'America/New_York',
            excludeWeekends: true,
            excludeHolidays: true
        };
        
        this.analytics = {
            followUpsSent: 0,
            responsesReceived: 0,
            escalationTriggered: 0,
            averageResponseTime: 0,
            channelEffectiveness: new Map(),
            templatePerformance: new Map()
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            console.log('⏰ Initializing Automated Follow-Up Service...');
            
            // Setup reminder templates
            this.setupReminderTemplates();
            
            // Setup escalation rules
            this.setupEscalationRules();
            
            // Start cron jobs for automated processing
            this.startScheduledTasks();
            
            // Load business hours and time zone configurations
            this.loadBusinessConfigurations();
            
            console.log('✅ Automated Follow-Up Service ready');
        } catch (error) {
            console.error('❌ Failed to initialize follow-up service:', error);
            throw error;
        }
    }

    /**
     * Schedule follow-up for a claim
     */
    async scheduleFollowUp(followUpData) {
        try {
            const followUpId = this.generateFollowUpId();
            
            const followUp = {
                id: followUpId,
                claimId: followUpData.claimId,
                type: followUpData.type,
                priority: followUpData.priority || this.followUpTypes[followUpData.type]?.priority || 'medium',
                
                // Scheduling Information
                scheduledDate: followUpData.scheduledDate || this.calculateNextFollowUpDate(followUpData.type),
                created: new Date().toISOString(),
                lastAttempt: null,
                nextAttempt: null,
                
                // Attempt Tracking
                attempts: 0,
                maxAttempts: followUpData.maxAttempts || this.followUpTypes[followUpData.type]?.maxAttempts || 3,
                
                // Contact Information
                contacts: followUpData.contacts || [],
                preferredChannel: followUpData.preferredChannel || 'email',
                fallbackChannels: followUpData.fallbackChannels || ['sms', 'phone'],
                
                // Content and Templates
                template: followUpData.template || this.getDefaultTemplate(followUpData.type),
                customMessage: followUpData.customMessage || '',
                variables: followUpData.variables || {},
                
                // Status and Tracking
                status: 'scheduled',
                responses: [],
                escalationLevel: 0,
                
                // Automation Rules
                autoEscalate: followUpData.autoEscalate !== false,
                escalationThreshold: followUpData.escalationThreshold || this.followUpTypes[followUpData.type]?.escalationThreshold || 7,
                
                // Analytics
                analytics: {
                    channelsUsed: [],
                    responseTime: null,
                    outcome: null,
                    cost: 0
                },
                
                // Configuration
                businessHoursOnly: followUpData.businessHoursOnly !== false,
                timeZone: followUpData.timeZone || this.businessHours.timeZone,
                excludeWeekends: followUpData.excludeWeekends !== false,
                
                // Metadata
                metadata: followUpData.metadata || {}
            };
            
            // Store follow-up
            this.followUps.set(followUpId, followUp);
            
            // Schedule the actual task
            await this.scheduleTask(followUp);
            
            // Log creation
            this.logFollowUpEvent(followUpId, 'scheduled', 'Follow-up scheduled');
            
            // Emit event
            this.emit('followUpScheduled', { followUpId, followUp });
            
            console.log(`⏰ Scheduled follow-up: ${followUpId} for claim ${followUpData.claimId}`);
            
            return {
                followUpId,
                followUp,
                scheduledDate: followUp.scheduledDate,
                estimatedDelivery: this.estimateDeliveryTime(followUp)
            };

        } catch (error) {
            console.error('❌ Error scheduling follow-up:', error);
            throw new Error(`Follow-up scheduling failed: ${error.message}`);
        }
    }

    /**
     * Execute follow-up communication
     */
    async executeFollowUp(followUpId) {
        try {
            const followUp = this.followUps.get(followUpId);
            if (!followUp) {
                throw new Error('Follow-up not found');
            }
            
            if (followUp.status !== 'scheduled' && followUp.status !== 'retry') {
                throw new Error(`Cannot execute follow-up in status: ${followUp.status}`);
            }
            
            console.log(`📤 Executing follow-up: ${followUpId}`);
            
            // Check if within business hours
            if (followUp.businessHoursOnly && !this.isWithinBusinessHours(followUp.timeZone)) {
                await this.rescheduleToBusinessHours(followUp);
                return { rescheduled: true, reason: 'Outside business hours' };
            }
            
            // Increment attempt counter
            followUp.attempts++;
            followUp.lastAttempt = new Date().toISOString();
            
            // Determine communication channel
            const channel = this.selectCommunicationChannel(followUp);
            
            // Generate personalized content
            const content = await this.generateFollowUpContent(followUp);
            
            // Send communication
            const result = await this.sendCommunication(followUp, channel, content);
            
            // Update follow-up based on result
            await this.processFollowUpResult(followUp, result);
            
            // Schedule next attempt if needed
            if (followUp.status === 'retry' && followUp.attempts < followUp.maxAttempts) {
                await this.scheduleRetry(followUp);
            }
            
            // Check for escalation
            if (this.shouldEscalate(followUp)) {
                await this.escalateFollowUp(followUp);
            }
            
            // Update analytics
            this.updateAnalytics(followUp, result);
            
            // Log execution
            this.logFollowUpEvent(followUpId, 'executed', `Follow-up sent via ${channel}`, {
                channel,
                attempt: followUp.attempts,
                result: result.status
            });
            
            // Emit event
            this.emit('followUpExecuted', { followUpId, followUp, result });
            
            return {
                followUpId,
                status: followUp.status,
                channel,
                attempt: followUp.attempts,
                result,
                nextAttempt: followUp.nextAttempt
            };

        } catch (error) {
            console.error('❌ Error executing follow-up:', error);
            
            // Mark as failed and potentially reschedule
            const followUp = this.followUps.get(followUpId);
            if (followUp) {
                followUp.status = 'failed';
                this.logFollowUpEvent(followUpId, 'failed', error.message);
            }
            
            throw new Error(`Follow-up execution failed: ${error.message}`);
        }
    }

    /**
     * Process response to follow-up
     */
    async recordResponse(followUpId, responseData) {
        try {
            const followUp = this.followUps.get(followUpId);
            if (!followUp) {
                throw new Error('Follow-up not found');
            }
            
            const response = {
                id: this.generateResponseId(),
                timestamp: new Date().toISOString(),
                channel: responseData.channel || 'email',
                content: responseData.content || '',
                sentiment: responseData.sentiment || 'neutral',
                actionRequired: responseData.actionRequired || false,
                category: responseData.category || 'acknowledgment',
                metadata: responseData.metadata || {}
            };
            
            // Add response to follow-up
            followUp.responses.push(response);
            
            // Update follow-up status
            followUp.status = 'responded';
            
            // Calculate response time
            const responseTime = this.calculateResponseTime(followUp, response);
            followUp.analytics.responseTime = responseTime;
            followUp.analytics.outcome = 'success';
            
            // Update analytics
            this.analytics.responsesReceived++;
            this.updateChannelEffectiveness(followUp.preferredChannel, true);
            
            // Cancel any pending retries
            await this.cancelPendingRetries(followUp);
            
            // Process any required actions from the response
            if (response.actionRequired) {
                await this.processResponseActions(followUp, response);
            }
            
            // Log response
            this.logFollowUpEvent(followUpId, 'response_received', 'Response received', {
                channel: response.channel,
                responseTime,
                category: response.category
            });
            
            // Emit event
            this.emit('responseReceived', { followUpId, followUp, response });
            
            return {
                followUpId,
                responseId: response.id,
                responseTime,
                followUpCompleted: true
            };

        } catch (error) {
            console.error('❌ Error recording response:', error);
            throw new Error(`Response recording failed: ${error.message}`);
        }
    }

    /**
     * Get follow-up dashboard data
     */
    async getFollowUpDashboard(filters = {}) {
        try {
            const allFollowUps = Array.from(this.followUps.values());
            const filteredFollowUps = this.applyFollowUpFilters(allFollowUps, filters);
            
            // Generate dashboard metrics
            const metrics = this.calculateFollowUpMetrics(filteredFollowUps);
            
            // Get status distribution
            const statusDistribution = this.getFollowUpStatusDistribution(filteredFollowUps);
            
            // Get upcoming follow-ups
            const upcoming = this.getUpcomingFollowUps(24); // Next 24 hours
            
            // Get overdue follow-ups
            const overdue = this.getOverdueFollowUps();
            
            // Get performance analytics
            const performance = this.getFollowUpPerformance();
            
            // Get channel effectiveness
            const channelStats = this.getChannelEffectiveness();
            
            return {
                summary: {
                    totalFollowUps: filteredFollowUps.length,
                    activeFollowUps: filteredFollowUps.filter(f => f.status === 'scheduled').length,
                    completedFollowUps: filteredFollowUps.filter(f => f.status === 'responded').length,
                    overdueFollowUps: overdue.length,
                    responseRate: metrics.responseRate,
                    averageResponseTime: metrics.averageResponseTime
                },
                metrics,
                statusDistribution,
                upcoming: upcoming.slice(0, 10), // Next 10 follow-ups
                overdue: overdue.slice(0, 10), // Top 10 overdue
                performance,
                channelStats,
                recentActivity: this.getRecentFollowUpActivity(20),
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error getting follow-up dashboard:', error);
            throw new Error(`Dashboard retrieval failed: ${error.message}`);
        }
    }

    /**
     * Bulk schedule follow-ups
     */
    async bulkScheduleFollowUps(followUpRequests) {
        try {
            const results = [];
            
            for (const request of followUpRequests) {
                try {
                    const result = await this.scheduleFollowUp(request);
                    results.push({ success: true, ...result });
                } catch (error) {
                    results.push({ 
                        success: false, 
                        error: error.message, 
                        claimId: request.claimId 
                    });
                }
            }
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            console.log(`📊 Bulk scheduled ${successful} follow-ups, ${failed} failed`);
            
            return {
                total: followUpRequests.length,
                successful,
                failed,
                results
            };

        } catch (error) {
            console.error('❌ Error in bulk scheduling:', error);
            throw new Error(`Bulk scheduling failed: ${error.message}`);
        }
    }

    // Helper Methods

    calculateNextFollowUpDate(type, lastAttempt = null) {
        const followUpConfig = this.followUpTypes[type];
        const delayDays = followUpConfig?.defaultDelay || 3;
        
        const baseDate = lastAttempt ? new Date(lastAttempt) : new Date();
        const followUpDate = new Date(baseDate);
        followUpDate.setDate(followUpDate.getDate() + delayDays);
        
        // Adjust for business hours if needed
        return this.adjustToBusinessHours(followUpDate).toISOString();
    }

    adjustToBusinessHours(date) {
        const adjusted = new Date(date);
        
        // Skip weekends
        while (adjusted.getDay() === 0 || adjusted.getDay() === 6) {
            adjusted.setDate(adjusted.getDate() + 1);
        }
        
        // Adjust time to business hours
        const hour = adjusted.getHours();
        if (hour < 8) {
            adjusted.setHours(8, 0, 0, 0);
        } else if (hour >= 18) {
            adjusted.setDate(adjusted.getDate() + 1);
            adjusted.setHours(8, 0, 0, 0);
            
            // Check if next day is weekend
            while (adjusted.getDay() === 0 || adjusted.getDay() === 6) {
                adjusted.setDate(adjusted.getDate() + 1);
            }
        }
        
        return adjusted;
    }

    isWithinBusinessHours(timeZone) {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        
        // Check if weekend
        if (this.businessHours.excludeWeekends && (day === 0 || day === 6)) {
            return false;
        }
        
        // Check if within business hours
        const startHour = parseInt(this.businessHours.start.split(':')[0]);
        const endHour = parseInt(this.businessHours.end.split(':')[0]);
        
        return hour >= startHour && hour < endHour;
    }

    selectCommunicationChannel(followUp) {
        // Start with preferred channel
        let channel = followUp.preferredChannel;
        
        // If this is a retry, try fallback channels
        if (followUp.attempts > 1 && followUp.fallbackChannels.length > 0) {
            const fallbackIndex = Math.min(followUp.attempts - 2, followUp.fallbackChannels.length - 1);
            channel = followUp.fallbackChannels[fallbackIndex];
        }
        
        // Ensure channel is enabled
        if (!this.communicationChannels[channel]?.enabled) {
            channel = Object.keys(this.communicationChannels).find(c => this.communicationChannels[c].enabled) || 'email';
        }
        
        return channel;
    }

    async generateFollowUpContent(followUp) {
        try {
            const template = this.reminderTemplates.get(followUp.template);
            if (!template) {
                throw new Error(`Template not found: ${followUp.template}`);
            }
            
            // Replace variables in template
            let content = template.content;
            
            // Replace standard variables
            Object.entries(followUp.variables).forEach(([key, value]) => {
                const placeholder = `{{${key}}}`;
                content = content.replace(new RegExp(placeholder, 'g'), value);
            });
            
            // Replace system variables
            content = content.replace(/{{date}}/g, new Date().toLocaleDateString());
            content = content.replace(/{{time}}/g, new Date().toLocaleTimeString());
            content = content.replace(/{{attempt}}/g, followUp.attempts.toString());
            
            // Add custom message if provided
            if (followUp.customMessage) {
                content += '\n\n' + followUp.customMessage;
            }
            
            return {
                subject: this.processTemplate(template.subject, followUp.variables),
                content,
                format: template.format || 'text',
                attachments: template.attachments || []
            };

        } catch (error) {
            console.error('❌ Error generating follow-up content:', error);
            
            // Return basic content as fallback
            return {
                subject: `Follow-up Required - Claim ${followUp.claimId}`,
                content: `This is a follow-up regarding your claim. Please respond at your earliest convenience.`,
                format: 'text',
                attachments: []
            };
        }
    }

    async sendCommunication(followUp, channel, content) {
        try {
            // Simulate sending communication (in production, integrate with actual services)
            const result = {
                id: this.generateCommunicationId(),
                timestamp: new Date().toISOString(),
                channel,
                status: 'sent',
                deliveryConfirmation: Math.random() > 0.1, // 90% delivery success rate
                cost: this.communicationChannels[channel]?.cost || 0,
                metadata: {
                    subject: content.subject,
                    contentLength: content.content.length
                }
            };
            
            // Track channel usage
            followUp.analytics.channelsUsed.push({
                channel,
                timestamp: result.timestamp,
                cost: result.cost
            });
            
            followUp.analytics.cost += result.cost;
            
            // Update analytics
            this.analytics.followUpsSent++;
            
            // Simulate delivery delay
            setTimeout(() => {
                if (result.deliveryConfirmation) {
                    this.emit('communicationDelivered', { 
                        followUpId: followUp.id, 
                        communicationId: result.id 
                    });
                } else {
                    this.emit('communicationFailed', { 
                        followUpId: followUp.id, 
                        communicationId: result.id,
                        reason: 'Delivery failed'
                    });
                }
            }, 1000);
            
            return result;

        } catch (error) {
            console.error('❌ Error sending communication:', error);
            return {
                id: null,
                timestamp: new Date().toISOString(),
                channel,
                status: 'failed',
                error: error.message,
                cost: 0
            };
        }
    }

    async processFollowUpResult(followUp, result) {
        if (result.status === 'sent' && result.deliveryConfirmation) {
            followUp.status = 'sent';
            
            // Schedule response timeout check
            const timeoutHours = this.getResponseTimeoutHours(followUp.type);
            followUp.nextAttempt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000).toISOString();
            
        } else if (result.status === 'failed') {
            followUp.status = 'retry';
            
            // Schedule retry
            const retryDelay = this.getRetryDelay(followUp.attempts);
            followUp.nextAttempt = new Date(Date.now() + retryDelay * 60 * 60 * 1000).toISOString();
            
        } else {
            followUp.status = 'sent';
        }
    }

    shouldEscalate(followUp) {
        if (!followUp.autoEscalate) return false;
        
        const daysSinceScheduled = Math.floor(
            (new Date() - new Date(followUp.created)) / (1000 * 60 * 60 * 24)
        );
        
        return daysSinceScheduled >= followUp.escalationThreshold ||
               followUp.attempts >= followUp.maxAttempts;
    }

    async escalateFollowUp(followUp) {
        followUp.escalationLevel++;
        followUp.status = 'escalated';
        
        // Apply escalation rules
        const escalationRule = this.escalationRules.get(followUp.type);
        if (escalationRule) {
            await this.applyEscalationRule(followUp, escalationRule);
        }
        
        // Update analytics
        this.analytics.escalationTriggered++;
        
        // Log escalation
        this.logFollowUpEvent(followUp.id, 'escalated', 'Follow-up escalated', {
            escalationLevel: followUp.escalationLevel,
            daysSinceCreated: Math.floor((new Date() - new Date(followUp.created)) / (1000 * 60 * 60 * 24))
        });
        
        // Emit event
        this.emit('followUpEscalated', { followUpId: followUp.id, followUp });
    }

    async scheduleTask(followUp) {
        const taskId = `${followUp.id}-${followUp.attempts}`;
        const scheduledDate = new Date(followUp.scheduledDate);
        
        // Remove any existing task for this follow-up
        this.cancelScheduledTask(followUp.id);
        
        // Schedule new task
        const task = setTimeout(async () => {
            try {
                await this.executeFollowUp(followUp.id);
            } catch (error) {
                console.error(`❌ Scheduled task execution failed for ${followUp.id}:`, error);
            }
        }, scheduledDate.getTime() - Date.now());
        
        this.scheduledTasks.set(followUp.id, {
            taskId,
            task,
            scheduledDate: scheduledDate.toISOString()
        });
    }

    cancelScheduledTask(followUpId) {
        const scheduledTask = this.scheduledTasks.get(followUpId);
        if (scheduledTask) {
            clearTimeout(scheduledTask.task);
            this.scheduledTasks.delete(followUpId);
        }
    }

    calculateFollowUpMetrics(followUps) {
        const total = followUps.length;
        if (total === 0) return { responseRate: 0, averageResponseTime: 0 };
        
        const responded = followUps.filter(f => f.status === 'responded').length;
        const responseRate = Math.round((responded / total) * 100);
        
        const responseTimes = followUps
            .filter(f => f.analytics.responseTime)
            .map(f => f.analytics.responseTime);
        
        const averageResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
            : 0;
        
        return {
            responseRate,
            averageResponseTime,
            totalSent: this.analytics.followUpsSent,
            totalResponses: this.analytics.responsesReceived,
            escalationRate: Math.round((this.analytics.escalationTriggered / total) * 100)
        };
    }

    getUpcomingFollowUps(hours = 24) {
        const cutoff = new Date(Date.now() + hours * 60 * 60 * 1000);
        
        return Array.from(this.followUps.values())
            .filter(f => f.status === 'scheduled' && new Date(f.scheduledDate) <= cutoff)
            .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    }

    getOverdueFollowUps() {
        const now = new Date();
        
        return Array.from(this.followUps.values())
            .filter(f => f.status === 'scheduled' && new Date(f.scheduledDate) < now)
            .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    }

    setupReminderTemplates() {
        this.reminderTemplates.set('claim_submission_follow_up', {
            subject: 'Follow-up: Claim {{claimId}} Submission Status',
            content: `Dear {{adjusterName}},

I hope this message finds you well. I am following up regarding the insurance claim I submitted for {{propertyAddress}} on {{submissionDate}}.

Claim Details:
- Claim Number: {{claimId}}
- Property: {{propertyAddress}}
- Date of Loss: {{dateOfLoss}}
- Estimated Damage: ${{estimatedValue}}

Could you please provide an update on the current status of this claim? I am particularly interested in:
- Current review stage
- Expected timeline for resolution
- Any additional documentation needed

I appreciate your time and look forward to your response.

Best regards,
{{senderName}}
{{companyName}}`,
            format: 'text'
        });

        this.reminderTemplates.set('inspection_scheduling', {
            subject: 'Inspection Scheduling Request - Claim {{claimId}}',
            content: `Hello {{adjusterName}},

I wanted to follow up on scheduling the property inspection for claim {{claimId}} at {{propertyAddress}}.

The property owner is available for inspection on the following dates and times:
{{availableDates}}

Please let me know which option works best for your schedule, or if you need alternative dates.

The property owner can be reached at:
- Phone: {{ownerPhone}}
- Email: {{ownerEmail}}

Thank you for your assistance in moving this claim forward.

Best regards,
{{senderName}}`,
            format: 'text'
        });

        this.reminderTemplates.set('payment_follow_up', {
            subject: 'Payment Status Inquiry - Claim {{claimId}}',
            content: `Dear {{adjusterName}},

I am writing to inquire about the payment status for the approved claim {{claimId}}.

Claim Summary:
- Approved Amount: ${{approvedAmount}}
- Approval Date: {{approvalDate}}
- Payment Method: {{paymentMethod}}

According to our records, payment was expected by {{expectedPaymentDate}}. Could you please provide an update on the payment status and expected disbursement timeline?

If there are any issues or additional requirements needed to process the payment, please let me know immediately so we can address them promptly.

Thank you for your attention to this matter.

Best regards,
{{senderName}}`,
            format: 'text'
        });
    }

    setupEscalationRules() {
        this.escalationRules.set('claim_submission', {
            level1: {
                action: 'supervisor_notification',
                delay: 7,
                message: 'Claim submission requires supervisor attention'
            },
            level2: {
                action: 'management_escalation',
                delay: 14,
                message: 'Claim submission escalated to management'
            }
        });

        this.escalationRules.set('payment_follow_up', {
            level1: {
                action: 'urgent_notification',
                delay: 3,
                message: 'Payment follow-up requires urgent attention'
            },
            level2: {
                action: 'legal_review',
                delay: 7,
                message: 'Payment issue escalated for legal review'
            }
        });
    }

    startScheduledTasks() {
        // Check for due follow-ups every 15 minutes
        cron.schedule('*/15 * * * *', () => {
            this.processDueFollowUps();
        });
        
        // Daily cleanup of completed follow-ups
        cron.schedule('0 2 * * *', () => {
            this.cleanupCompletedFollowUps();
        });
        
        // Weekly analytics update
        cron.schedule('0 0 * * 0', () => {
            this.updateWeeklyAnalytics();
        });
    }

    async processDueFollowUps() {
        const now = new Date();
        const dueFollowUps = Array.from(this.followUps.values())
            .filter(f => f.status === 'scheduled' && new Date(f.scheduledDate) <= now);
        
        for (const followUp of dueFollowUps) {
            try {
                await this.executeFollowUp(followUp.id);
            } catch (error) {
                console.error(`❌ Error processing due follow-up ${followUp.id}:`, error);
            }
        }
    }

    // Utility methods
    processTemplate(template, variables) {
        let processed = template;
        Object.entries(variables).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            processed = processed.replace(new RegExp(placeholder, 'g'), value);
        });
        return processed;
    }

    generateFollowUpId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `FU-${timestamp}-${random}`.toUpperCase();
    }

    generateResponseId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        return `RSP-${timestamp}-${random}`.toUpperCase();
    }

    generateCommunicationId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        return `COM-${timestamp}-${random}`.toUpperCase();
    }

    logFollowUpEvent(followUpId, eventType, description, metadata = {}) {
        console.log(`[${new Date().toISOString()}] ${followUpId}: ${eventType} - ${description}`, metadata);
    }

    // Additional utility methods would be implemented here...
    getDefaultTemplate(type) {
        const templateMap = {
            claim_submission: 'claim_submission_follow_up',
            inspection_scheduling: 'inspection_scheduling',
            payment_follow_up: 'payment_follow_up'
        };
        
        return templateMap[type] || 'claim_submission_follow_up';
    }

    calculateResponseTime(followUp, response) {
        const sentTime = new Date(followUp.lastAttempt);
        const responseTime = new Date(response.timestamp);
        return Math.floor((responseTime - sentTime) / (1000 * 60 * 60)); // Hours
    }

    updateAnalytics(followUp, result) {
        // Update channel effectiveness
        this.updateChannelEffectiveness(result.channel, result.status === 'sent');
        
        // Update template performance
        this.updateTemplatePerformance(followUp.template, followUp.status === 'responded');
    }

    updateChannelEffectiveness(channel, successful) {
        if (!this.analytics.channelEffectiveness.has(channel)) {
            this.analytics.channelEffectiveness.set(channel, { sent: 0, successful: 0 });
        }
        
        const stats = this.analytics.channelEffectiveness.get(channel);
        stats.sent++;
        if (successful) stats.successful++;
    }

    updateTemplatePerformance(template, successful) {
        if (!this.analytics.templatePerformance.has(template)) {
            this.analytics.templatePerformance.set(template, { used: 0, successful: 0 });
        }
        
        const stats = this.analytics.templatePerformance.get(template);
        stats.used++;
        if (successful) stats.successful++;
    }

    // Public API methods
    getFollowUp(followUpId) {
        return this.followUps.get(followUpId);
    }

    getAllFollowUps() {
        return Array.from(this.followUps.values());
    }

    getFollowUpsByStatus(status) {
        return Array.from(this.followUps.values()).filter(f => f.status === status);
    }

    getFollowUpsByClaim(claimId) {
        return Array.from(this.followUps.values()).filter(f => f.claimId === claimId);
    }

    async cancelFollowUp(followUpId, reason = 'Cancelled by user') {
        const followUp = this.followUps.get(followUpId);
        if (!followUp) {
            throw new Error('Follow-up not found');
        }
        
        followUp.status = 'cancelled';
        this.cancelScheduledTask(followUpId);
        
        this.logFollowUpEvent(followUpId, 'cancelled', reason);
        this.emit('followUpCancelled', { followUpId, followUp, reason });
        
        return { followUpId, status: 'cancelled' };
    }
}