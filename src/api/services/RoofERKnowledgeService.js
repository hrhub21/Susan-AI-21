import fs from 'fs-extra';
import path from 'path';
import OpenAI from 'openai';
import { DocumentProcessingService } from './DocumentProcessingService.js';

/**
 * Roof-ER Knowledge Service
 * Comprehensive knowledge management system for Roof-ER company information
 * Provides intelligent responses for employee queries with company context
 */
export class RoofERKnowledgeService {
    constructor() {
        // Only initialize OpenAI if API key is available
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey && apiKey !== 'your-api-key-here') {
            this.openai = new OpenAI({ apiKey });
        } else {
            console.warn('⚠️ OpenAI API key not configured for RoofERKnowledgeService');
            this.openai = null;
        }
        this.knowledgeBase = new Map();
        this.contextAwareness = new Map();
        this.escalationRules = new Map();
        this.responseTemplates = new Map();
        this.damageTemplates = new Map();
        this.documentProcessor = new DocumentProcessingService();
        
        // Company-specific terminology
        this.roofERTerminology = {
            'TPO': 'Thermoplastic Polyolefin - single-ply roofing membrane',
            'EPDM': 'Ethylene Propylene Diene Monomer - rubber roofing membrane',
            'Modified Bitumen': 'Asphalt-based roofing system with modifiers',
            'Field Tech': 'Field Technician - on-site service representative',
            'QA': 'Quality Assurance - inspection and quality control',
            'WO': 'Work Order - service request documentation',
            'COI': 'Certificate of Insurance - proof of coverage',
            'AM': 'Adjuster Meeting - insurance claim meeting',
            'GAF': 'GAF Materials Corporation - roofing manufacturer partner',
            'iTel': 'Insurance Technology - claims processing system'
        };
        
        // Department structure
        this.departments = {
            'sales': {
                name: 'Sales Department',
                contacts: ['Sales Manager', 'Regional Sales Director'],
                expertise: ['sales processes', 'customer relations', 'territory management']
            },
            'operations': {
                name: 'Operations Department',
                contacts: ['Operations Manager', 'Field Supervisor'],
                expertise: ['work orders', 'scheduling', 'field operations']
            },
            'qa': {
                name: 'Quality Assurance',
                contacts: ['QA Manager', 'Senior Inspector'],
                expertise: ['quality standards', 'inspections', 'compliance']
            },
            'hr': {
                name: 'Human Resources',
                contacts: ['HR Manager', 'HR Specialist'],
                expertise: ['employee benefits', 'policies', 'training']
            }
        };
        
