#!/usr/bin/env node

/**
 * Legal Precedent Search System Demonstration
 * 
 * This script demonstrates the comprehensive legal precedent search and analysis
 * capabilities of Susan AI's enhanced legal intelligence system.
 */

import { LegalPrecedentService } from './src/api/services/LegalPrecedentService.js';
import { LegalPrecedentIntegrationService } from './src/api/services/LegalPrecedentIntegrationService.js';

class LegalPrecedentDemo {
    constructor() {
        this.precedentService = new LegalPrecedentService();
        this.integrationService = new LegalPrecedentIntegrationService();
    }

    async runDemo() {
        console.log('🚀 Starting Legal Precedent Search System Demonstration\n');
        
        try {
            // Wait for services to initialize
            await this.waitForServices();
            
            // Demo 1: Basic Similar Case Search
            await this.demoSimilarCaseSearch();
            
            // Demo 2: Outcome Analysis and Prediction
            await this.demoOutcomeAnalysis();
            
            // Demo 3: Citation Generation
            await this.demoCitationGeneration();
            
            // Demo 4: Jurisdiction Analysis
            await this.demoJurisdictionAnalysis();
            
            // Demo 5: Strategy Recommendations
            await this.demoStrategyRecommendations();
            
            // Demo 6: Comprehensive Integrated Analysis
            await this.demoIntegratedAnalysis();
            
            // Demo 7: Legal Database Search
            await this.demoLegalDatabaseSearch();
            
            console.log('\n✅ Legal Precedent Search System Demonstration Complete!');
            console.log('\n📊 System Performance Summary:');
            this.printSystemMetrics();
            
        } catch (error) {
            console.error('❌ Demo failed:', error);
        }
    }

    async waitForServices() {
        console.log('⏳ Initializing services...');
        
        // Wait for precedent service
        await new Promise((resolve) => {
            if (this.precedentService.precedentDatabase.size > 0) {
                resolve();
            } else {
                this.precedentService.on('serviceReady', resolve);
            }
        });
        
        // Wait for integration service
        await new Promise((resolve) => {
            this.integrationService.on('serviceReady', resolve);
        });
        
        console.log('✅ Services initialized\n');
    }

