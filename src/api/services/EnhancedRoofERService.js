import fs from 'fs-extra';
import path from 'path';
import OpenAI from 'openai';
import { DocumentProcessingService } from './DocumentProcessingService.js';
import { findRoofingKnowledge, formatRoofingAnswer } from '../../core/roofing-knowledge.js';

/**
 * Enhanced Roof-ER Service - SUSAN AI Specialized Assistant
 * Real-time assistant for roofing sales reps and field professionals
 * Focused on getting full approvals on insurance claims in VA, MD, PA
 */
export class EnhancedRoofERService {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.knowledgeBase = new Map();
        this.templateLibrary = new Map();
        this.stateCodeLibrary = new Map();
        this.escalationMatrix = new Map();
        this.documentProcessor = new DocumentProcessingService();
        
        // Susan's specialized personality traits
        this.personality = {
            role: 'Real-time assistant for roofing sales reps and field professionals working with Roof-ER',
            mission: 'Get full approvals on insurance claims in Virginia, Maryland, and Pennsylvania',
            approach: 'Use manufacturer documentation, building codes, and persuasive communication',
            style: 'Professional, direct, clear, empathetic but solution-focused',
            assumption: 'Rep is in field and time-limited',
            generalAssistance: "I'm happy to help with any topic! While I specialize in roofing and insurance claims, I can assist with a wide range of questions and provide educational information on various subjects."
        };
        
        // Response structure template
        this.responseStructure = {
            immediate_answer: '', // What to send or say, directly
            supporting_evidence: '', // Code, manufacturer guidance, photo references, template source
            ready_to_use_content: '', // Email/message templates
            next_steps: '' // What rep should do or ask homeowner to do
        };
        
        // Knowledge source priorities (exact order)
        this.knowledgePriorities = [
            'roof_er_templates', // Email, Photo, Repair, Siding, iTel
            'discontinued_shingle_list',
            'itel_reports',
            'state_building_codes', // VA R905, MD R703, etc.
            'gaf_guidelines', // Repairability, Storm Damage, Underlayment
            'roof_er_training'
        ];
        
        // Escalation protocol
        this.escalationOrder = ['Peer rep', 'Team Leader', 'Sales Manager'];
        
