import { EventEmitter } from 'events';

/**
 * Success Analytics Service for Roof-ER
 * Advanced analytics for approval rates, strategy performance, and optimization insights
 */
export class SuccessAnalyticsService extends EventEmitter {
    constructor() {
        super();
        this.analyticsData = new Map();
        this.strategies = new Map();
        this.templates = new Map();
        this.adjusters = new Map();
        this.companies = new Map();
        this.campaigns = new Map();
        this.benchmarks = new Map();
        
        // Performance tracking categories
        this.performanceCategories = {
            approval_rate: { weight: 0.3, name: 'Approval Rate', format: 'percentage' },
            response_time: { weight: 0.2, name: 'Response Time', format: 'days' },
            settlement_ratio: { weight: 0.25, name: 'Settlement Ratio', format: 'percentage' },
            communication_effectiveness: { weight: 0.15, name: 'Communication Effectiveness', format: 'score' },
            time_to_resolution: { weight: 0.1, name: 'Time to Resolution', format: 'days' }
        };
        
        // Strategy effectiveness metrics
        this.strategyMetrics = {
            photo_quality: { impact: 0.8, description: 'High-quality damage photos with annotations' },
            documentation_completeness: { impact: 0.75, description: 'Complete damage documentation' },
            expert_testimony: { impact: 0.85, description: 'Professional roof inspection reports' },
            weather_correlation: { impact: 0.7, description: 'Weather data correlation with damage' },
            building_code_citations: { impact: 0.65, description: 'Relevant building code citations' },
            manufacturer_bulletins: { impact: 0.6, description: 'Manufacturer discontinuation notices' },
            legal_precedents: { impact: 0.55, description: 'Similar case legal precedents' },
            adjuster_relationship: { impact: 0.5, description: 'Positive adjuster relationships' },
            follow_up_consistency: { impact: 0.45, description: 'Consistent follow-up communications' },
            negotiation_timing: { impact: 0.4, description: 'Optimal negotiation timing' }
        };
        
        // Analytics time periods
        this.timePeriods = {
            daily: { days: 1, label: 'Daily' },
            weekly: { days: 7, label: 'Weekly' },
            monthly: { days: 30, label: 'Monthly' },
            quarterly: { days: 90, label: 'Quarterly' },
            yearly: { days: 365, label: 'Yearly' }
        };
        
        this.realTimeMetrics = {
            claims: { processed: 0, approved: 0, denied: 0, pending: 0 },
            revenue: { estimated: 0, approved: 0, collected: 0 },
            performance: { avgApprovalRate: 0, avgResponseTime: 0, avgSettlementRatio: 0 },
            trends: { improving: 0, declining: 0, stable: 0 }
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            console.log('📊 Initializing Success Analytics Service...');
            
            // Setup benchmark data
            this.setupBenchmarks();
            
            // Initialize strategy tracking
            this.initializeStrategyTracking();
            
            // Setup real-time analytics
            this.setupRealTimeAnalytics();
            
            // Start background analytics processing
            this.startAnalyticsProcessing();
            
            console.log('✅ Success Analytics Service ready');
        } catch (error) {
            console.error('❌ Failed to initialize success analytics service:', error);
            throw error;
        }
    }