        this.initializeKnowledgeBase();
    }
    
    async initializeKnowledgeBase() {
        console.log('🏢 Initializing Roof-ER Knowledge Base...');
        
        // Process actual company documents
        console.log('📁 Processing Roof-ER documents...');
        const documentEntries = await this.documentProcessor.processRoofERDocuments();
        
        // Add processed documents to knowledge base
        documentEntries.forEach(entry => {
            this.knowledgeBase.set(entry.id, entry);
        });
        
        // Load company knowledge categories
        await this.loadCompanyPolicies();
        await this.loadSalesResources();
        await this.loadTrainingMaterials();
        await this.loadInsuranceInformation();
        await this.loadOperationalProcedures();
        await this.setupResponseTemplates();
        await this.setupDamageTemplates();
        await this.configureEscalationRules();
        
        console.log('✅ Roof-ER Knowledge Base initialized with', this.knowledgeBase.size, 'knowledge entries');
        console.log('📊 Document processing stats:', this.documentProcessor.getProcessingStats());
    }
    
    async loadCompanyPolicies() {
        // Company mission, values, and commitment
        this.knowledgeBase.set('company_mission', {
            category: 'Company Information',
            content: `Roof-ER Mission: Providing exceptional roofing services with integrity and quality craftsmanship. 
            We are committed to helping customers navigate insurance claims and delivering superior roofing solutions.`,
            keywords: ['mission', 'values', 'company', 'purpose', 'commitment'],
            confidence: 1.0,
            source: 'Mission, Values, & Commitment.docx'
        });
        
        this.knowledgeBase.set('company_values', {
            category: 'Company Information',
            content: `Roof-ER Core Values:
            • Integrity in all business dealings
            • Quality craftsmanship and materials
            • Customer satisfaction and support
            • Professional expertise and training
            • Transparent communication
            • Compliance with all regulations`,
            keywords: ['values', 'integrity', 'quality', 'customer satisfaction'],
            confidence: 1.0,
            source: 'Company Documentation'
        });
    }
    
    async loadSalesResources() {
        // Sales operations and processes
        this.knowledgeBase.set('sales_operations', {
            category: 'Sales Operations',
            content: `Sales Operations Tasks:
            1. Initial customer contact and pitch
            2. Schedule property inspection
            3. Document damage assessment
            4. Prepare detailed estimates
            5. Submit insurance claims
            6. Coordinate with adjusters
            7. Follow up on claim status
            8. Schedule approved work
            
            Key Documentation:
            - Sales Tracker for progress monitoring
            - Territory maps for coverage areas
            - Email templates for customer communication`,
            keywords: ['sales', 'operations', 'process', 'claims', 'estimates'],
            confidence: 1.0,
            source: 'Sales Operations and Tasks.docx'
        });
        
        this.knowledgeBase.set('territory_coverage', {
            category: 'Sales Operations',
            content: `Roof-ER Service Territories:
            • DMV Area (DC, Maryland, Virginia)
            • Philadelphia Region
            • Richmond Area
            
            Each territory has specific:
            - Building codes and requirements
            - Insurance regulations
            - Local contractor licensing
            - Territory maps available for reference`,
            keywords: ['territory', 'coverage', 'areas', 'DMV', 'Philadelphia', 'Richmond'],
            confidence: 1.0,
            source: 'Territory Maps'
        });
    }
    
    async loadTrainingMaterials() {
        // Training and damage assessment
        this.knowledgeBase.set('damage_assessment', {
            category: 'Training',
            content: `Damage Assessment Training:
            
            Wind Damage Identification:
            • Look for lifted, cracked, or missing shingles
            • Check for exposed nail heads
            • Document granule loss patterns
            • Photograph all damage areas
            
            Inspection Process:
            1. Exterior visual inspection
            2. Attic/interior moisture check  
            3. Detailed photo documentation
            4. Measurement and scope development
            5. Damage report preparation
            
            Quality Standards:
            - Follow GAF guidelines for assessments
            - Use proper safety equipment
            - Maintain detailed documentation`,
            keywords: ['damage', 'assessment', 'training', 'wind', 'inspection'],
            confidence: 1.0,
            source: 'Training Materials'
        });
    }
    
    async loadInsuranceInformation() {
        // Insurance processes and claims
        this.knowledgeBase.set('insurance_claims', {
            category: 'Insurance',
            content: `Insurance Claims Process:
            
            1. Initial Claim Filing:
            • Help customer contact insurance company
            • Provide claim filing information sheet
            • Schedule adjuster meeting
            
            2. Adjuster Meeting Preparation:
            • Review property damage thoroughly
            • Prepare supporting documentation
            • Have code compliance information ready
            
            3. Post-Meeting Follow-up:
            • Review adjuster findings
            • Address any coverage disputes
            • Submit additional documentation if needed
            
            4. Approval and Scheduling:
            • Review approved scope of work
            • Coordinate materials and scheduling
            • Obtain required permits`,
            keywords: ['insurance', 'claims', 'adjuster', 'coverage', 'approval'],
            confidence: 1.0,
            source: 'Insurance Process Documentation'
        });
        
        this.knowledgeBase.set('insurance_arguments', {
            category: 'Insurance',
            content: `Insurance Argument Resources:
            
            Common Issues and Solutions:
            • Partial vs. Full Replacement arguments
            • Building code compliance requirements
            • Double layer removal necessity
            • Matching requirements for visible areas
            • Slope replacement per GAF guidelines
            
            Supporting Documentation:
            - Building code references
            - GAF storm damage guidelines
            - State-specific requirements
            - Engineering reports when needed
            - Complaint forms for disputes
            
            Escalation Process:
            - Department of Insurance complaints
            - Arbitration procedures
            - Engineer consultation`,
            keywords: ['insurance', 'arguments', 'disputes', 'codes', 'arbitration'],
            confidence: 1.0,
            source: 'Insurance Argument Resources'
        });
    }
    
    async loadOperationalProcedures() {
        // Operational procedures and workflows
        this.knowledgeBase.set('repair_attempts', {
            category: 'Operations',
            content: `Repair Attempt Process:
            
            When Required:
            • Insurance company requests repair attempt
            • Damage appears minor but replacement needed
            • Adjuster wants demonstration of repair failure
            
            Documentation Steps:
            1. Video record the repair attempt
            2. Show why repair won't be effective
            3. Document material compatibility issues
            4. Demonstrate code compliance concerns
            5. Provide written explanation
            
            Follow-up:
            • Submit video and documentation to adjuster
            • Request reconsideration for full replacement
            • Schedule follow-up meeting if needed`,
            keywords: ['repair', 'attempt', 'documentation', 'video', 'process'],
            confidence: 1.0,
            source: 'How to do a Repair Attempt [EXAMPLE].docx'
        });
    }
    
    async setupResponseTemplates() {
        // Email and communication templates
        this.responseTemplates.set('estimate_request', {
            subject: 'Estimate Request Follow-up',
            template: `Hi [Customer Name],

Thank you for contacting Roof-ER regarding your roofing needs. I wanted to follow up on your estimate request.

Next Steps:
1. Schedule property inspection at your convenience
2. Complete thorough damage assessment
3. Provide detailed written estimate
4. Assist with insurance claim if applicable

Our certified inspectors are available [availability]. Would [specific time] work for your schedule?

Best regards,
[Rep Name]
Roof-ER Sales Representative
[Contact Information]`,
            category: 'Customer Communication'
        });
        
        this.responseTemplates.set('post_adjuster_meeting', {
            subject: 'Post-Adjuster Meeting Summary',
            template: `Hi [Customer Name],

Following today's adjuster meeting, here's a summary of the outcomes:

Meeting Results:
• [Approved/Denied/Partial] coverage determination
• Scope of work: [Details]
• Next steps: [Action items]

If you have questions about the adjuster's decision or need assistance with next steps, please don't hesitate to contact me.

Best regards,
[Rep Name]
Roof-ER Sales Representative
[Contact Information]`,
            category: 'Insurance Communication'
        });
    }
    
    async configureEscalationRules() {
        // Define when to escalate to management
        this.escalationRules.set('unknown_policy', {
            trigger: 'company policy questions with low confidence',
            action: 'escalate to HR Manager',
            message: 'For specific policy questions, please contact your HR Manager or supervisor for the most current information.'
        });
        
        this.escalationRules.set('technical_procedures', {
            trigger: 'complex technical procedures',
            action: 'escalate to Operations Manager',
            message: 'For detailed technical procedures, please consult with your Operations Manager or Field Supervisor.'
        });
        
        this.escalationRules.set('insurance_complex', {
            trigger: 'complex insurance disputes',
            action: 'escalate to Sales Manager',
            message: 'For complex insurance matters, please contact your Sales Manager for specialized guidance.'
        });
    }
    
    async processQuery(query, context = {}) {
        try {
            console.log(`🤔 Processing Roof-ER query: "${query}"`);
            
            // Analyze query intent and context
            const analysis = await this.analyzeQuery(query, context);
            
            // Search knowledge base
            const matches = this.searchKnowledgeBase(query, analysis);
            
            // Generate response with company context
            const response = await this.generateContextualResponse(query, matches, analysis);
            
            // Check if escalation is needed
            const escalation = this.checkEscalation(analysis, response);
            
            return {
                response: response.content,
                confidence: response.confidence,
                sources: response.sources,
                escalation: escalation,
                category: analysis.category,
                examples: response.examples,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error processing Roof-ER query:', error);
            return {
                response: "I apologize, but I'm having trouble processing your request. Please reach out to your supervisor or HR for assistance.",
                confidence: 0,
                escalation: {
                    needed: true,
                    contact: 'Supervisor or HR Manager',
                    reason: 'System error - requires human assistance'
                }
            };
        }
    }
    
    async analyzeQuery(query, context) {
        // Simple intent analysis - can be enhanced with ML models
        const lowercaseQuery = query.toLowerCase();
        
        const categories = {
            'sales': ['sales', 'estimate', 'customer', 'territory', 'pitch'],
            'insurance': ['insurance', 'claim', 'adjuster', 'coverage', 'dispute'],
            'operations': ['repair', 'inspection', 'damage', 'quality', 'field'],
            'hr': ['policy', 'benefits', 'training', 'employee', 'hr'],
            'company': ['mission', 'values', 'company', 'contact']
        };
        
        let category = 'general';
        let confidence = 0.5;
        
        for (const [cat, keywords] of Object.entries(categories)) {
            const matches = keywords.filter(keyword => lowercaseQuery.includes(keyword)).length;
            if (matches > 0) {
                category = cat;
                confidence = Math.min(0.9, 0.5 + (matches * 0.1));
                break;
            }
        }
        
        return {
            category,
            confidence,
            intent: this.determineIntent(lowercaseQuery),
            context: context
        };
    }
    
    determineIntent(query) {
        if (query.includes('how to') || query.includes('process') || query.includes('steps')) {
            return 'procedure';
        } else if (query.includes('what is') || query.includes('define') || query.includes('explain')) {
            return 'definition';
        } else if (query.includes('contact') || query.includes('who') || query.includes('reach')) {
            return 'contact_info';
        } else if (query.includes('template') || query.includes('example') || query.includes('format')) {
            return 'template';
        }
        return 'general';
    }
    
    searchKnowledgeBase(query, analysis) {
        const results = [];
        const queryWords = query.toLowerCase().split(/\s+/);
        
        for (const [key, entry] of this.knowledgeBase.entries()) {
            let score = 0;
            
            // Check keywords match
            const keywordMatches = entry.keywords.filter(keyword => 
                queryWords.some(word => word.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(word))
            ).length;
            
            score += keywordMatches * 0.3;
            
            // Check category match
            if (entry.category.toLowerCase().includes(analysis.category)) {
                score += 0.4;
            }
            
            // Check content relevance (simple text matching)
            const contentWords = entry.content.toLowerCase().split(/\s+/);
            const contentMatches = queryWords.filter(word => 
                contentWords.some(contentWord => contentWord.includes(word))
            ).length;
            
            score += (contentMatches / queryWords.length) * 0.3;
            
            if (score > 0.2) {
                results.push({
                    key,
                    entry,
                    score,
                    relevance: Math.min(1.0, score)
                });
            }
        }
        
        return results.sort((a, b) => b.score - a.score).slice(0, 3);
    }
    
    async generateContextualResponse(query, matches, analysis) {
        if (matches.length === 0) {
            return {
                content: "I don't have specific information about that topic in my knowledge base. Please contact your supervisor or the appropriate department for guidance.",
                confidence: 0.1,
                sources: [],
                examples: []
            };
        }
        
        const primaryMatch = matches[0];
        let response = primaryMatch.entry.content;
        
        // Add examples if it's a template request
        const examples = [];
        if (analysis.intent === 'template') {
            const template = this.findRelevantTemplate(query);
            if (template) {
                examples.push({
                    title: 'Email Template',
                    content: template.template
                });
            }
        }
        
        // Add terminology explanations
        response = this.addTerminologyExplanations(response);
        
        // Format response for readability
        response = this.formatResponse(response, analysis.intent);
        
        return {
            content: response,
            confidence: primaryMatch.relevance * primaryMatch.entry.confidence,
            sources: matches.map(match => match.entry.source),
            examples: examples
        };
    }
    
    findRelevantTemplate(query) {
        for (const [key, template] of this.responseTemplates.entries()) {
            if (query.toLowerCase().includes(key.replace('_', ' '))) {
                return template;
            }
        }
        return null;
    }
    
    addTerminologyExplanations(text) {
        let explanationText = text;
        
        for (const [term, definition] of Object.entries(this.roofERTerminology)) {
            if (explanationText.includes(term)) {
                explanationText = explanationText.replace(
                    new RegExp(term, 'g'),
                    `${term} (${definition})`
                );
            }
        }
        
        return explanationText;
    }
    
    formatResponse(response, intent) {
        // Add helpful formatting based on intent
        if (intent === 'procedure') {
            return `📋 **Process Guide:**\n\n${response}\n\n💡 *Need additional help? Contact your supervisor for detailed guidance.*`;
        } else if (intent === 'definition') {
            return `📖 **Definition:**\n\n${response}`;
        } else if (intent === 'contact_info') {
            return `📞 **Contact Information:**\n\n${response}`;
        }
        
        return response;
    }
    
    checkEscalation(analysis, response) {
        // Check if escalation is needed based on confidence and rules
        if (response.confidence < 0.5) {
            const department = this.departments[analysis.category];
            return {
                needed: true,
                contact: department ? department.contacts[0] : 'Your Supervisor',
                department: department ? department.name : 'Management',
                reason: 'Low confidence in response - requires expert guidance'
            };
        }
        
        return { needed: false };
    }
    
    async getCompanyDirectory() {
        return {
            departments: this.departments,
            terminology: this.roofERTerminology,
            knowledgeCategories: [...new Set(Array.from(this.knowledgeBase.values()).map(entry => entry.category))]
        };
    }
    
    async getKnowledgeStats() {
        const stats = {
            totalEntries: this.knowledgeBase.size,
            categories: {},
            averageConfidence: 0
        };
        
        let totalConfidence = 0;
        for (const entry of this.knowledgeBase.values()) {
            if (!stats.categories[entry.category]) {
                stats.categories[entry.category] = 0;
            }
            stats.categories[entry.category]++;
            totalConfidence += entry.confidence;
        }
        
        stats.averageConfidence = totalConfidence / this.knowledgeBase.size;
        
        return stats;
    }

    async setupDamageTemplates() {
        // Hail damage templates
        this.damageTemplates.set('hail_mild', {
            damageType: 'hail',
            severity: 'mild',
            template: {
                subject: 'Hail Damage Assessment - Minor Impact Detected',
                documentation: `Hail Damage Assessment Report
                
Property: [ADDRESS]
Date of Inspection: [DATE]
Inspector: [INSPECTOR NAME]

FINDINGS:
• Minor hail impacts detected: [COUNT] impacts
• Average impact size: [SIZE]mm diameter
• Granule displacement observed but minimal
• No immediate structural concerns

RECOMMENDATIONS:
• Monitor for accelerated aging
• Document for insurance records
• Schedule follow-up inspection in 6 months
• Consider preventive maintenance

PHOTOS:
• [PHOTO_COUNT] high-resolution images attached
• Impact locations marked and measured
• Before/after comparison available

Next Steps:
1. Present findings to property owner
2. File insurance claim documentation
3. Provide copy for property records`,
                
                customerEmail: `Dear [CUSTOMER_NAME],

Following our inspection of your property at [ADDRESS], we have identified minor hail damage to your roof. While the damage is currently minimal, it's important to document these findings for your records.

Our AI-enhanced analysis detected [IMPACT_COUNT] hail impacts with an average size of [AVG_SIZE]mm. The damage is classified as mild severity, but we recommend filing with your insurance company to establish a record.

Attached you'll find:
• Detailed damage report with AI analysis
• High-resolution photos with damage markers
• Insurance claim documentation package

We'll follow up in 30 days to check on your claim status and answer any questions.

Best regards,
[INSPECTOR_NAME]
Roof-ER Certified Inspector`
            }
        });

        this.damageTemplates.set('hail_moderate', {
            damageType: 'hail',
            severity: 'moderate',
            template: {
                subject: 'Significant Hail Damage Detected - Immediate Action Required',
                documentation: `URGENT: Hail Damage Assessment Report

Property: [ADDRESS]
Date of Inspection: [DATE]
Inspector: [INSPECTOR NAME]
Urgency Level: MODERATE TO HIGH

CRITICAL FINDINGS:
• Significant hail impacts: [COUNT] impacts detected
• Impact sizes ranging from [MIN_SIZE]mm to [MAX_SIZE]mm
• Granule loss percentage: [GRANULE_LOSS]%
• Exposed mat visible in multiple areas
• Potential for accelerated deterioration

IMMEDIATE RECOMMENDATIONS:
• File insurance claim within 48 hours
• Schedule adjuster meeting ASAP
• Consider temporary protective measures
• Prioritize repair timeline

DETAILED ANALYSIS:
• AI confidence score: [CONFIDENCE]%
• Damage distribution: [PATTERN]
• Estimated repair cost: $[ESTIMATE]
• Expected insurance claim strength: [CLAIM_STRENGTH]

SUPPORTING EVIDENCE:
• [PHOTO_COUNT] annotated damage photos
• Heat map showing damage concentration
• Before/after comparison imagery
• Professional damage assessment report

NEXT STEPS - URGENT:
1. Contact insurance company immediately
2. Schedule adjuster inspection
3. Prepare supporting documentation
4. Plan repair timeline and materials`,

                customerEmail: `URGENT: Significant Roof Damage Detected

Dear [CUSTOMER_NAME],

Our inspection has revealed significant hail damage to your roof at [ADDRESS]. This requires immediate attention to prevent further deterioration and potential water damage.

KEY FINDINGS:
• [IMPACT_COUNT] hail impacts detected
• [GRANULE_LOSS]% granule loss measured
• Damage severity: MODERATE to HIGH
• Estimated repair cost: $[ESTIMATE]

IMMEDIATE ACTION REQUIRED:
1. Contact your insurance company today
2. File claim within 48 hours
3. Schedule adjuster meeting this week
4. Consider temporary protection if needed

We've prepared a comprehensive documentation package including AI-enhanced damage analysis, annotated photos, and insurance claim support materials.

Our team is standing by to assist with your insurance claim and coordinate repairs. Please call [PHONE] immediately to discuss next steps.

Time is critical - please act today.

Sincerely,
[INSPECTOR_NAME]
Roof-ER Emergency Response Team`
            }
        });

        this.damageTemplates.set('hail_severe', {
            damageType: 'hail',
            severity: 'severe',
            template: {
                subject: 'CRITICAL: Severe Hail Damage - Emergency Response Required',
                documentation: `EMERGENCY ROOF DAMAGE ASSESSMENT

Property: [ADDRESS]
Date of Inspection: [DATE]
Inspector: [INSPECTOR NAME]
URGENCY LEVEL: CRITICAL - IMMEDIATE ACTION REQUIRED

EMERGENCY FINDINGS:
• Severe hail damage with [COUNT] major impacts
• Large impact sizes: [AVG_SIZE]mm average diameter
• Extensive granule loss: [GRANULE_LOSS]%
• Multiple areas of exposed/damaged substrate
• HIGH RISK of immediate water intrusion

CRITICAL CONCERNS:
• Compromised weather barrier integrity
• Multiple penetration points identified
• Accelerated aging and deterioration
• Potential interior water damage risk

EMERGENCY RECOMMENDATIONS:
• IMMEDIATE insurance claim filing
• Emergency tarping may be required
• Fast-track adjuster inspection
• Prioritize complete roof replacement

COMPREHENSIVE ANALYSIS:
• AI analysis confidence: [CONFIDENCE]%
• Damage classification: SEVERE
• Repair viability: NOT RECOMMENDED
• Replacement necessity: CONFIRMED
• Estimated cost: $[ESTIMATE]

EMERGENCY DOCUMENTATION:
• [PHOTO_COUNT] detailed damage photos
• Thermal damage heat mapping
• 360-degree damage assessment
• Professional emergency report
• Insurance claim priority package

EMERGENCY ACTION PLAN:
1. File insurance claim TODAY
2. Request emergency adjuster inspection
3. Implement temporary weather protection
4. Schedule complete roof replacement
5. Monitor for interior water damage`,

                customerEmail: `EMERGENCY: Critical Roof Damage Detected

Dear [CUSTOMER_NAME],

URGENT NOTICE: Our inspection has identified SEVERE hail damage to your roof at [ADDRESS]. This situation requires immediate emergency response to protect your property.

CRITICAL FINDINGS:
• [IMPACT_COUNT] severe hail impacts
• [GRANULE_LOSS]% granule loss (critical level)
• Multiple compromise points detected
• HIGH RISK of water intrusion

EMERGENCY ACTIONS REQUIRED TODAY:
1. Contact insurance company IMMEDIATELY
2. Request emergency claim processing
3. Schedule adjuster inspection within 24-48 hours
4. Consider temporary tarping/protection

Your roof has sustained damage that compromises its ability to protect your home. Our AI-enhanced assessment confirms this as a priority emergency requiring complete replacement.

We have prepared an emergency documentation package and are standing by for immediate deployment of protective measures if needed.

CALL OUR EMERGENCY LINE: [EMERGENCY_PHONE]
Available 24/7 for critical damage situations

Do not delay - act immediately to protect your property.

Emergency Response Team,
Roof-ER Critical Damage Division`
            }
        });

        // Wind damage templates
        this.damageTemplates.set('wind_moderate', {
            damageType: 'wind',
            severity: 'moderate',
            template: {
                subject: 'Wind Damage Assessment - Repair Required',
                documentation: `Wind Damage Assessment Report

Property: [ADDRESS]
Date of Inspection: [DATE]
Inspector: [INSPECTOR NAME]

WIND DAMAGE FINDINGS:
• Lifted/loose shingles detected: [COUNT] areas
• Damage pattern: [PATTERN]
• Affected roof area: [AREA_PERCENTAGE]%
• Edge damage severity: MODERATE

STRUCTURAL ASSESSMENT:
• Shingle attachment integrity compromised
• Exposed nail heads identified
• Potential water intrusion points
• Immediate repair recommended

REPAIR RECOMMENDATIONS:
• Secure loose shingles immediately
• Replace damaged sections
• Inspect and repair flashing
• Apply additional fasteners as needed

DOCUMENTATION INCLUDED:
• [PHOTO_COUNT] damage assessment photos
• Wind pattern analysis
• Repair scope documentation
• Insurance claim support materials`,

                customerEmail: `Wind Damage Assessment Results

Dear [CUSTOMER_NAME],

Our inspection of your roof at [ADDRESS] has identified wind damage requiring prompt attention. While not immediately critical, these issues should be addressed to prevent escalation.

FINDINGS:
• [LIFTED_SHINGLES] areas of wind damage
• Moderate severity classification
• Repair needed to prevent water intrusion

We recommend filing an insurance claim and scheduling repairs within 2-3 weeks. Our team can coordinate with your insurance adjuster and provide detailed repair estimates.

Best regards,
[INSPECTOR_NAME]`
            }
        });

        // Granule loss templates
        this.damageTemplates.set('granule_significant', {
            damageType: 'granule_loss',
            severity: 'significant',
            template: {
                subject: 'Significant Granule Loss Assessment',
                documentation: `Granule Loss Assessment Report

Property: [ADDRESS]
Date of Inspection: [DATE]
Inspector: [INSPECTOR NAME]

GRANULE LOSS ANALYSIS:
• Granule loss percentage: [PERCENTAGE]%
• Classification: SIGNIFICANT
• UV protection compromised
• Accelerated aging evident

TECHNICAL ASSESSMENT:
• Uniform loss pattern: [UNIFORMITY]
• Exposed mat areas: [EXPOSED_AREAS]
• Remaining service life: REDUCED
• Replacement recommended

AI ANALYSIS RESULTS:
• Detection confidence: [CONFIDENCE]%
• Texture analysis complete
• Granule distribution mapping
• Deterioration progression modeling

RECOMMENDATIONS:
• Plan roof replacement within 12-18 months
• File insurance claim for age-related damage
• Monitor for accelerated deterioration
• Consider protective coatings as interim measure`,

                customerEmail: `Important: Granule Loss Assessment

Dear [CUSTOMER_NAME],

Our analysis has identified significant granule loss on your roof at [ADDRESS]. This condition affects your roof's ability to protect against UV damage and weather.

FINDINGS:
• [PERCENTAGE]% granule loss measured
• Reduced protective capability
• Replacement planning recommended

While not immediately urgent, this condition will worsen over time. We recommend discussing replacement options and potential insurance coverage.

Best regards,
[INSPECTOR_NAME]`
            }
        });

        // Collateral damage templates  
        this.damageTemplates.set('collateral_multiple', {
            damageType: 'collateral',
            severity: 'moderate',
            template: {
                subject: 'Collateral Storm Damage Assessment',
                documentation: `Collateral Damage Assessment Report

Property: [ADDRESS]
Date of Inspection: [DATE]
Inspector: [INSPECTOR NAME]

COLLATERAL DAMAGE IDENTIFIED:
• Gutters: [GUTTER_DAMAGE]
• Vents: [VENT_DAMAGE]
• Flashing: [FLASHING_DAMAGE]
• Soft metals: [METAL_DAMAGE]
• Other components: [OTHER_DAMAGE]

DAMAGE SUMMARY:
• [COMPONENT_COUNT] building components affected
• Repair complexity: [COMPLEXITY]
• Coordination required with multiple trades
• Insurance claim recommended

REPAIR SCOPE:
• Component-specific repairs outlined
• Material specifications provided
• Timeline and coordination requirements
• Cost estimates included

INSURANCE CONSIDERATIONS:
• Multiple component damage strengthens claim
• Professional documentation provided
• Comprehensive scope of work available
• Adjuster meeting recommended`,

                customerEmail: `Collateral Storm Damage Report

Dear [CUSTOMER_NAME],

Our inspection has identified storm damage to multiple building components at [ADDRESS] beyond just the roof system.

COMPONENTS DAMAGED:
• [DAMAGE_LIST]

This collateral damage strengthens your insurance claim and should be included in your filing. We've prepared comprehensive documentation for your adjuster review.

Best regards,
[INSPECTOR_NAME]`
            }
        });

        console.log('📋 Damage templates initialized:', this.damageTemplates.size, 'templates loaded');
    }

    async getDamageTemplates(damageType = null, severity = null) {
        try {
            let templates = [];
            
            for (const [key, template] of this.damageTemplates.entries()) {
                // Filter by damage type if specified
                if (damageType && template.damageType !== damageType) {
                    continue;
                }
                
                // Filter by severity if specified
                if (severity && template.severity !== severity) {
                    continue;
                }
                
                templates.push({
                    id: key,
                    damageType: template.damageType,
                    severity: template.severity,
                    template: template.template
                });
            }
            
            // If no specific filters, return all templates organized by type
            if (!damageType && !severity) {
                const organized = {
                    hail: templates.filter(t => t.damageType === 'hail'),
                    wind: templates.filter(t => t.damageType === 'wind'),
                    granule_loss: templates.filter(t => t.damageType === 'granule_loss'),
                    collateral: templates.filter(t => t.damageType === 'collateral')
                };
                
                return organized;
            }
            
            return templates;
            
        } catch (error) {
            console.error('❌ Error retrieving damage templates:', error);
            return [];
        }
    }

    async getRelevantTemplates(damageAssessment) {
        try {
            const relevantTemplates = [];
            
            // Get templates based on detected damage types
            if (damageAssessment.overall.severity !== 'none') {
                
                // Add hail templates if hail damage detected
                if (damageAssessment.aggregated?.hailImpacts > 0) {
                    const hailSeverity = this.classifyHailSeverity(damageAssessment.aggregated.hailImpacts);
                    const hailTemplates = await this.getDamageTemplates('hail', hailSeverity);
                    relevantTemplates.push(...hailTemplates);
                }
                
                // Add wind templates if wind damage detected
                if (damageAssessment.aggregated?.liftedShingles > 0) {
                    const windTemplates = await this.getDamageTemplates('wind', 'moderate');
                    relevantTemplates.push(...windTemplates);
                }
                
                // Add granule loss templates if significant loss detected
                if (damageAssessment.aggregated?.granuleLoss > 20) {
                    const granuleTemplates = await this.getDamageTemplates('granule_loss', 'significant');
                    relevantTemplates.push(...granuleTemplates);
                }
                
                // Add collateral damage templates if multiple components affected
                const collateralTemplates = await this.getDamageTemplates('collateral', 'moderate');
                relevantTemplates.push(...collateralTemplates);
            }
            
            return relevantTemplates;
            
        } catch (error) {
            console.error('❌ Error getting relevant templates:', error);
            return [];
        }
    }

    classifyHailSeverity(impactCount) {
        if (impactCount < 5) return 'mild';
        if (impactCount < 15) return 'moderate';
        return 'severe';
    }

    async generateDamageReport(damageAssessment, templateType = null) {
        try {
            // Get the most relevant template based on damage assessment
            const templates = await this.getRelevantTemplates(damageAssessment);
            
            if (templates.length === 0) {
                return {
                    error: 'No relevant templates found for damage type',
                    fallback: 'Use standard damage report template'
                };
            }
            
            // Use the first (most relevant) template
            const template = templates[0];
            
            // Replace template variables with actual damage data
            const populatedTemplate = this.populateTemplate(template.template, damageAssessment);
            
            return {
                templateId: template.id,
                damageType: template.damageType,
                severity: template.severity,
                report: populatedTemplate,
                additionalTemplates: templates.slice(1) // Other relevant templates
            };
            
        } catch (error) {
            console.error('❌ Error generating damage report:', error);
            return { error: 'Report generation failed' };
        }
    }

    populateTemplate(template, damageData) {
        try {
            let populatedTemplate = { ...template };
            
            // Replace common variables in all template sections
            const replacements = {
                '[COUNT]': damageData.aggregated?.hailImpacts || 0,
                '[IMPACT_COUNT]': damageData.aggregated?.hailImpacts || 0,
                '[LIFTED_SHINGLES]': damageData.aggregated?.liftedShingles || 0,
                '[GRANULE_LOSS]': Math.round(damageData.aggregated?.granuleLoss || 0),
                '[PERCENTAGE]': Math.round(damageData.aggregated?.granuleLoss || 0),
                '[CONFIDENCE]': Math.round(damageData.overall?.confidence * 100 || 0),
                '[ESTIMATE]': damageData.costEstimate || 'TBD',
                '[PHOTO_COUNT]': damageData.aggregated?.photosAnalyzed || 1,
                '[DATE]': new Date().toLocaleDateString(),
                '[SEVERITY]': damageData.overall?.severity?.toUpperCase() || 'UNKNOWN'
            };
            
            // Apply replacements to each section of the template
            for (const [section, content] of Object.entries(populatedTemplate)) {
                if (typeof content === 'string') {
                    let updatedContent = content;
                    for (const [placeholder, value] of Object.entries(replacements)) {
                        updatedContent = updatedContent.replace(new RegExp(placeholder, 'g'), value);
                    }
                    populatedTemplate[section] = updatedContent;
                }
            }
            
            return populatedTemplate;
            
        } catch (error) {
            console.error('❌ Error populating template:', error);
            return template; // Return original template if population fails
        }
    }
}