    async demoSimilarCaseSearch() {
        console.log('📚 Demo 1: Similar Case Search');
        console.log('=====================================');
        
        const sampleClaim = {
            claimId: 'DEMO-001',
            claimType: 'hail_damage',
            jurisdiction: 'TX',
            damageAmount: 45000,
            description: 'Extensive hail damage to roof and siding from severe storm. Insurance company initially denied claim citing gradual damage exclusion.',
            legalIssues: ['coverage_dispute', 'causation_analysis'],
            circumstances: ['storm_damage', 'expert_required'],
            timeline: { urgency: 'normal' }
        };

        console.log('🔍 Searching for similar cases...');
        console.log(`Claim Type: ${sampleClaim.claimType}`);
        console.log(`Jurisdiction: ${sampleClaim.jurisdiction}`);
        console.log(`Damage Amount: $${sampleClaim.damageAmount.toLocaleString()}\n`);

        const searchResult = await this.precedentService.findSimilarCases(sampleClaim, {
            maxResults: 5,
            minSimilarity: 0.6,
            includeAnalysis: true
        });

        console.log(`📊 Search Results: ${searchResult.totalResults} cases found`);
        console.log(`Average Similarity: ${Math.round(searchResult.avgSimilarity * 100)}%\n`);

        searchResult.results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.caseName} (${result.year})`);
            console.log(`   Jurisdiction: ${result.jurisdiction}`);
            console.log(`   Outcome: ${result.outcome}`);
            console.log(`   Settlement: $${result.settlementAmount?.toLocaleString() || 'N/A'}`);
            console.log(`   Similarity: ${Math.round(result.similarity.overallScore * 100)}%`);
            console.log(`   Citation: ${result.citation}`);
            console.log('');
        });

        if (searchResult.analysis) {
            console.log('📈 Analysis Insights:');
            console.log(`   Success Probability: ${Math.round(searchResult.analysis.successProbability * 100)}%`);
            console.log(`   Most Common Outcome: ${searchResult.analysis.outcomePattern.mostCommon}`);
            if (searchResult.analysis.settlementAnalysis?.predictedSettlement) {
                console.log(`   Predicted Settlement: $${searchResult.analysis.settlementAnalysis.predictedSettlement.predictedAmount.toLocaleString()}`);
            }
        }

        console.log('\n');
    }

    async demoOutcomeAnalysis() {
        console.log('🔮 Demo 2: Outcome Analysis and Prediction');
        console.log('==========================================');

        const analysisRequest = {
            jurisdiction: 'TX',
            claimType: 'hail_damage',
            includeStatistics: true,
            includeTrends: true
        };

        console.log('📊 Analyzing outcomes for Texas hail damage cases...\n');

        const outcomeAnalysis = await this.precedentService.analyzeOutcomes(analysisRequest);

        console.log('📈 Statistical Analysis:');
        if (outcomeAnalysis.statistics) {
            console.log(`   Total Cases Analyzed: ${outcomeAnalysis.totalCases}`);
            
            if (outcomeAnalysis.statistics.outcomeDistribution) {
                console.log('   Outcome Distribution:');
                Object.entries(outcomeAnalysis.statistics.outcomeDistribution).forEach(([outcome, data]) => {
                    console.log(`     ${outcome}: ${data.count} cases (${data.percentage}%)`);
                });
            }

            if (outcomeAnalysis.statistics.settlementStatistics) {
                const stats = outcomeAnalysis.statistics.settlementStatistics;
                console.log(`   Average Settlement: $${stats.averageAmount?.toLocaleString() || 'N/A'}`);
                console.log(`   Average Settlement Ratio: ${Math.round((stats.averageRatio || 0) * 100)}%`);
            }

            if (outcomeAnalysis.statistics.successMetrics) {
                const metrics = outcomeAnalysis.statistics.successMetrics;
                console.log(`   Overall Success Rate: ${Math.round((metrics.overallSuccessRate || 0) * 100)}%`);
                console.log(`   Settlement Rate: ${Math.round((metrics.settlementRate || 0) * 100)}%`);
            }
        }

        // Now predict outcome for a specific claim
        console.log('\n🎯 Predicting Outcome for Specific Claim:');
        
        const claimForPrediction = {
            claimType: 'hail_damage',
            jurisdiction: 'TX',
            damageAmount: 50000,
            description: 'Roof damage from hailstorm with impact marks clearly visible'
        };

        const prediction = await this.precedentService.predictLikelyOutcome({
            claimData: claimForPrediction,
            includeConfidenceInterval: true,
            includeRiskFactors: true
        });

        console.log(`   Most Likely Outcome: ${prediction.prediction.outcome}`);
        console.log(`   Likelihood: ${Math.round(prediction.prediction.likelihood * 100)}%`);
        
        if (prediction.prediction.settlement) {
            console.log(`   Predicted Settlement: $${prediction.prediction.settlement.predictedAmount.toLocaleString()}`);
            console.log(`   Confidence Range: $${prediction.prediction.settlement.confidenceInterval.low.toLocaleString()} - $${prediction.prediction.settlement.confidenceInterval.high.toLocaleString()}`);
        }

        if (prediction.prediction.timeline) {
            console.log(`   Estimated Timeline: ${prediction.prediction.timeline.estimatedDays} days`);
        }

        console.log(`   Confidence Level: ${prediction.confidence.level} (${Math.round(prediction.confidence.overall * 100)}%)`);

        console.log('\n');
    }

    async demoCitationGeneration() {
        console.log('📝 Demo 3: Legal Citation Generation');
        console.log('====================================');

        // Get a case for citation
        const caseId = 'PD001'; // Smith v. Reliable Insurance Co.
        console.log(`Generating citations for case: ${caseId}\n`);

        const citation = await this.precedentService.generateCitation({
            caseId,
            format: 'bluebook',
            includeMetadata: true
        });

        console.log('📚 Generated Citations:');
        Object.entries(citation.citations).forEach(([format, citationText]) => {
            console.log(`   ${format.toUpperCase()}: ${citationText}`);
        });

        if (citation.metadata) {
            console.log('\n📋 Case Metadata:');
            console.log(`   Case Type: ${citation.metadata.caseType}`);
            console.log(`   Claim Type: ${citation.metadata.claimType}`);
            console.log(`   Jurisdiction: ${citation.metadata.jurisdiction}`);
            console.log(`   Precedent Value: ${citation.metadata.precedentValue}`);
            
            if (citation.metadata.keyHoldings) {
                console.log('   Key Holdings:');
                citation.metadata.keyHoldings.forEach(holding => {
                    console.log(`     • ${holding}`);
                });
            }

            if (citation.metadata.relatedCases && citation.metadata.relatedCases.length > 0) {
                console.log('   Related Cases:');
                citation.metadata.relatedCases.forEach(related => {
                    console.log(`     • ${related.caseName} (Score: ${Math.round(related.relationScore * 100)}%)`);
                });
            }
        }

        console.log('\n');
    }

    async demoJurisdictionAnalysis() {
        console.log('🏛️ Demo 4: Jurisdiction Analysis');
        console.log('=================================');

        console.log('Analyzing jurisdiction patterns across states...\n');

        const jurisdictionAnalysis = await this.precedentService.analyzeJurisdictionPatterns({
            compareJurisdictions: true,
            claimType: 'hail_damage',
            includeRecommendations: true
        });

        console.log('📊 Jurisdiction Comparison:');
        
        if (jurisdictionAnalysis.comparisons) {
            console.log('\n🏆 Success Rate Rankings:');
            jurisdictionAnalysis.comparisons.rankings.bySuccessRate.forEach((ranking, index) => {
                console.log(`   ${index + 1}. ${ranking.jurisdiction}: ${Math.round(ranking.successRate * 100)}% (${ranking.totalCases} cases)`);
            });

            console.log('\n💰 Settlement Ratio Rankings:');
            jurisdictionAnalysis.comparisons.rankings.bySettlementRatio.forEach((ranking, index) => {
                console.log(`   ${index + 1}. ${ranking.jurisdiction}: ${Math.round(ranking.averageSettlementRatio * 100)}% (${ranking.totalCases} cases)`);
            });

            console.log('\n⏱️ Timeline Rankings (Fastest to Slowest):');
            jurisdictionAnalysis.comparisons.rankings.byTimeline.forEach((ranking, index) => {
                console.log(`   ${index + 1}. ${ranking.jurisdiction}: ${Math.round(ranking.averageTimeline)} days (${ranking.totalCases} cases)`);
            });

            if (jurisdictionAnalysis.comparisons.insights.length > 0) {
                console.log('\n💡 Key Insights:');
                jurisdictionAnalysis.comparisons.insights.forEach(insight => {
                    console.log(`   • ${insight.description}`);
                    if (insight.recommendation) {
                        console.log(`     Recommendation: ${insight.recommendation}`);
                    }
                });
            }
        }

        // Show detailed analysis for Texas
        console.log('\n🔍 Detailed Analysis - Texas:');
        const texasPattern = jurisdictionAnalysis.patterns['TX'];
        if (texasPattern) {
            console.log(`   Total Cases: ${texasPattern.totalCases}`);
            console.log(`   Success Rate: ${Math.round(texasPattern.successRate * 100)}%`);
            console.log(`   Average Timeline: ${Math.round(texasPattern.averageTimeline)} days`);
            console.log(`   Average Settlement Ratio: ${Math.round(texasPattern.averageSettlementRatio * 100)}%`);
            
            if (texasPattern.commonStrategies.length > 0) {
                console.log('   Common Strategies:');
                texasPattern.commonStrategies.forEach(strategy => {
                    console.log(`     • ${strategy.strategy} (${Math.round(strategy.usage * 100)}% usage)`);
                });
            }
        }

        console.log('\n');
    }

    async demoStrategyRecommendations() {
        console.log('⚡ Demo 5: Strategy Recommendations');
        console.log('==================================');

        const claimData = {
            claimId: 'DEMO-STRATEGY',
            claimType: 'hurricane_damage',
            jurisdiction: 'FL',
            damageAmount: 125000,
            description: 'Wind and water damage from Hurricane Ian. Dispute over concurrent causation.',
            urgency: 'high',
            complexity: 'high'
        };

        console.log(`Generating strategy recommendations for:`);
        console.log(`   Claim: ${claimData.claimType} in ${claimData.jurisdiction}`);
        console.log(`   Damage: $${claimData.damageAmount.toLocaleString()}`);
        console.log(`   Complexity: ${claimData.complexity}\n`);

        const recommendations = await this.precedentService.generateStrategyRecommendations({
            claimData,
            focusArea: 'settlement',
            riskTolerance: 'medium'
        });

        console.log('📋 Strategy Recommendations:');
        console.log(`   Based on ${recommendations.basedOnCases} similar cases`);
        console.log(`   Success Probability: ${Math.round(recommendations.successProbability * 100)}%\n`);

        recommendations.strategies.forEach((strategy, index) => {
            console.log(`${index + 1}. ${strategy.title} (Priority: ${strategy.priority})`);
            console.log(`   Description: ${strategy.description}`);
            console.log(`   Confidence: ${Math.round(strategy.confidence * 100)}%`);
            console.log(`   Risk Level: ${strategy.riskLevel}`);
            
            if (strategy.actions) {
                console.log('   Actions:');
                strategy.actions.forEach(action => {
                    console.log(`     • ${action}`);
                });
            }
            
            if (strategy.timeframe) {
                console.log(`   Timeframe: ${strategy.timeframe}`);
            }
            
            if (strategy.estimatedCost) {
                console.log(`   Estimated Cost: $${strategy.estimatedCost.min.toLocaleString()} - $${strategy.estimatedCost.max.toLocaleString()}`);
            }
            console.log('');
        });

        if (recommendations.timeline?.phases) {
            console.log('📅 Recommended Timeline:');
            console.log(`   Total Duration: ${recommendations.timeline.estimatedDuration}\n`);
            
            recommendations.timeline.phases.forEach((phase, index) => {
                console.log(`   Phase ${index + 1}: ${phase.name} (${phase.duration})`);
                phase.activities.forEach(activity => {
                    console.log(`     • ${activity}`);
                });
                console.log('');
            });
        }

        console.log('\n');
    }

    async demoIntegratedAnalysis() {
        console.log('🔗 Demo 6: Comprehensive Integrated Analysis');
        console.log('=============================================');

        const complexClaim = {
            claimId: 'DEMO-INTEGRATED',
            claimType: 'wildfire_damage',
            jurisdiction: 'CA',
            damageAmount: 750000,
            status: 'under_investigation',
            timestamps: {
                submitted: '2024-01-15',
                acknowledged: '2024-01-17'
            },
            description: 'Total loss from wildfire. Disputes over replacement cost calculation and code upgrade requirements.',
            legalIssues: ['replacement_cost_valuation', 'code_upgrade_coverage'],
            communications: [],
            documents: []
        };

        console.log('🚀 Running comprehensive integrated analysis...');
        console.log(`   Claim: ${complexClaim.claimType} in ${complexClaim.jurisdiction}`);
        console.log(`   Value: $${complexClaim.damageAmount.toLocaleString()}`);
        console.log(`   Status: ${complexClaim.status}\n`);

        const analysis = await this.integrationService.performComprehensiveClaimAnalysis(complexClaim);

        console.log('📊 Analysis Results:');
        console.log(`   Analysis ID: ${analysis.analysisId}`);
        console.log(`   Status: ${analysis.status}`);
        console.log(`   Integration Score: ${analysis.integrationScore}/100\n`);

        console.log('📋 Completed Steps:');
        Object.entries(analysis.steps).forEach(([stepName, stepData]) => {
            const status = stepData.status === 'completed' ? '✅' : 
                          stepData.status === 'failed' ? '❌' : '⏳';
            console.log(`   ${status} ${stepName.replace(/_/g, ' ')}: ${stepData.status}`);
        });

        if (analysis.results.compliance) {
            console.log('\n⚖️ Compliance Analysis:');
            console.log(`   Compliance Score: ${analysis.results.compliance.complianceScore}/100`);
            console.log(`   Overall Status: ${analysis.results.compliance.overallCompliance}`);
            console.log(`   Violations: ${analysis.results.compliance.violations.length}`);
            console.log(`   Warnings: ${analysis.results.compliance.warnings.length}`);
        }

        if (analysis.results.precedents) {
            console.log('\n📚 Precedent Analysis:');
            console.log(`   Similar Cases Found: ${analysis.results.precedents.totalResults}`);
            console.log(`   Average Similarity: ${Math.round(analysis.results.precedents.avgSimilarity * 100)}%`);
            console.log(`   Max Similarity: ${Math.round(analysis.results.precedents.maxSimilarity * 100)}%`);
        }

        if (analysis.results.prediction) {
            console.log('\n🔮 Outcome Prediction:');
            console.log(`   Most Likely Outcome: ${analysis.results.prediction.prediction.outcome}`);
            console.log(`   Confidence Level: ${analysis.results.prediction.confidence.level}`);
            if (analysis.results.prediction.prediction.settlement) {
                console.log(`   Predicted Settlement: $${analysis.results.prediction.prediction.settlement.predictedAmount.toLocaleString()}`);
            }
        }

        console.log('\n🎯 Risk Assessment:');
        console.log(`   Overall Risk: ${analysis.riskAssessment.overallRisk}`);
        console.log(`   Compliance Risks: ${analysis.riskAssessment.complianceRisks.length}`);
        console.log(`   Precedent Risks: ${analysis.riskAssessment.precedentRisks.length}`);
        console.log(`   Escalation Required: ${analysis.riskAssessment.escalationRequired ? 'Yes' : 'No'}`);

        console.log('\n💡 Top Recommendations:');
        analysis.recommendations.slice(0, 3).forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec.title} (${rec.priority} priority)`);
            console.log(`      ${rec.description}`);
            if (rec.timeline) {
                console.log(`      Timeline: ${rec.timeline}`);
            }
        });

        console.log('\n');
    }

    async demoLegalDatabaseSearch() {
        console.log('🔍 Demo 7: Legal Database Search');
        console.log('================================');

        const searchRequest = {
            query: 'insurance bad faith hail damage Texas',
            databases: ['westlaw', 'lexis', 'justia'],
            searchType: 'keyword',
            jurisdiction: 'TX',
            maxResults: 5
        };

        console.log('🔎 Searching legal databases...');
        console.log(`   Query: "${searchRequest.query}"`);
        console.log(`   Jurisdiction: ${searchRequest.jurisdiction}`);
        console.log(`   Databases: ${searchRequest.databases.join(', ')}\n`);

        const searchResults = await this.precedentService.searchLegalDatabases(searchRequest);

        console.log('📊 Search Results:');
        console.log(`   Total Results: ${searchResults.totalResults}`);
        console.log(`   Databases Searched: ${searchResults.databases.length}\n`);

        searchResults.databases.forEach(db => {
            console.log(`📚 ${db.name}:`);
            console.log(`   Status: ${db.status}`);
            console.log(`   Results: ${db.resultsCount}`);
            
            if (db.results && db.results.length > 0) {
                db.results.slice(0, 2).forEach((result, index) => {
                    console.log(`   ${index + 1}. ${result.title}`);
                    console.log(`      Citation: ${result.citation}`);
                    console.log(`      Court: ${result.court}`);
                    console.log(`      Relevance: ${Math.round(result.relevanceScore * 100)}%`);
                    console.log(`      Summary: ${result.summary.substring(0, 100)}...`);
                });
            }
            console.log('');
        });

        if (searchResults.consolidatedResults.length > 0) {
            console.log('🏆 Top Consolidated Results:');
            searchResults.consolidatedResults.slice(0, 3).forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.title}`);
                console.log(`      ${result.citation}`);
                console.log(`      Relevance: ${Math.round(result.relevanceScore * 100)}%`);
            });
        }

        console.log('\n');
    }

    printSystemMetrics() {
        const precedentMetrics = this.precedentService.getSystemMetrics();
        const integrationMetrics = this.integrationService.getIntegrationMetrics();

        console.log('📈 Precedent Service Metrics:');
        console.log(`   Total Cases: ${precedentMetrics.totalCases}`);
        console.log(`   Total Searches: ${precedentMetrics.totalSearches}`);
        console.log(`   Active Databases: ${precedentMetrics.activeDatabases}`);

        console.log('\n🔗 Integration Service Metrics:');
        console.log(`   Total Analyses: ${integrationMetrics.totalAnalyses || 0}`);
        console.log(`   Avg Integration Score: ${integrationMetrics.avgIntegrationScore || 0}%`);
        console.log(`   Automation Rules: ${this.integrationService.getAutomationRules().length}`);

        console.log('\n📋 Available Workflows:');
        const workflows = this.integrationService.getWorkflows();
        Object.keys(workflows).forEach(workflowKey => {
            console.log(`   • ${workflows[workflowKey].name}`);
        });
    }
}

// Run the demo
const demo = new LegalPrecedentDemo();
demo.runDemo().catch(console.error);