    /**
     * Track claim outcome and analyze contributing factors
     */
    async trackClaimOutcome(claimId, outcomeData) {
        try {
            const outcome = {
                id: this.generateOutcomeId(),
                claimId,
                timestamp: new Date().toISOString(),
                
                // Outcome details
                result: outcomeData.result, // approved, denied, partial, withdrawn
                approvalAmount: outcomeData.approvalAmount || 0,
                requestedAmount: outcomeData.requestedAmount || 0,
                settlementRatio: outcomeData.approvalAmount && outcomeData.requestedAmount 
                    ? (outcomeData.approvalAmount / outcomeData.requestedAmount) * 100 
                    : 0,
                
                // Timeline metrics
                submissionDate: outcomeData.submissionDate,
                resolutionDate: outcomeData.resolutionDate || new Date().toISOString(),
                processingDays: outcomeData.processingDays || this.calculateProcessingDays(outcomeData),
                responseTime: outcomeData.responseTime || 0,
                
                // Strategy analysis
                strategiesUsed: outcomeData.strategiesUsed || [],
                templatesUsed: outcomeData.templatesUsed || [],
                communicationCount: outcomeData.communicationCount || 0,
                documentationScore: outcomeData.documentationScore || 0,
                
                // Context factors
                adjusterInfo: outcomeData.adjusterInfo || {},
                insuranceCompany: outcomeData.insuranceCompany || '',
                damageType: outcomeData.damageType || '',
                claimValue: outcomeData.requestedAmount || 0,
                
                // Quality metrics
                photoQuality: outcomeData.photoQuality || 0,
                reportCompleteness: outcomeData.reportCompleteness || 0,
                evidenceStrength: outcomeData.evidenceStrength || 0,
                
                // Success factors
                successFactors: this.identifySuccessFactors(outcomeData),
                failureFactors: this.identifyFailureFactors(outcomeData),
                
                // Predictive insights
                predictedOutcome: outcomeData.predictedOutcome || null,
                predictionAccuracy: outcomeData.predictedOutcome 
                    ? this.calculatePredictionAccuracy(outcomeData.predictedOutcome, outcomeData.result)
                    : null
            };
            
            // Store outcome data
            this.analyticsData.set(outcome.id, outcome);
            
            // Update strategy performance
            await this.updateStrategyPerformance(outcome);
            
            // Update template effectiveness
            await this.updateTemplateEffectiveness(outcome);
            
            // Update adjuster analytics
            await this.updateAdjusterAnalytics(outcome);
            
            // Update company analytics
            await this.updateCompanyAnalytics(outcome);
            
            // Update real-time metrics
            this.updateRealTimeMetrics(outcome);
            
            // Generate insights
            const insights = await this.generateOutcomeInsights(outcome);
            
            // Emit analytics event
            this.emit('outcomeTracked', { outcomeId: outcome.id, outcome, insights });
            
            console.log(`📈 Tracked outcome: ${outcome.id} - ${outcome.result}`);
            
            return {
                outcomeId: outcome.id,
                outcome,
                insights,
                performanceImpact: this.calculatePerformanceImpact(outcome)
            };

        } catch (error) {
            console.error('❌ Error tracking claim outcome:', error);
            throw new Error(`Outcome tracking failed: ${error.message}`);
        }
    }