        this.initializeEnhancedSystem();
    }
    
    async initializeEnhancedSystem() {
        console.log('🎯 Initializing Enhanced SUSAN AI - Roof-ER Specialist...');
        
        // Process Roof-ER documents with enhanced categorization
        const documentEntries = await this.documentProcessor.processRoofERDocuments();
        
        // Enhanced categorization and priority assignment
        documentEntries.forEach(entry => {
            this.categorizeAndPrioritize(entry);
            this.knowledgeBase.set(entry.id, entry);
        });
        
        // Load specialized templates and resources
        await this.loadRoofERTemplates();
        await this.loadStateCodeLibrary();
        await this.loadGAFGuidelines();
        await this.loadRoofingComponents();
        await this.setupEscalationMatrix();
        
        console.log('✅ Enhanced SUSAN AI initialized - Ready to help reps close claims!');
        console.log(`📊 Knowledge Base: ${this.knowledgeBase.size} entries`);
        console.log(`📋 Templates: ${this.templateLibrary.size} ready-to-use templates`);
        console.log(`📜 State Codes: ${this.stateCodeLibrary.size} code references`);
    }
    
    categorizeAndPrioritize(entry) {
        // Enhanced categorization based on Susan's knowledge priorities
        const filename = entry.metadata.filename.toLowerCase();
        const content = entry.content.toLowerCase();
        
        if (filename.includes('template') || content.includes('template')) {
            entry.priority = 1;
            entry.category = 'roof_er_templates';
            entry.susanCategory = 'template';
        } else if (filename.includes('discontinued') || content.includes('discontinued')) {
            entry.priority = 2;
            entry.category = 'discontinued_shingle_list';
            entry.susanCategory = 'discontinued_materials';
        } else if (filename.includes('itel') || content.includes('itel')) {
            entry.priority = 3;
            entry.category = 'itel_reports';
            entry.susanCategory = 'itel_analysis';
        } else if (filename.includes('code') || content.includes('building code')) {
            entry.priority = 4;
            entry.category = 'state_building_codes';
            entry.susanCategory = 'building_codes';
        } else if (filename.includes('gaf') || content.includes('gaf')) {
            entry.priority = 5;
            entry.category = 'gaf_guidelines';
            entry.susanCategory = 'manufacturer_guidelines';
        } else if (filename.includes('training') || content.includes('training')) {
            entry.priority = 6;
            entry.category = 'roof_er_training';
            entry.susanCategory = 'training_materials';
        } else {
            entry.priority = 7;
            entry.category = 'general';
            entry.susanCategory = 'general_roofing';
        }
    }
    
    async loadRoofERTemplates() {
        // ACTUAL Roof-ER email templates from company documents
        this.templateLibrary.set('photo_report_template', {
            name: 'Photo Report Template',
            scenario: 'photo_documentation',
            content: `To whom it may concern

You will find our photo report attached to this email citing additional damage not accounted for in your initial decision. 

[FOR PARTIAL APPROVAL:]
This damage is consistent with what has already been approved which leaves us and the homeowner unsure why these findings were left off of the estimate.

[FOR FULL DENIAL:]
The extent of the wind AND/OR hail damage can be seen in the photo report.

[Additional items to mention:]
• Noting damage to the soft metals, gutter, downspouts, etc.
• Would be more expensive to replace in patch form
• Clear areas that may be causing interior leaks

Please review these findings and revise your estimate/scope of work accordingly so we can begin to move forward with the full replacement for [HOMEOWNER'S NAME].

If we can provide additional information, please let us know.

Thank you for your time and for working with us to assist [HOMEOWNER'S NAME] in restoring their property effectively after the loss they have experienced.

Your signature with your contact information`,
            next_steps: 'Send to Adjuster/Insurance and CC the customer. Attach photo report documentation.'
        });
        
        this.templateLibrary.set('generic_partial_template', {
            name: 'Generic Partial Template',
            scenario: 'partial_denial',
            content: `To whom it may concern:

This is [REP NAME] with Roof ER. I am assisting [CUSTOMER's NAME]. We have attached our repair estimate and/or accompanying documentation for your review.

[insert rep argument here]

Please let us know if you have any questions/concerns regarding our estimate and provide us with a revised estimate accounting for the additional damages found during our inspection at your earliest convenience.

If you would like to perform an additional inspection of the property, please let us know when you would like to do so by contacting me at the information below.

We appreciate your time and assistance in reviewing this information and look forward to reaching a timely resolution on the scope of repairs.

Your Signature with your contact information`,
            next_steps: 'Send to Adjuster/Insurance company with customer CC\'d. CC or BCC Reese if needed.'
        });
        
        this.templateLibrary.set('repair_attempt_template', {
            name: 'Repair Attempt Template',
            scenario: 'repair_attempt',
            content: `To whom it may concern

Please see the attached photo and/or video of the attempted repair for the claim number referenced in the subject line.

As can be clearly seen in the photos AND/OR video, the homeowner's roof sustained additional damage during the attempted repairs. This confirms a failed brittle test indicating irreparability.

Please review these findings and revise your estimate/scope of work accordingly so we can begin to move forward with the full replacement for [HOMEOWNER'S NAME].

If we can provide additional information, please let us know.

Thank you for your time and for working with us to assist [HOMEOWNER'S NAME] in restoring their property effectively after the loss they have experienced.

Your signature with your contact information`,
            next_steps: 'Send to Adjuster/Insurance and CC the customer. Include repair attempt video/photos.'
        });

        this.templateLibrary.set('itel_template', {
            name: 'iTel Matching Template', 
            scenario: 'itel_matching',
            content: `To whom it may concern

This is [REP NAME] with Roof ER. I am the contractor assisting [CUSTOMER'S NAME]. Attached you will find an iTel report.

Per the attached iTel report, there are no similar matches available which makes a patch repair impossible.

Per the attached iTel report, the existing shingle is discontinued. We have attempted to contact the suppliers listed on the report to secure the suggested samples, however each supplier noted they do not carry the suggested product/the suggested product would need to be special-ordered by the pallet, meaning the costs to do so would be more exorbitant than simply replacing the roof.

As a result, the approved scope of work cannot be completed as currently written. The homeowner's shingles are the English-dimension architectural shingles which are no longer in production. The new metric-dimension shingles have a larger exposure size and for that reason, cannot be mixed with the existing shingles via a repair.

If we try to repair with the new shingles, the sealant on the shingle above would not secure to the correct portion of the new underlying shingle. The sealant would be secured to the granules on the underlying shingle - any reputable contractor knows a proper repair cannot be completed in this fashion.

Please review these findings and revise your estimate accordingly so we can begin to move forward with the full replacement for [HOMEOWNER'S NAME].

If we can provide additional information, please let us know.

Thank you for your time and for working with us to assist [HOMEOWNER'S NAME] in restoring their property effectively after the loss they have experienced.

Your signature with your contact information`,
            next_steps: 'Send to Adjuster/Insurance and CC the customer. Attach iTel report.'
        });

        this.templateLibrary.set('estimate_request_template', {
            name: 'Estimate Request Template',
            scenario: 'estimate_request', 
            content: `Hello!

This is [REP NAME] with Roof-ER. We are assisting [CUSTOMER'S NAME] with the claim referenced above. Attached you will find a signed Claim Authorization and our Photo Report.

I am reaching out in regards to an estimate for the scope of repairs that should have been created after an inspection of [CUSTOMER NAME]'S property that happened on [DATE OF INSPECTION IF APPLICABLE].

If you are still working on the estimate, no problem at all! However, once you have a finalized estimate, please send a copy to both [CUSTOMER'S NAME] and to me as soon as possible.

We at Roof-ER want to quickly and effectively restore our mutual client's property back to pre-storm condition as soon as possible.

Please let me know if you need anything else from me.

Thank you for working with us to assist [CUSTOMER'S NAME] with this project.

[YOUR SIGNATURE]`,
            next_steps: 'Attach Claim Authorization. Include claim number in subject line.'
        });
    }
    
    async loadStateCodeLibrary() {
        // Comprehensive IRC (International Residential Code) sections
        this.stateCodeLibrary.set('IRC_R905', {
            state: 'All States',
            code: 'IRC R905',
            topic: 'Roof Assemblies',
            content: `IRC R905 - Roof Assemblies and Roofing:
• R905.1 - General roof covering requirements
• R905.2 - Asphalt shingles (wind resistance, fastener requirements)
• R905.3 - Clay and concrete tiles
• R905.4 - Metal roof panels
• R905.7 - Wood shingles and shakes
• R905.8 - Built-up roofs
• R905.14 - Photovoltaic shingles
Requires proper underlayment, flashing, and attachment methods`
        });

        this.stateCodeLibrary.set('IRC_R703', {
            state: 'All States', 
            code: 'IRC R703',
            topic: 'Exterior Covering',
            content: `IRC R703 - Exterior Covering:
• R703.1 - General exterior wall covering requirements
• R703.3 - Wood, hardboard, and wood structural panel siding
• R703.4 - Aluminum siding
• R703.5 - Vinyl siding  
• R703.6 - Fiber cement siding
• R703.7 - Exterior plaster (stucco)
• R703.8 - Exterior insulation and finish systems (EIFS)
Mandates proper installation, fastening, and weather resistance`
        });

        this.stateCodeLibrary.set('IRC_R806', {
            state: 'All States',
            code: 'IRC R806', 
            topic: 'Roof Ventilation',
            content: `IRC R806 - Roof Ventilation:
• R806.1 - Ventilation required (1 sq ft per 300 sq ft attic floor)
• R806.2 - Minimum vent openings
• R806.3 - Under-eave and ridge ventilation
• R806.4 - Unvented attic assemblies
• R806.5 - Unvented enclosed rafter assemblies
Critical for preventing moisture buildup and ice dams`
        });

        this.stateCodeLibrary.set('IRC_R804', {
            state: 'All States',
            code: 'IRC R804',
            topic: 'Roof Framing',
            content: `IRC R804 - Roof Framing:
• R804.1 - General roof framing requirements
• R804.2 - Allowable rafter spans
• R804.3 - Framing details and connections
• R804.4 - Purlins and roof trusses
Essential for structural integrity assessment`
        });
        
        // State-specific building codes
        this.stateCodeLibrary.set('VA_R905', {
            state: 'Virginia',
            code: 'VA R905',
            topic: 'Roof coverings',
            content: `Virginia adopts IRC R905 with amendments:
• Wind uplift resistance requirements (90-140 mph zones)
• Enhanced fastener schedules for coastal areas
• Special hurricane strap requirements
• Modified flashing details for high wind zones`
        });
        
        this.stateCodeLibrary.set('MD_R703', {
            state: 'Maryland',
            code: 'MD R703',
            topic: 'Exterior wall coverings',
            content: `Maryland follows IRC R703 with modifications:
• Enhanced moisture barrier requirements
• Special provisions for Chesapeake Bay area
• Increased fastener requirements for wind zones
• Modified installation requirements for freeze-thaw cycles`
        });
        
        this.stateCodeLibrary.set('PA_general', {
            state: 'Pennsylvania',
            code: 'PA Uniform Construction Code',
            topic: 'Roofing standards',
            content: `Pennsylvania UCC requirements:
• Follows IRC with local amendments
• Special snow load considerations (25-50 PSF)
• Enhanced ice dam prevention measures
• Modified ventilation requirements for climate zone`
        });
    }
    
    async loadGAFGuidelines() {
        // GAF manufacturer guidelines
        this.knowledgeBase.set('gaf_slope_replacement', {
            category: 'gaf_guidelines',
            priority: 5,
            title: 'GAF Slope Replacement Guidelines',
            content: 'GAF recommends against mixing slopes due to seal integrity and waterproofing concerns. Reference TAB-R-164.',
            source: 'GAF Technical Bulletin TAB-R-164',
            susanCategory: 'manufacturer_guidelines'
        });
        
        this.knowledgeBase.set('gaf_storm_damage', {
            category: 'gaf_guidelines',
            priority: 5,
            title: 'GAF Storm Damage Assessment',
            content: 'GAF guidelines for identifying and documenting hail and wind damage to shingle systems.',
            source: 'GAF Storm Damage Guidelines',
            susanCategory: 'manufacturer_guidelines'
        });
    }

    async loadRoofingComponents() {
        // Comprehensive roofing system components knowledge
        this.knowledgeBase.set('asphalt_shingles', {
            category: 'roofing_components',
            priority: 4,
            title: 'Asphalt Shingles',
            content: `Types: 3-tab, architectural (dimensional), luxury shingles
Wind Ratings: Typically 60-130 MPH
Lifespan: 15-30 years depending on quality
Common Issues: Granule loss, cracking, curling, missing shingles
IRC Requirements: Must meet ASTM D3462 standards
Hail Damage Signs: Exposed mat, granule loss in impact points, cracked shingles`,
            source: 'IRC R905.2 & Industry Standards',
            susanCategory: 'components'
        });

        this.knowledgeBase.set('underlayment', {
            category: 'roofing_components',
            priority: 4,
            title: 'Roof Underlayment',
            content: `Types: Felt paper (#15, #30), synthetic, self-adhering
IRC Requirements: Required under all roof coverings per R905.1.1
Ice Barrier: Required in areas with average January temp of 25°F or less
Application: Must overlap 2" horizontally, 6" at hips/ridges
Wind Areas: Enhanced requirements in high-wind zones`,
            source: 'IRC R905.1.1',
            susanCategory: 'components'
        });

        this.knowledgeBase.set('flashing', {
            category: 'roofing_components', 
            priority: 4,
            title: 'Roof Flashing Systems',
            content: `Types: Step, valley, chimney, pipe boot, wall, drip edge
Materials: Galvanized steel, aluminum, copper, lead-coated copper
Critical Areas: Wall intersections, chimneys, skylights, valleys
IRC Requirements: Required at wall/roof intersections per R903.2
Common Failures: Corrosion, improper installation, missing sealant`,
            source: 'IRC R903.2',
            susanCategory: 'components'
        });

        this.knowledgeBase.set('gutters_downspouts', {
            category: 'roofing_components',
            priority: 3,
            title: 'Gutter and Downspout Systems',
            content: `Materials: Aluminum, steel, copper, vinyl
Sizing: Based on roof area and rainfall intensity
Slope: Minimum 1/4" per 10' toward downspouts
Hangers: Spaced every 24-32" depending on material
Common Issues: Clogs, improper slope, loose fasteners, corrosion`,
            source: 'Industry Standards',
            susanCategory: 'components'
        });

        this.knowledgeBase.set('ventilation_systems', {
            category: 'roofing_components',
            priority: 4,
            title: 'Roof Ventilation Systems',
            content: `Types: Ridge vents, soffit vents, gable vents, turbines, powered fans
IRC Requirements: 1 sq ft per 300 sq ft of attic floor area
Balanced System: Equal intake (soffit) and exhaust (ridge) ventilation
Net Free Area: Must account for screen/louver restrictions
Benefits: Prevents ice dams, reduces energy costs, extends shingle life`,
            source: 'IRC R806',
            susanCategory: 'components'
        });

        this.knowledgeBase.set('roof_decking', {
            category: 'roofing_components',
            priority: 4,
            title: 'Roof Decking/Sheathing',
            content: `Materials: OSB, plywood, planks (existing homes)
Thickness: Minimum 7/16" OSB or 15/32" plywood for rafters 24" o.c.
Fastening: 8d ring shank nails, 6" edges, 12" field
Moisture Issues: Delamination, sagging, rot from water intrusion
Inspection Points: Check for proper attachment and structural integrity`,
            source: 'IRC R803.2.1',
            susanCategory: 'components'
        });

        this.knowledgeBase.set('ridge_cap', {
            category: 'roofing_components',
            priority: 3,
            title: 'Ridge Cap Shingles',
            content: `Purpose: Weather protection at roof ridge/hip intersections  
Types: 3-tab cut into pieces, dedicated ridge cap shingles
Installation: Overlap each piece, nail on each side below adhesive strip
Wind Requirements: Enhanced fastening in high-wind zones
Common Issues: Lifting, cracking, missing pieces from wind damage`,
            source: 'Manufacturer Guidelines',
            susanCategory: 'components'
        });

        this.knowledgeBase.set('ice_water_shield', {
            category: 'roofing_components',
            priority: 4,
            title: 'Ice and Water Shield',
            content: `Purpose: Prevents ice dam water intrusion
Location: Eaves (24" minimum inside heated wall), valleys, roof/wall intersections
Climate Requirements: Required in areas with January average temp ≤ 25°F
Application: Self-adhering membrane, overlapped 6"
Coverage: Extends up roof to at least 24" inside exterior wall line`,
            source: 'IRC R905.1.2',
            susanCategory: 'components'
        });
    }
    
    async setupEscalationMatrix() {
        this.escalationMatrix.set('initial_failure', {
            trigger: 'First denial or partial approval',
            action: 'Use appropriate template and supporting evidence',
            escalate: false
        });
        
        this.escalationMatrix.set('adjuster_refuses', {
            trigger: 'Adjuster refuses to reconsider with evidence',
            action: 'Escalate to Peer rep',
            escalate: true,
            escalation_level: 1
        });
        
        this.escalationMatrix.set('legal_interpretation', {
            trigger: 'Policy interpretation or legal issues',
            action: 'Escalate to Sales Manager',
            escalate: true,
            escalation_level: 3
        });
    }
    
    async processClaimQuery(query, context = {}) {
        try {
            console.log(`🎯 SUSAN processing query: "${query}"`);
            
            // Check if this is a roofing/claims-related query
            const isRoofingQuery = this.isRoofingRelated(query);
            
            if (!isRoofingQuery) {
                // For non-roofing queries, provide general assistance
                return {
                    response: this.personality.generalAssistance + " How can I help you today?",
                    model: 'susan-general-assistant',
                    confidence: 0.8,
                    isGeneralQuery: true,
                    timestamp: new Date().toISOString()
                };
            }
            
            // Analyze claim scenario
            const scenario = this.analyzeClaimScenario(query);
            
            // Search knowledge base with priority ordering
            const matches = this.searchWithPriority(query, scenario);
            
            // Generate 4-part structured response
            const response = await this.generateStructuredResponse(query, matches, scenario, context);
            
            return {
                response: this.formatSusanResponse(response),
                model: 'susan-roofing-specialist',
                confidence: response.confidence,
                scenario: scenario,
                escalation: response.escalation,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error in SUSAN claim processing:', error);
            return {
                response: "I'm having a technical issue. Contact your Team Leader immediately for assistance with this claim.",
                model: 'susan-error',
                escalation: {
                    needed: true,
                    contact: 'Team Leader',
                    reason: 'System error - immediate assistance required'
                },
                timestamp: new Date().toISOString()
            };
        }
    }
    
    isRoofingRelated(query) {
        const roofingKeywords = [
            'roof', 'shingle', 'claim', 'insurance', 'adjuster', 'damage', 'repair',
            'hail', 'wind', 'storm', 'leak', 'replacement', 'approval', 'denial',
            'estimate', 'scope', 'gaf', 'template', 'code', 'building', 'tpo',
            'epdm', 'membrane', 'flashing', 'gutter', 'itel', 'allstate',
            'state farm', 'coverage', 'deductible', 'appraisal', 'partial'
        ];
        
        const lowerQuery = query.toLowerCase();
        return roofingKeywords.some(keyword => lowerQuery.includes(keyword));
    }
    
    analyzeClaimScenario(query) {
        const lowerQuery = query.toLowerCase();
        
        // Check for specific template requests first (highest priority)
        if (lowerQuery.includes('itel') || lowerQuery.includes('matching') || lowerQuery.includes('discontinued')) {
            return 'itel_matching';
        }
        
        if (lowerQuery.includes('estimate request') || (lowerQuery.includes('estimate') && lowerQuery.includes('request'))) {
            return 'estimate_request';
        }
        
        if (lowerQuery.includes('denied') || lowerQuery.includes('denial')) {
            if (lowerQuery.includes('partial') || lowerQuery.includes('slope')) {
                return 'partial_denial';
            }
            return 'full_denial';
        }
        
        if (lowerQuery.includes('partial') && (lowerQuery.includes('approval') || lowerQuery.includes('approved'))) {
            return 'partial_denial';
        }
        
        if (lowerQuery.includes('repair') && (lowerQuery.includes('failed') || lowerQuery.includes('attempt'))) {
            return 'repair_attempt';
        }
        
        if (lowerQuery.includes('photo') || lowerQuery.includes('documentation')) {
            return 'photo_documentation';
        }
        
        if (lowerQuery.includes('template') || lowerQuery.includes('email')) {
            return 'template_request';
        }
        
        if (lowerQuery.includes('code') || lowerQuery.includes('compliance')) {
            return 'code_compliance';
        }
        
        if (lowerQuery.includes('gaf') || lowerQuery.includes('manufacturer')) {
            return 'manufacturer_guidelines';
        }
        
        return 'general_claim_support';
    }
    
    searchWithPriority(query, scenario) {
        const results = [];
        const queryWords = query.toLowerCase().split(/\s+/);
        
        // Search by priority order
        for (const priority of this.knowledgePriorities) {
            for (const [key, entry] of this.knowledgeBase.entries()) {
                if (entry.category === priority) {
                    let score = 0;
                    
                    // Boost score for scenario match
                    if (entry.susanCategory && scenario.includes(entry.susanCategory)) {
                        score += 0.5;
                    }
                    
                    // Check keyword matches
                    const keywordMatches = entry.keywords?.filter(keyword => 
                        queryWords.some(word => word.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(word))
                    ).length || 0;
                    
                    score += keywordMatches * 0.2;
                    
                    // Check content relevance
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
                            priority: entry.priority || 10
                        });
                    }
                }
            }
            
            // If we found good matches in high priority category, use those
            if (results.length > 0 && results[0].priority <= 3) {
                break;
            }
        }
        
        return results.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.score - a.score;
        }).slice(0, 3);
    }
    
    async generateStructuredResponse(query, matches, scenario, context) {
        // Get appropriate template
        const template = this.getTemplateForScenario(scenario);
        
        // Determine if escalation is needed
        const escalation = this.assessEscalation(query, matches, context);
        
        // Build 4-part response structure
        const response = {
            immediate_answer: this.generateImmediateAnswer(scenario, template, matches),
            supporting_evidence: this.generateSupportingEvidence(matches, scenario),
            ready_to_use_content: template ? template.content : this.generateGenericTemplate(scenario),
            next_steps: this.generateNextSteps(scenario, template, escalation),
            confidence: this.calculateConfidence(matches, template),
            escalation: escalation
        };
        
        return response;
    }
    
    getTemplateForScenario(scenario) {
        const templateMap = {
            'partial_denial': 'generic_partial_template',
            'full_denial': 'photo_report_template', 
            'repair_attempt': 'repair_attempt_template',
            'photo_documentation': 'photo_report_template',
            'itel_matching': 'itel_template',
            'estimate_request': 'estimate_request_template',
            'template_request': 'generic_partial_template'
        };
        
        const templateKey = templateMap[scenario];
        return templateKey ? this.templateLibrary.get(templateKey) : null;
    }
    
    generateImmediateAnswer(scenario, template, matches) {
        switch (scenario) {
            case 'partial_denial':
                return "Use Roof-ER's Generic Partial Template to challenge the partial approval with supporting documentation.";
            case 'full_denial':
                return "Send Roof-ER's Photo Report Template showing extent of wind/hail damage.";
            case 'repair_attempt':
                return "Use Roof-ER's Repair Attempt Template with photo/video documentation of failed repair.";
            case 'itel_matching':
                return "Send Roof-ER's iTel Template documenting discontinued shingles and matching impossibility.";
            case 'estimate_request':
                return "Use Roof-ER's Estimate Request Template with signed Claim Authorization attached.";
            case 'photo_documentation':
                return "Use Roof-ER's Photo Report Template to document additional damage not in initial decision.";
            default:
                return "Use the appropriate Roof-ER internal template - never use manufacturer formats unless specifically instructed.";
        }
    }
    
    generateSupportingEvidence(matches, scenario) {
        let evidence = [];
        
        // Add template references
        evidence.push("Use Roof-ER templates for professional communication");
        
        // Add specific document references
        matches.forEach(match => {
            if (match.entry.source) {
                evidence.push(`Reference: ${match.entry.source}`);
            }
        });
        
        // Add scenario-specific evidence
        switch (scenario) {
            case 'partial_denial':
                evidence.push("GAF's slope replacement bulletin (TAB-R-164)");
                evidence.push("Building code compliance requirements");
                break;
            case 'full_denial':
                evidence.push("Collateral damage indicators (gutters, vents, soft metals)");
                evidence.push("GAF storm damage guidelines");
                break;
        }
        
        return evidence.join(". ");
    }
    
    generateNextSteps(scenario, template, escalation) {
        let steps = [];
        
        if (template) {
            steps.push(template.next_steps || "Send the template to the adjuster");
        } else {
            steps.push("Send documentation to adjuster with supporting evidence");
        }
        
        steps.push("CC the homeowner on all communications");
        steps.push("Follow up in 48 hours if no response");
        
        if (escalation.needed) {
            steps.push(`Escalate to ${escalation.contact} if pushback continues`);
        }
        
        return steps.join(". ");
    }
    
    assessEscalation(query, matches, context) {
        const lowerQuery = query.toLowerCase();
        
        // Check for urgency indicators
        if (lowerQuery.includes('urgent') || lowerQuery.includes('asap') || lowerQuery.includes('immediate')) {
            return {
                needed: true,
                contact: 'Team Leader',
                reason: 'Urgent claim issue requiring immediate attention',
                level: 2
            };
        }
        
        // Check for legal/policy issues
        if (lowerQuery.includes('legal') || lowerQuery.includes('policy') || lowerQuery.includes('bad faith')) {
            return {
                needed: true,
                contact: 'Sales Manager',
                reason: 'Legal or policy interpretation required',
                level: 3
            };
        }
        
        // Check for repeated issues
        if (context.previousAttempts && context.previousAttempts > 1) {
            return {
                needed: true,
                contact: 'Team Leader',
                reason: 'Multiple unsuccessful attempts - escalation required',
                level: 2
            };
        }
        
        return { needed: false };
    }
    
    calculateConfidence(matches, template) {
        if (matches.length === 0) return 0.3;
        
        let confidence = matches[0].score;
        
        // Boost confidence if we have a specific template
        if (template) confidence += 0.2;
        
        // Boost for high-priority matches
        if (matches[0].priority <= 3) confidence += 0.1;
        
        return Math.min(1.0, confidence);
    }
    
    formatSusanResponse(response) {
        // Clean format without emojis for better voice output
        let result = response.immediate_answer;
        
        if (response.supporting_evidence && response.supporting_evidence.trim() !== response.immediate_answer.trim()) {
            result += `\n\n${response.supporting_evidence}`;
        }
        
        if (response.ready_to_use_content && !response.ready_to_use_content.includes('[')) {
            result += `\n\n${response.ready_to_use_content}`;
        } else if (response.ready_to_use_content) {
            result += `\n\nI can help you create the specific template content you need. Just let me know the details.`;
        }
        
        if (response.next_steps) {
            result += `\n\n${response.next_steps}`;
        }
        
        return result;
    }
    
    generateGenericTemplate(scenario) {
        return `Subject: [Claim Number] - Additional Documentation Required

Dear [Adjuster Name],

Please find attached additional documentation supporting our position on this claim. The evidence clearly demonstrates the scope of damage requires the recommended repairs.

We respectfully request reconsideration of the current scope and look forward to resolving this matter promptly.

Best regards,
[Rep Name]
Roof-ER Sales Representative`;
    }
    
    async getKnowledgeStats() {
        return {
            status: 'Enhanced SUSAN AI - Fully Operational',
            totalEntries: this.knowledgeBase.size,
            templates: this.templateLibrary.size,
            stateCodes: this.stateCodeLibrary.size,
            categories: Object.keys(this.knowledgePriorities).length,
            specialization: 'Roofing Sales & Insurance Claims (+ General Knowledge Assistant)',
            personality: 'Helpful assistant for all topics with specialized roofing expertise',
            responseStructure: '4-part structured responses for roofing queries, general assistance for other topics',
            escalationProtocol: 'Peer rep → Team Leader → Sales Manager (for roofing matters)',
            templatePriority: 'Roof-ER internal templates FIRST for roofing - general assistance for other topics',
            availableTemplates: [
                'Generic Partial Template',
                'Photo Report Template', 
                'Repair Attempt Template',
                'iTel Matching Template',
                'Estimate Request Template'
            ],
            generalCapabilities: 'Educational content, general questions, problem-solving, and knowledge assistance'
        };
    }
}