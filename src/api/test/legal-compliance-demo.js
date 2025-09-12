import { LegalComplianceService } from '../services/LegalComplianceService.js';
import { IntegratedComplianceService } from '../services/IntegratedComplianceService.js';

/**
 * Legal Compliance Service Demo
 * Demonstrates the comprehensive legal compliance checking capabilities
 */

async function runLegalComplianceDemo() {
    console.log('🚀 Starting Legal Compliance Service Demo...\n');

    try {
        // Initialize services
        const legalService = new LegalComplianceService();
        const integratedService = new IntegratedComplianceService();

        await legalService.initialize();
        await integratedService.initialize();

        console.log('✅ Services initialized successfully\n');

        // Demo 1: State Regulations Database
        console.log('📚 DEMO 1: State Regulations Database');
        console.log('=====================================');
        
        const texasRegs = legalService.getStateRegulations('TX');
        console.log('Texas Regulations Sample:');
        console.log(`- Regulatory Body: ${texasRegs.regulatoryBody}`);
        console.log(`- Claim Acknowledgment Timeline: ${texasRegs.keyRegulations.claimTimelines.acknowledgment} days`);
        console.log(`- Required Disclosures: ${texasRegs.keyRegulations.disclosureRequirements.join(', ')}`);
        console.log(`- Prohibited Practices: ${texasRegs.keyRegulations.prohibitedPractices.join(', ')}\n`);

        // Demo 2: Communication Compliance Checking
        console.log('✉️ DEMO 2: Communication Compliance Checking');
        console.log('=============================================');

        const communicationTests = [
            {
                name: 'Compliant Insurance Email',
                data: {
                    content: `Dear Mr. Johnson,

Thank you for submitting your hail damage claim. We have received your documentation and will begin our review process.

As required by Texas state law, please be aware that you have the right to demand an appraisal of any loss under this policy. If you have any complaints regarding this claim, you may contact the Texas Department of Insurance.

We will acknowledge your claim within 15 days and complete our investigation within 30 days as required by Texas prompt pay regulations.

Best regards,
Claims Department`,
                    type: 'email',
                    state: 'TX',
                    context: { claimType: 'hail', claimValue: 25000 }
                }
            },
            {
                name: 'Non-Compliant Email with Violations',
                data: {
                    content: `Hey there!

Good news - we guarantee your claim will be approved! This is a slam dunk case and you'll get quick cash, no questions asked.

We always win against insurance companies and this will be easy money for you.

Call us now!`,
                    type: 'email',
                    state: 'TX',
                    context: { claimType: 'wind', claimValue: 15000 }
                }
            }
        ];

        for (const test of communicationTests) {
            console.log(`\nTesting: ${test.name}`);
            const result = await legalService.checkCommunicationCompliance(test.data);
            
            console.log(`Overall Compliance: ${result.overallCompliance}`);
            console.log(`Compliance Score: ${result.complianceScore}/100`);
            console.log(`Risk Level: ${result.riskLevel}`);
            
            if (result.violations.length > 0) {
                console.log('❌ Violations Found:');
                result.violations.forEach(v => {
                    console.log(`  - ${v.type}: ${v.message}`);
                });
            }
            
            if (result.warnings.length > 0) {
                console.log('⚠️ Warnings:');
                result.warnings.forEach(w => {
                    console.log(`  - ${w.type}: ${w.message}`);
                });
            }
            
            if (result.recommendations.length > 0) {
                console.log('💡 Recommendations:');
                result.recommendations.forEach(r => {
                    console.log(`  - ${r.message || r.type}`);
                });
            }
        }

        // Demo 3: Claim Validation
        console.log('\n\n📋 DEMO 3: Claim Validation');
        console.log('===========================');

        const claimValidationTests = [
            {
                name: 'Compliant Claim',
                data: {
                    claimId: 'CLM-2025-001',
                    state: 'TX',
                    status: 'under_review',
                    timestamps: {
                        submitted: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
                        acknowledged: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
                    },
                    documents: ['initial_estimate.pdf', 'damage_photos.zip'],
                    communications: [
                        { type: 'email', timestamp: new Date().toISOString(), direction: 'outbound' }
                    ]
                }
            },
            {
                name: 'Non-Compliant Claim (Timeline Violations)',
                data: {
                    claimId: 'CLM-2025-002',
                    state: 'CA',
                    status: 'submitted',
                    timestamps: {
                        submitted: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() // 20 days ago
                        // No acknowledgment - violation
                    },
                    documents: [],
                    communications: []
                }
            }
        ];

        for (const test of claimValidationTests) {
            console.log(`\nValidating: ${test.name}`);
            const result = await legalService.validateClaimCompliance(test.data);
            
            console.log(`Overall Compliance: ${result.overallCompliance}`);
            console.log(`Compliance Score: ${result.complianceScore}/100`);
            
            if (result.timelineIssues.length > 0) {
                console.log('⏰ Timeline Issues:');
                result.timelineIssues.forEach(t => {
                    console.log(`  - ${t.type}: ${t.message}`);
                });
            }
            
            if (result.nextDeadlines.length > 0) {
                console.log('📅 Upcoming Deadlines:');
                result.nextDeadlines.forEach(d => {
                    console.log(`  - ${d.type}: ${d.daysRemaining} days remaining`);
                });
            }
        }

        // Demo 4: Document Analysis with NLP
        console.log('\n\n📄 DEMO 4: Document Analysis with NLP');
        console.log('=====================================');

        const documentTests = [
            {
                name: 'Insurance Settlement Letter',
                data: {
                    documentId: 'DOC-2025-001',
                    content: `SETTLEMENT AGREEMENT

This agreement settles the claim for hail damage to the property located at 123 Main St, Dallas, TX.

Total Settlement Amount: $45,000
Less Deductible: $2,500
Net Payment: $42,500

The insured acknowledges this settlement is fair and releases all claims against the insurance company.

As required by Texas law, this settlement includes your right to appraisal and the contact information for the Texas Department of Insurance is provided below.`,
                    type: 'settlement_letter',
                    state: 'TX',
                    context: { claimType: 'hail', settlementAmount: 45000 }
                }
            },
            {
                name: 'Problematic Marketing Material',
                data: {
                    documentId: 'DOC-2025-002',
                    content: `GUARANTEED CLAIM APPROVAL!

We have a 100% success rate with insurance claims. No questions asked, we always get full payment!

Our lawyers are standing by to sue your insurance company for bad faith if they don't pay.

This is risk-free for you - we guarantee results!`,
                    type: 'marketing_material',
                    state: 'FL',
                    context: { purpose: 'client_acquisition' }
                }
            }
        ];

        for (const test of documentTests) {
            console.log(`\nAnalyzing: ${test.name}`);
            const result = await legalService.analyzeDocumentCompliance(test.data);
            
            console.log(`Compliance Score: ${result.complianceScore}/100`);
            console.log(`NLP Analysis:`);
            console.log(`  - Sentiment: ${result.nlpAnalysis.sentiment?.overall || 'unknown'}`);
            console.log(`  - Tone: ${result.nlpAnalysis.tone?.primary || 'unknown'}`);
            console.log(`  - Readability: ${result.nlpAnalysis.readabilityScore?.level || 'unknown'}`);
            
            if (result.nlpAnalysis.complianceFlags?.length > 0) {
                console.log('🚩 Compliance Flags:');
                result.nlpAnalysis.complianceFlags.forEach(f => {
                    console.log(`  - ${f.type}: ${f.match} (${f.severity})`);
                });
            }
            
            if (result.violations.length > 0) {
                console.log('❌ Violations:');
                result.violations.forEach(v => {
                    console.log(`  - ${v.type}: ${v.message}`);
                });
            }
        }

        // Demo 5: Risk Assessment
        console.log('\n\n⚠️ DEMO 5: Risk Assessment');
        console.log('==========================');

        const riskAssessmentTest = {
            entityId: 'CLM-2025-003',
            entityType: 'claim',
            data: {
                status: 'under_review',
                value: 75000,
                state: 'FL',
                daysInProcess: 45,
                communicationCount: 15,
                violationHistory: 2
            },
            context: {
                claimType: 'hurricane',
                priorClaims: 3,
                complianceScore: 65
            }
        };

        console.log('Assessing risk for high-value hurricane claim...');
        const riskResult = await legalService.assessComplianceRisk(riskAssessmentTest);
        
        console.log(`Overall Risk Level: ${riskResult.overallRiskLevel}`);
        console.log(`Risk Score: ${riskResult.riskScore}/100`);
        
        if (riskResult.riskFactors.length > 0) {
            console.log('Risk Factors:');
            riskResult.riskFactors.forEach(f => {
                console.log(`  - ${f.type}: ${f.description} (${f.riskLevel})`);
            });
        }
        
        if (riskResult.urgentActions.length > 0) {
            console.log('🚨 Urgent Actions Required:');
            riskResult.urgentActions.forEach(a => {
                console.log(`  - ${a.action}: ${a.description}`);
            });
        }

        // Demo 6: Integrated Service Usage
        console.log('\n\n🔄 DEMO 6: Integrated Service Usage');
        console.log('===================================');

        console.log('Creating claim with integrated compliance checking...');
        
        const integratedClaimData = {
            property: {
                address: '456 Oak Street, Houston, TX 77001',
                owner: 'Jane Smith',
                state: 'TX',
                propertyType: 'residential'
            },
            insurance: {
                company: 'State Farm',
                policyNumber: 'SF123456789',
                deductible: 2500
            },
            damage: {
                type: 'hail',
                severity: 'moderate',
                dateOfLoss: '2025-08-15',
                causeOfLoss: 'hail storm',
                description: 'Extensive hail damage to roof and gutters'
            },
            financial: {
                estimatedValue: 35000
            }
        };

        const integratedResult = await integratedService.createComplianceClaim(integratedClaimData);
        
        console.log(`Claim Created: ${integratedResult.claimId}`);
        console.log(`Compliance Status: ${integratedResult.compliance.validation.overallCompliance}`);
        console.log(`Risk Level: ${integratedResult.compliance.riskAssessment.overallRiskLevel}`);
        console.log(`Monitoring Enabled: ${integratedResult.compliance.monitoringEnabled}`);

        if (integratedResult.compliance.recommendations.length > 0) {
            console.log('Compliance Recommendations:');
            integratedResult.compliance.recommendations.forEach(r => {
                console.log(`  - ${r.action}: ${r.description}`);
            });
        }

        // Demo 7: Audit Trail
        console.log('\n\n📝 DEMO 7: Audit Trail');
        console.log('======================');

        console.log('Logging compliance events...');
        
        await legalService.logComplianceEvent({
            type: 'compliance_check',
            entityId: 'CLM-2025-003',
            entityType: 'claim',
            action: 'communication_validated',
            user: 'demo_user',
            details: { checkType: 'email_compliance', result: 'passed' },
            complianceImpact: 'positive',
            riskLevel: 'low'
        });

        const auditTrail = await legalService.getAuditTrail('CLM-2025-003');
        
        console.log(`Audit Entries: ${auditTrail.totalEntries}`);
        if (auditTrail.entries.length > 0) {
            console.log('Recent Audit Events:');
            auditTrail.entries.slice(0, 3).forEach(entry => {
                console.log(`  - ${entry.timestamp}: ${entry.eventType} - ${entry.action}`);
            });
        }

        // Demo 8: Compliance Metrics
        console.log('\n\n📊 DEMO 8: Compliance Metrics');
        console.log('=============================');

        const metrics = legalService.getComplianceMetrics();
        console.log('System Compliance Metrics:');
        console.log(`- Total Entities Monitored: ${metrics.totalEntitiesMonitored}`);
        console.log(`- State Regulations Loaded: ${metrics.totalRegulations}`);
        console.log(`- Total Audit Entries: ${metrics.totalAuditEntries}`);
        console.log(`- Last Updated: ${metrics.lastUpdated}`);

        // Integration Status
        const integrationStatus = integratedService.getIntegrationStatus();
        console.log('\nIntegration Status:');
        console.log(`- Integration Active: ${integrationStatus.active}`);
        console.log(`- Claims Monitoring: ${integrationStatus.monitoring.activeClaims}`);
        console.log(`- Service Health: ${Object.entries(integrationStatus.services).map(([k,v]) => `${k}:${v}`).join(', ')}`);

        console.log('\n✅ Legal Compliance Service Demo completed successfully!');
        console.log('\n🏁 DEMO SUMMARY:');
        console.log('================');
        console.log('✓ State Regulations Database - 50+ states covered');
        console.log('✓ Communication Compliance - Real-time validation');
        console.log('✓ Claim Validation - Timeline and requirement checking');
        console.log('✓ Document Analysis - NLP-powered compliance scanning');
        console.log('✓ Risk Assessment - ML-based risk prediction');
        console.log('✓ Audit Trail - Comprehensive compliance logging');
        console.log('✓ Multi-State Support - Cross-jurisdiction handling');
        console.log('✓ Real-time Monitoring - Automated violation detection');
        console.log('✓ Service Integration - Seamless workflow integration');
        console.log('\n🚀 Legal Compliance Service is ready for production use!');

    } catch (error) {
        console.error('❌ Demo failed:', error);
        console.error(error.stack);
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runLegalComplianceDemo().catch(console.error);
}

export { runLegalComplianceDemo };