    /**
     * Analyze strategy performance across all claims
     */
    async analyzeStrategyPerformance(filters = {}) {
        try {
            const outcomes = this.getFilteredOutcomes(filters);
            const strategyAnalysis = new Map();
            
            // Analyze each strategy
            Object.keys(this.strategyMetrics).forEach(strategy => {
                const strategyOutcomes = outcomes.filter(outcome => 
                    outcome.strategiesUsed.includes(strategy)
                );
                
                if (strategyOutcomes.length === 0) {
                    strategyAnalysis.set(strategy, {
                        strategy,
                        usage: 0,
                        effectiveness: 0,
                        approvalRate: 0,
                        avgSettlementRatio: 0,
                        avgProcessingTime: 0,
                        recommendation: 'insufficient_data'
                    });
                    return;
                }
                
                const approvedClaims = strategyOutcomes.filter(o => o.result === 'approved').length;
                const totalSettlement = strategyOutcomes.reduce((sum, o) => sum + o.settlementRatio, 0);
                const totalProcessingTime = strategyOutcomes.reduce((sum, o) => sum + o.processingDays, 0);
                
                const analysis = {
                    strategy,
                    usage: strategyOutcomes.length,
                    usagePercentage: Math.round((strategyOutcomes.length / outcomes.length) * 100),
                    effectiveness: this.calculateStrategyEffectiveness(strategyOutcomes),
                    approvalRate: Math.round((approvedClaims / strategyOutcomes.length) * 100),
                    avgSettlementRatio: Math.round(totalSettlement / strategyOutcomes.length),
                    avgProcessingTime: Math.round(totalProcessingTime / strategyOutcomes.length),
                    
                    // Advanced metrics
                    winRate: this.calculateWinRate(strategyOutcomes),
                    valueImpact: this.calculateValueImpact(strategyOutcomes),
                    timeImpact: this.calculateTimeImpact(strategyOutcomes),
                    
                    // Benchmarking
                    vsBaseline: this.compareToBaseline(strategy, strategyOutcomes),
                    ranking: 0, // Will be calculated after all strategies are analyzed
                    
                    // Recommendations
                    recommendation: this.generateStrategyRecommendation(strategy, strategyOutcomes),
                    optimizationTips: this.generateOptimizationTips(strategy, strategyOutcomes)
                };
                
                strategyAnalysis.set(strategy, analysis);
            });
            
            // Rank strategies by effectiveness
            const rankedStrategies = Array.from(strategyAnalysis.values())
                .sort((a, b) => b.effectiveness - a.effectiveness)
                .map((strategy, index) => ({
                    ...strategy,
                    ranking: index + 1
                }));
            
            // Generate strategic insights
            const insights = this.generateStrategicInsights(rankedStrategies);
            
            return {
                timeRange: this.getAnalysisTimeRange(filters),
                totalClaims: outcomes.length,
                strategies: rankedStrategies,
                insights,
                recommendations: this.generateStrategicRecommendations(rankedStrategies),
                benchmarks: this.getBenchmarkComparisons(rankedStrategies),
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error analyzing strategy performance:', error);
            throw new Error(`Strategy analysis failed: ${error.message}`);
        }
    }

    /**
     * Get comprehensive approval rate analytics
     */
    async getApprovalRateAnalytics(filters = {}) {
        try {
            const outcomes = this.getFilteredOutcomes(filters);
            
            // Overall approval metrics
            const overallMetrics = this.calculateOverallApprovalMetrics(outcomes);
            
            // Trend analysis
            const trends = this.calculateApprovalTrends(outcomes);
            
            // Segmented analysis
            const segmentedAnalysis = {
                byCompany: this.analyzeByInsuranceCompany(outcomes),
                byAdjuster: this.analyzeByAdjuster(outcomes),
                byDamageType: this.analyzeByDamageType(outcomes),
                byClaimValue: this.analyzeByClaimValue(outcomes),
                byStrategy: this.analyzeByStrategy(outcomes)
            };
            
            // Time-based analysis
            const timeAnalysis = this.generateTimeBasedAnalysis(outcomes);
            
            // Predictive insights
            const predictions = await this.generateApprovalPredictions(outcomes);
            
            // Performance benchmarks
            const benchmarks = this.getApprovalBenchmarks();
            
            return {
                period: this.getAnalysisTimeRange(filters),
                overall: overallMetrics,
                trends,
                segmented: segmentedAnalysis,
                timeAnalysis,
                predictions,
                benchmarks,
                insights: this.generateApprovalInsights(overallMetrics, trends, segmentedAnalysis),
                actionItems: this.generateApprovalActionItems(overallMetrics, trends),
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error getting approval rate analytics:', error);
            throw new Error(`Approval analytics failed: ${error.message}`);
        }
    }

    /**
     * Generate performance optimization recommendations
     */
    async generateOptimizationRecommendations(targetMetric = 'approval_rate') {
        try {
            const outcomes = Array.from(this.analyticsData.values());
            const recommendations = [];
            
            // Analyze top performers
            const topPerformers = this.identifyTopPerformers(outcomes, targetMetric);
            
            // Analyze underperformers
            const underperformers = this.identifyUnderperformers(outcomes, targetMetric);
            
            // Strategy optimization
            const strategyOptimizations = this.analyzeStrategyOptimizations(outcomes, targetMetric);
            
            // Template optimization
            const templateOptimizations = this.analyzeTemplateOptimizations(outcomes, targetMetric);
            
            // Process optimization
            const processOptimizations = this.analyzeProcessOptimizations(outcomes, targetMetric);
            
            // Generate specific recommendations
            recommendations.push(...this.generateStrategyRecommendations(strategyOptimizations));
            recommendations.push(...this.generateTemplateRecommendations(templateOptimizations));
            recommendations.push(...this.generateProcessRecommendations(processOptimizations));
            recommendations.push(...this.generateAdjusterRecommendations(topPerformers, underperformers));
            
            // Prioritize recommendations
            const prioritizedRecommendations = this.prioritizeRecommendations(recommendations);
            
            // Generate implementation roadmap
            const roadmap = this.generateImplementationRoadmap(prioritizedRecommendations);
            
            return {
                targetMetric,
                currentPerformance: this.getCurrentPerformance(targetMetric),
                benchmarkPerformance: this.getBenchmarkPerformance(targetMetric),
                improvementPotential: this.calculateImprovementPotential(targetMetric),
                recommendations: prioritizedRecommendations,
                roadmap,
                expectedImpact: this.calculateExpectedImpact(prioritizedRecommendations),
                timeline: this.estimateImplementationTimeline(prioritizedRecommendations),
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error generating optimization recommendations:', error);
            throw new Error(`Optimization recommendations failed: ${error.message}`);
        }
    }

    /**
     * Get real-time performance dashboard
     */
    async getRealTimePerformance() {
        try {
            const now = new Date();
            const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            // Recent outcomes
            const recentOutcomes = Array.from(this.analyticsData.values())
                .filter(outcome => new Date(outcome.timestamp) >= last24Hours);
            
            // Live metrics
            const liveMetrics = {
                approvalRate: this.calculateLiveApprovalRate(recentOutcomes),
                avgSettlementRatio: this.calculateLiveSettlementRatio(recentOutcomes),
                avgResponseTime: this.calculateLiveResponseTime(recentOutcomes),
                claimsProcessed: recentOutcomes.length,
                totalValue: recentOutcomes.reduce((sum, o) => sum + o.approvalAmount, 0)
            };
            
            // Performance alerts
            const alerts = this.generatePerformanceAlerts(liveMetrics, recentOutcomes);
            
            // Trending strategies
            const trendingStrategies = this.identifyTrendingStrategies(recentOutcomes);
            
            // Active campaigns
            const activeCampaigns = this.getActiveCampaigns();
            
            // Performance compared to benchmarks
            const benchmarkComparison = this.compareToBenchmarks(liveMetrics);
            
            return {
                timestamp: now.toISOString(),
                metrics: liveMetrics,
                alerts,
                trends: {
                    strategies: trendingStrategies,
                    approval: this.calculateApprovalTrend(recentOutcomes),
                    settlement: this.calculateSettlementTrend(recentOutcomes),
                    response: this.calculateResponseTrend(recentOutcomes)
                },
                campaigns: activeCampaigns,
                benchmarks: benchmarkComparison,
                recentActivity: recentOutcomes.slice(-10).reverse(),
                nextRecommendations: this.getNextActionRecommendations()
            };

        } catch (error) {
            console.error('❌ Error getting real-time performance:', error);
            throw new Error(`Real-time performance failed: ${error.message}`);
        }
    }

    // Helper Methods

    calculateProcessingDays(outcomeData) {
        if (!outcomeData.submissionDate || !outcomeData.resolutionDate) return 0;
        const submission = new Date(outcomeData.submissionDate);
        const resolution = new Date(outcomeData.resolutionDate);
        return Math.floor((resolution - submission) / (1000 * 60 * 60 * 24));
    }

    identifySuccessFactors(outcomeData) {
        const factors = [];
        
        if (outcomeData.photoQuality >= 80) factors.push('high_quality_photos');
        if (outcomeData.reportCompleteness >= 90) factors.push('complete_documentation');
        if (outcomeData.evidenceStrength >= 85) factors.push('strong_evidence');
        if (outcomeData.communicationCount <= 3) factors.push('efficient_communication');
        if (outcomeData.responseTime <= 24) factors.push('quick_response');
        
        return factors;
    }

    identifyFailureFactors(outcomeData) {
        const factors = [];
        
        if (outcomeData.photoQuality < 50) factors.push('poor_photo_quality');
        if (outcomeData.reportCompleteness < 70) factors.push('incomplete_documentation');
        if (outcomeData.evidenceStrength < 60) factors.push('weak_evidence');
        if (outcomeData.communicationCount > 8) factors.push('excessive_communication');
        if (outcomeData.responseTime > 120) factors.push('slow_response');
        
        return factors;
    }

    calculatePredictionAccuracy(predicted, actual) {
        if (predicted === actual) return 100;
        if ((predicted === 'approved' && actual === 'partial') || 
            (predicted === 'partial' && actual === 'approved')) return 75;
        return 0;
    }

    async updateStrategyPerformance(outcome) {
        outcome.strategiesUsed.forEach(strategy => {
            if (!this.strategies.has(strategy)) {
                this.strategies.set(strategy, {
                    usage: 0,
                    successes: 0,
                    totalValue: 0,
                    approvedValue: 0,
                    avgProcessingTime: 0,
                    outcomes: []
                });
            }
            
            const stats = this.strategies.get(strategy);
            stats.usage++;
            stats.totalValue += outcome.requestedAmount;
            stats.outcomes.push(outcome.id);
            
            if (outcome.result === 'approved' || outcome.result === 'partial') {
                stats.successes++;
                stats.approvedValue += outcome.approvalAmount;
            }
            
            // Update average processing time
            const totalProcessingTime = stats.outcomes
                .map(id => this.analyticsData.get(id))
                .filter(o => o)
                .reduce((sum, o) => sum + o.processingDays, 0);
            stats.avgProcessingTime = Math.round(totalProcessingTime / stats.outcomes.length);
        });
    }

    calculateStrategyEffectiveness(strategyOutcomes) {
        if (strategyOutcomes.length === 0) return 0;
        
        const weights = {
            approval_rate: 0.4,
            settlement_ratio: 0.3,
            processing_time: 0.2,
            value_impact: 0.1
        };
        
        const approvalRate = (strategyOutcomes.filter(o => o.result === 'approved').length / strategyOutcomes.length) * 100;
        const avgSettlementRatio = strategyOutcomes.reduce((sum, o) => sum + o.settlementRatio, 0) / strategyOutcomes.length;
        const avgProcessingTime = strategyOutcomes.reduce((sum, o) => sum + o.processingDays, 0) / strategyOutcomes.length;
        const timeScore = Math.max(0, 100 - (avgProcessingTime * 2)); // Faster is better
        const valueImpact = avgSettlementRatio;
        
        return Math.round(
            (approvalRate * weights.approval_rate) +
            (avgSettlementRatio * weights.settlement_ratio) +
            (timeScore * weights.processing_time) +
            (valueImpact * weights.value_impact)
        );
    }

    generateStrategyRecommendation(strategy, strategyOutcomes) {
        const effectiveness = this.calculateStrategyEffectiveness(strategyOutcomes);
        const usage = strategyOutcomes.length;
        const approvalRate = (strategyOutcomes.filter(o => o.result === 'approved').length / strategyOutcomes.length) * 100;
        
        if (effectiveness >= 80) {
            return usage < 10 ? 'increase_usage' : 'maintain_current';
        } else if (effectiveness >= 60) {
            return 'optimize_implementation';
        } else {
            return 'review_effectiveness';
        }
    }

    getFilteredOutcomes(filters) {
        let outcomes = Array.from(this.analyticsData.values());
        
        if (filters.dateRange) {
            const { start, end } = filters.dateRange;
            outcomes = outcomes.filter(o => {
                const date = new Date(o.timestamp);
                return date >= new Date(start) && date <= new Date(end);
            });
        }
        
        if (filters.company) {
            outcomes = outcomes.filter(o => o.insuranceCompany === filters.company);
        }
        
        if (filters.adjuster) {
            outcomes = outcomes.filter(o => o.adjusterInfo.id === filters.adjuster);
        }
        
        if (filters.damageType) {
            outcomes = outcomes.filter(o => o.damageType === filters.damageType);
        }
        
        if (filters.result) {
            outcomes = outcomes.filter(o => o.result === filters.result);
        }
        
        return outcomes;
    }

    calculateOverallApprovalMetrics(outcomes) {
        if (outcomes.length === 0) {
            return {
                approvalRate: 0,
                partialApprovalRate: 0,
                denialRate: 0,
                withdrawalRate: 0,
                avgSettlementRatio: 0,
                avgProcessingTime: 0,
                totalClaims: 0,
                totalValue: 0,
                approvedValue: 0
            };
        }
        
        const approved = outcomes.filter(o => o.result === 'approved').length;
        const partial = outcomes.filter(o => o.result === 'partial').length;
        const denied = outcomes.filter(o => o.result === 'denied').length;
        const withdrawn = outcomes.filter(o => o.result === 'withdrawn').length;
        
        const totalValue = outcomes.reduce((sum, o) => sum + o.requestedAmount, 0);
        const approvedValue = outcomes.reduce((sum, o) => sum + o.approvalAmount, 0);
        const avgSettlementRatio = outcomes.reduce((sum, o) => sum + o.settlementRatio, 0) / outcomes.length;
        const avgProcessingTime = outcomes.reduce((sum, o) => sum + o.processingDays, 0) / outcomes.length;
        
        return {
            approvalRate: Math.round((approved / outcomes.length) * 100),
            partialApprovalRate: Math.round((partial / outcomes.length) * 100),
            denialRate: Math.round((denied / outcomes.length) * 100),
            withdrawalRate: Math.round((withdrawn / outcomes.length) * 100),
            avgSettlementRatio: Math.round(avgSettlementRatio),
            avgProcessingTime: Math.round(avgProcessingTime),
            totalClaims: outcomes.length,
            totalValue,
            approvedValue,
            successRate: Math.round(((approved + partial) / outcomes.length) * 100)
        };
    }

    setupBenchmarks() {
        // Industry standard benchmarks
        this.benchmarks.set('industry_standard', {
            approvalRate: 75,
            avgSettlementRatio: 85,
            avgProcessingTime: 21,
            responseTime: 48,
            successRate: 80
        });
        
        // Company-specific benchmarks
        this.benchmarks.set('company_target', {
            approvalRate: 82,
            avgSettlementRatio: 92,
            avgProcessingTime: 18,
            responseTime: 24,
            successRate: 88
        });
    }

    initializeStrategyTracking() {
        // Initialize tracking for all defined strategies
        Object.keys(this.strategyMetrics).forEach(strategy => {
            this.strategies.set(strategy, {
                usage: 0,
                successes: 0,
                totalValue: 0,
                approvedValue: 0,
                avgProcessingTime: 0,
                outcomes: []
            });
        });
    }

    setupRealTimeAnalytics() {
        // Initialize real-time tracking
        setInterval(() => {
            this.updateRealTimeMetrics();
        }, 60000); // Update every minute
    }

    startAnalyticsProcessing() {
        // Daily analytics processing
        setInterval(() => {
            this.processDailyAnalytics();
        }, 24 * 60 * 60 * 1000); // Daily
        
        // Weekly trend analysis
        setInterval(() => {
            this.processWeeklyTrends();
        }, 7 * 24 * 60 * 60 * 1000); // Weekly
    }

    async processDailyAnalytics() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const dailyOutcomes = Array.from(this.analyticsData.values())
                .filter(outcome => {
                    const outcomeDate = new Date(outcome.timestamp);
                    return outcomeDate.toDateString() === yesterday.toDateString();
                });
            
            if (dailyOutcomes.length > 0) {
                const dailyReport = this.generateDailyReport(dailyOutcomes);
                this.emit('dailyAnalytics', dailyReport);
            }
        } catch (error) {
            console.error('❌ Error processing daily analytics:', error);
        }
    }

    // Utility methods
    generateOutcomeId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `ANA-${timestamp}-${random}`.toUpperCase();
    }

    updateRealTimeMetrics(outcome = null) {
        if (outcome) {
            this.realTimeMetrics.claims.processed++;
            
            switch (outcome.result) {
                case 'approved':
                    this.realTimeMetrics.claims.approved++;
                    this.realTimeMetrics.revenue.approved += outcome.approvalAmount;
                    break;
                case 'denied':
                    this.realTimeMetrics.claims.denied++;
                    break;
                default:
                    this.realTimeMetrics.claims.pending++;
            }
            
            this.realTimeMetrics.revenue.estimated += outcome.requestedAmount;
        }
        
        // Recalculate averages
        const allOutcomes = Array.from(this.analyticsData.values());
        if (allOutcomes.length > 0) {
            const approvedCount = allOutcomes.filter(o => o.result === 'approved').length;
            this.realTimeMetrics.performance.avgApprovalRate = Math.round((approvedCount / allOutcomes.length) * 100);
            
            const avgSettlement = allOutcomes.reduce((sum, o) => sum + o.settlementRatio, 0) / allOutcomes.length;
            this.realTimeMetrics.performance.avgSettlementRatio = Math.round(avgSettlement);
            
            const avgResponse = allOutcomes.reduce((sum, o) => sum + o.responseTime, 0) / allOutcomes.length;
            this.realTimeMetrics.performance.avgResponseTime = Math.round(avgResponse);
        }
    }

    // Public API methods
    getOutcome(outcomeId) {
        return this.analyticsData.get(outcomeId);
    }

    getAllOutcomes(filters = {}) {
        return this.getFilteredOutcomes(filters);
    }

    getStrategyStats(strategy) {
        return this.strategies.get(strategy);
    }

    async generateCustomReport(reportConfig) {
        try {
            const outcomes = this.getFilteredOutcomes(reportConfig.filters || {});
            
            const report = {
                title: reportConfig.title || 'Custom Analytics Report',
                period: this.getAnalysisTimeRange(reportConfig.filters),
                metrics: {},
                charts: [],
                insights: [],
                recommendations: []
            };
            
            // Add requested metrics
            if (reportConfig.metrics) {
                reportConfig.metrics.forEach(metric => {
                    switch (metric) {
                        case 'approval_rate':
                            report.metrics.approvalRate = this.calculateOverallApprovalMetrics(outcomes);
                            break;
                        case 'strategy_performance':
                            report.metrics.strategyPerformance = this.analyzeStrategyPerformance({ filters: reportConfig.filters });
                            break;
                        // Add more metrics as needed
                    }
                });
            }
            
            return report;
        } catch (error) {
            console.error('❌ Error generating custom report:', error);
            throw new Error(`Custom report generation failed: ${error.message}`);
        }
    }
}