/**
 * Comprehensive Roofing Field Support System for Susan AI
 * Integrates with Sales Rep Resources for actual document access and real field guidance
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { findRoofingKnowledge, formatRoofingAnswer } from './core/roofing-knowledge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RoofingFieldSupportSystem {
    constructor() {
        // Sales Rep Resources path
        this.resourcesPath = '/Users/a21/Downloads/Sales Rep Resources';
        this.photoExamplesPath = path.join(this.resourcesPath, 'Rep Reports & Photo Examples');
        this.emailTemplatesPath = path.join(this.resourcesPath, 'Email Templates');
        this.salesScriptsPath = path.join(this.resourcesPath, 'Sales Scripts ');
        this.insuranceArgumentsPath = path.join(this.resourcesPath, 'Insurance Argument Resources');
        
        // Initialize knowledge bases
        this.roofingKnowledge = this.initializeRoofingKnowledge();
        this.fieldSupportFramework = this.initializeFieldSupportFramework();
        this.decisionTree = this.initializeDecisionTree();
        this.documentIndex = new Map();
        
        this.initializeDocumentIndex();
    }

    initializeRoofingKnowledge() {
        return {
            "drip_edge": {
                definition: "Metal flashing installed along the edges of the roof (typically at the eaves and rakes) to direct water away from the fascia and into the gutters, protecting the underlying roofing components from water intrusion and rot.",
                codes: [
                    "IRC Section R905.2.8.5 requires drip edge at eaves and gables",
                    "Must extend not less than 2 inches onto roof deck", 
                    "Fastened not more than 12 inches on center"
                ],
                whyItMatters: [
                    "Insurance often omits drip edge - grounds for supplement",
                    "GAF and other manufacturers require for warranty compliance",
                    "Code compliance - will fail inspection if missing"
                ],
                templateSnippet: "Drip edge is a required component under IRC R905.2.8.5 and is necessary to direct water into the gutter system and prevent damage to fascia boards. Please revise the scope to include full perimeter replacement of drip edge to ensure code compliance and manufacturer warranty requirements are met.",
                nextSteps: [
                    "Check insurance scope - is drip edge listed?",
                    "Take photos of damaged or missing drip edge",
                    "Request supplement if omitted from estimate"
                ]
            },
            
            "ice_and_water": {
                definition: "Self-adhering waterproof membrane installed in vulnerable areas like eaves, valleys, and around penetrations to prevent ice dams and water infiltration.",
                codes: [
                    "IRC R905.2.7.1 requires ice barrier in areas with average January temp of 25°F or less",
                    "Must extend from roof edge to 24 inches inside exterior wall",
                    "Required in all valleys and around penetrations"
                ],
                whyItMatters: [
                    "Prevents ice dam damage and water infiltration",
                    "Required by code in cold climates (VA, MD, PA qualify)",
                    "Insurance must cover if existing or code-required"
                ],
                templateSnippet: "Ice and water shield is required by IRC R905.2.7.1 in our climate zone and must extend from the roof edge to a point at least 24 inches inside the exterior wall line. This is essential for preventing ice dam damage and ensuring code compliance.",
                nextSteps: [
                    "Verify if existing roof had ice & water shield",
                    "Check local climate requirements",
                    "Document need in estimate if missing"
                ]
            },
            
            "starter_shingles": {
                definition: "Specialized shingles installed along the eaves and rakes before the first course of field shingles to provide wind uplift resistance and proper water shedding.",
                codes: [
                    "IRC R905.2.4 requires starter strips along eaves",
                    "GAF requires starter shingles for warranty compliance",
                    "Must provide minimum 3-inch exposure"
                ],
                whyItMatters: [
                    "Prevents wind uplift of first course shingles",
                    "Required by manufacturers for warranty",
                    "Improves weather resistance at roof edges"
                ],
                templateSnippet: "Starter shingles are required by IRC R905.2.4 and GAF manufacturer specifications to provide proper wind resistance and weather protection along the roof perimeter. These are essential components that must be included in the replacement scope.",
                nextSteps: [
                    "Check if insurance included starter shingles",
                    "Verify manufacturer requirements",
                    "Include in supplement if omitted"
                ]
            },
            
            "ridge_vent": {
                definition: "Ventilation system installed along the peak of the roof to allow hot air to escape from the attic, working with soffit vents to create proper airflow.",
                codes: [
                    "IRC R806.2 requires 1 sq ft of ventilation per 150 sq ft of attic",
                    "Balanced ventilation - 50% intake, 50% exhaust",
                    "Ridge vent is most effective exhaust ventilation"
                ],
                whyItMatters: [
                    "Prevents ice dams and moisture problems",
                    "Required for energy efficiency and code compliance",
                    "Extends shingle life by reducing attic heat"
                ],
                templateSnippet: "Ridge ventilation is required by IRC R806.2 to provide proper attic ventilation and prevent moisture and ice dam issues. Proper ventilation is essential for maintaining the new roofing system and ensuring code compliance.",
                nextSteps: [
                    "Calculate ventilation requirements",
                    "Check existing ventilation adequacy", 
                    "Include ridge vent in scope if needed"
                ]
            },
            
            "step_flashing": {
                definition: "Individual pieces of metal flashing installed where the roof meets a vertical surface like a wall or chimney, with each piece lapped over the one below.",
                codes: [
                    "IRC R905.2.8.2 requires flashing at wall/roof intersections",
                    "Must extend at least 4 inches onto roof and up wall",
                    "Each piece must overlap the one below by 2 inches minimum"
                ],
                whyItMatters: [
                    "Critical for preventing water infiltration at wall intersections",
                    "Insurance often overlooks step flashing replacement",
                    "Improper installation is major source of leaks"
                ],
                templateSnippet: "Step flashing is required by IRC R905.2.8.2 at all wall-to-roof intersections and must be replaced when roofing is removed. This is essential weatherproofing that prevents water infiltration and structural damage.",
                nextSteps: [
                    "Identify all wall-to-roof intersections",
                    "Document existing step flashing condition",
                    "Include replacement in roofing scope"
                ]
            },
            
            "valley_flashing": {
                definition: "Metal or membrane material installed in roof valleys where two roof slopes meet to channel water runoff and prevent leaks.",
                codes: [
                    "IRC R905.2.8.3 requires valley flashing",
                    "Open valleys require metal flashing minimum 24 inches wide",
                    "Closed valleys require ice and water shield"
                ],
                whyItMatters: [
                    "Valleys handle high water volume - critical for leak prevention",
                    "Required by code and manufacturer specifications",
                    "Must be replaced with roof system"
                ],
                templateSnippet: "Valley flashing is required by IRC R905.2.8.3 and manufacturer specifications to handle water runoff where roof slopes intersect. Proper valley protection is essential for preventing leaks in these high-volume water areas.",
                nextSteps: [
                    "Identify all valley locations",
                    "Determine open vs. closed valley requirements",
                    "Include valley flashing in estimate"
                ]
            },
            
            "felt_underlayment": {
                definition: "Water-resistant barrier installed over the roof deck before shingles to provide secondary protection against water infiltration.",
                codes: [
                    "IRC R905.2.3 requires underlayment over entire roof deck",
                    "Minimum 15# felt or equivalent synthetic",
                    "Must be lapped 2 inches at horizontal joints"
                ],
                whyItMatters: [
                    "Secondary water protection beneath shingles",
                    "Required by building codes",
                    "Prevents deck damage if shingles fail"
                ],
                templateSnippet: "Underlayment is required by IRC R905.2.3 over the entire roof deck to provide secondary water protection. This is a critical component that must be included in any complete roofing system replacement.",
                nextSteps: [
                    "Specify synthetic vs. felt underlayment",
                    "Check manufacturer requirements",
                    "Include in base roofing scope"
                ]
            },
            
            "gaf_guidelines": {
                definition: "Manufacturer specifications and installation requirements that must be followed to maintain warranty coverage on GAF roofing products.",
                codes: [
                    "GAF Master Elite contractor requirements",
                    "Specific installation procedures for each product",
                    "Weather limitations and temperature requirements"
                ],
                whyItMatters: [
                    "Insurance must follow manufacturer guidelines",
                    "Warranty compliance requirements",
                    "Professional installation standards"
                ],
                templateSnippet: "Per GAF manufacturer guidelines and installation requirements, [specific requirement] must be followed to ensure proper installation and warranty compliance. Insurance estimates must account for manufacturer specifications, not just minimum code requirements.",
                nextSteps: [
                    "Reference specific GAF requirement",
                    "Include manufacturer spec in estimate",
                    "Use as basis for supplement requests"
                ]
            },
            
            "matching_requirements": {
                definition: "Insurance policy provisions requiring materials to match existing undamaged portions in color, texture, and appearance when partial replacement is performed.",
                codes: [
                    "Maryland Insurance Administration requires matching",
                    "Virginia fairness doctrine supports matching",
                    "Most insurance policies include matching clauses"
                ],
                whyItMatters: [
                    "Prevents patchwork appearance",
                    "Required by most insurance policies",
                    "Basis for full replacement arguments"
                ],
                templateSnippet: "Matching requirements per your insurance policy and state regulations require that any replacement materials match the existing undamaged portions in color, texture, and appearance. Since suitable matching materials are not available, full replacement is necessary to comply with policy provisions.",
                nextSteps: [
                    "Document discontinued materials",
                    "Use iTel report for matching proof",
                    "Request full replacement based on matching"
                ]
            }
        };
    }

    initializeFieldSupportFramework() {
        return {
            mission: "Trusted field support assistant for Roof-ER crews and representatives working in Virginia, Maryland, and Pennsylvania",
            
            priorityOrder: [
                "Check uploaded Roof-ER materials (templates, guides, procedures)",
                "Supplement with relevant industry standards and research",
                "Provide escalation path when guidance is unclear"
            ],
            
            escalationProtocol: [
                "Consider reaching out to experienced teammates for their insights",
                "Discuss with your Team Leader for guidance on this situation", 
                "Contact your Sales Manager for complex policy or legal matters"
            ],
            
            responseStructure: [
                "Immediate Answer: Direct guidance with primary source",
                "Supporting Evidence: Additional research or industry standards",
                "Ready-to-Use Content: Templates, quotes, or specific language",
                "Next Steps: Clear actions and escalation path if needed"
            ]
        };
    }

    initializeDecisionTree() {
        return {
            "no_estimate": {
                template: "Estimate Request Template",
                attachments: ["Claim Authorization", "Photo Report"],
                goal: "Get written estimate for pushback",
                priority: 1,
                templateFile: "Estimate Request Template.docx"
            },
            
            "partial_approval": {
                template: "Generic Partial Template",
                attachments: ["Photo Report", "iTel", "Code Docs", "Discontinued List"],
                goal: "Add missing damages → push toward full approval",
                priority: 2,
                templateFile: "Generic Partial Template.docx"
            },
            
            "full_denial": {
                template: "Photo Report Template", 
                attachments: ["Photo Report (hail hits, creased shingles, soft metal damage)"],
                goal: "Overturn denial with clear storm damage proof",
                priority: 3,
                templateFile: "Photo Report Template.docx"
            },
            
            "repair_suggested": {
                template: "Repair Attempt Template",
                attachments: ["Video or photo of brittle test/repair attempt"],
                goal: "Show roof is unrepairable → force replacement",
                priority: 4,
                templateFile: "Repair Attempt Template.docx"
            },
            
            "siding_issue": {
                template: "Siding Argument Template",
                attachments: ["iTel Report", "Discontinued List", "Code Docs"],
                goal: "Force full siding replacement using discontinued/matching/code arguments",
                priority: 5,
                templateFile: "Siding Argument.docx"
            },
            
            "discontinued_shingles": {
                template: "iTel Template",
                attachments: ["iTel Report", "Discontinued Shingle List"],
                goal: "Show no patch possible due to size mismatch or product discontinuation",
                priority: 6,
                templateFile: "iTel Template.docx"
            },
            
            "stonewalling": {
                template: "Customer-to-Insurance Template",
                sendTo: "Customer (they copy/paste and send directly)",
                goal: "Apply pressure from policyholder side",
                priority: 7,
                templateFile: "Template from Customer to Insurance.docx"
            },
            
            "multiple_refusals": {
                nextSteps: ["Complaint Forms", "Arbitration Path"],
                goal: "Escalate beyond adjuster → regulatory/legal pressure",
                priority: 8
            }
        };
    }

    async initializeDocumentIndex() {
        try {
            // Index photo examples
            const photoExamples = await this.indexDirectory(this.photoExamplesPath);
            photoExamples.forEach(file => {
                this.documentIndex.set(`photo_example_${path.basename(file, path.extname(file)).toLowerCase()}`, file);
            });

            // Index email templates
            const emailTemplates = await this.indexDirectory(this.emailTemplatesPath);
            emailTemplates.forEach(file => {
                this.documentIndex.set(`template_${path.basename(file, path.extname(file)).toLowerCase()}`, file);
            });

            // Index sales scripts
            const salesScripts = await this.indexDirectory(this.salesScriptsPath);
            salesScripts.forEach(file => {
                this.documentIndex.set(`script_${path.basename(file, path.extname(file)).toLowerCase()}`, file);
            });

            console.log(`📚 Indexed ${this.documentIndex.size} documents from Sales Rep Resources`);
        } catch (error) {
            console.warn('⚠️  Failed to index documents:', error.message);
        }
    }

    async indexDirectory(dirPath) {
        try {
            if (!(await fs.pathExists(dirPath))) {
                return [];
            }
            
            const files = await fs.readdir(dirPath);
            const docFiles = files.filter(file => 
                ['.pdf', '.docx', '.doc', '.xlsx', '.jpg', '.png'].includes(path.extname(file).toLowerCase())
            );
            
            return docFiles.map(file => path.join(dirPath, file));
        } catch (error) {
            console.warn(`⚠️  Failed to index directory ${dirPath}:`, error.message);
            return [];
        }
    }

    /**
     * Main query processing function - handles roofing questions and document requests
     */
    async processQuery(query) {
        const lowerQuery = query.toLowerCase().trim();

        // Check for document requests first
        if (this.isDocumentRequest(lowerQuery)) {
            return await this.handleDocumentRequest(lowerQuery);
        }

        // Check for roofing knowledge queries using enhanced knowledge base
        const roofingKnowledge = findRoofingKnowledge(lowerQuery);
        if (roofingKnowledge) {
            const formattedAnswer = formatRoofingAnswer(roofingKnowledge, lowerQuery);
            return {
                response: formattedAnswer,
                type: 'roofing_knowledge',
                priority: 'high'
            };
        }

        // Fallback to legacy knowledge base if enhanced doesn't match
        const legacyAnswer = this.findRoofingKnowledge(lowerQuery);
        if (legacyAnswer) {
            return this.formatRoofingAnswer(legacyAnswer, lowerQuery);
        }

        // Check for template recommendations
        const templateRecommendation = this.getTemplateRecommendation(lowerQuery);
        if (templateRecommendation) {
            return await this.formatTemplateRecommendation(templateRecommendation, lowerQuery);
        }

        // Check for escalation guidance
        if (this.isEscalationRequest(lowerQuery)) {
            return this.formatEscalationGuidance();
        }

        return null; // Not a roofing/field support query
    }

    isDocumentRequest(query) {
        const documentKeywords = [
            'show me', 'example', 'sample', 'photo report', 'template', 
            'script', 'email template', 'photo example', 'document'
        ];
        return documentKeywords.some(keyword => query.includes(keyword));
    }

    async handleDocumentRequest(query) {
        // Photo report requests
        if (query.includes('photo report') || query.includes('sample photo')) {
            return await this.getPhotoReportExamples();
        }

        // Email template requests
        if (query.includes('email template') || query.includes('template')) {
            return await this.getEmailTemplateList();
        }

        // Sales script requests
        if (query.includes('script') || query.includes('sales script')) {
            return await this.getSalesScriptList();
        }

        return await this.getGeneralDocumentList();
    }

    async getPhotoReportExamples() {
        const photoReports = Array.from(this.documentIndex.entries())
            .filter(([key, path]) => key.includes('photo_example') || path.includes('Sample Photo Report'))
            .map(([key, filePath]) => ({
                name: path.basename(filePath),
                path: filePath,
                type: 'Photo Report Example'
            }));

        if (photoReports.length === 0) {
            return {
                response: "❌ No photo report examples found in the Sales Rep Resources folder. Please check that the files are in the correct location.",
                type: "document_error"
            };
        }

        let response = "📸 **Sample Photo Reports Available:**\n\n";
        response += "Here are the actual photo report examples from your Sales Rep Resources:\n\n";
        
        photoReports.forEach((report, index) => {
            response += `${index + 1}. **${report.name}**\n`;
            response += `   📁 Location: ${report.path}\n`;
            response += `   🎯 Use this as a template for documenting storm damage\n\n`;
        });

        response += "\n💡 **How to Use These Examples:**\n";
        response += "• Review the format and structure for your own photo reports\n";
        response += "• Note how damage is documented and described\n";
        response += "• Use similar language and organization in your reports\n";
        response += "• Include these as attachments when arguing with insurance\n\n";
        response += "📧 Need help drafting an email to use these reports? Just ask!";

        return {
            response,
            type: "document_list",
            documents: photoReports
        };
    }

    async getEmailTemplateList() {
        const templates = Array.from(this.documentIndex.entries())
            .filter(([key]) => key.includes('template'))
            .map(([key, filePath]) => ({
                name: path.basename(filePath, path.extname(filePath)),
                path: filePath,
                type: 'Email Template'
            }));

        if (templates.length === 0) {
            return {
                response: "❌ No email templates found in the Sales Rep Resources folder.",
                type: "document_error"
            };
        }

        let response = "📧 **Available Email Templates:**\n\n";
        response += "Here are the actual email templates from your Sales Rep Resources:\n\n";
        
        templates.forEach((template, index) => {
            response += `${index + 1}. **${template.name}**\n`;
            response += `   📁 Location: ${template.path}\n`;
            const situation = this.getTemplateSituation(template.name);
            if (situation) {
                response += `   🎯 Use when: ${situation}\n`;
            }
            response += "\n";
        });

        response += "\n💡 **How to Use These Templates:**\n";
        response += "• Open the Word document for the template you need\n";
        response += "• Fill in the job-specific information in [brackets]\n";
        response += "• Delete the instructional text before sending\n";
        response += "• Always CC the homeowner and BCC Reese\n\n";
        response += "🤔 **Need help choosing the right template?** Tell me your situation and I'll recommend the best one!";

        return {
            response,
            type: "document_list",
            documents: templates
        };
    }

    getTemplateSituation(templateName) {
        const situations = {
            'estimate request template': 'Insurance has not provided their estimate yet',
            'generic partial template': 'Claim partially approved but missing damages',
            'photo report template': 'Have photo report showing missed damage',
            'repair attempt template': 'Performed brittle test or repair attempt failed',
            'itel template': 'Shingles/materials are discontinued or non-matching',
            'siding argument': 'Need full siding replacement (discontinued/matching)',
            'template from customer to insurance': 'Insurance is stonewalling, customer pressure needed',
            'gaf guidelines template': 'Need to reference manufacturer requirements'
        };

        const key = templateName.toLowerCase();
        return situations[key] || null;
    }

    async getSalesScriptList() {
        const scripts = Array.from(this.documentIndex.entries())
            .filter(([key]) => key.includes('script'))
            .map(([key, filePath]) => ({
                name: path.basename(filePath, path.extname(filePath)),
                path: filePath,
                type: 'Sales Script'
            }));

        if (scripts.length === 0) {
            return {
                response: "❌ No sales scripts found in the Sales Rep Resources folder.",
                type: "document_error"
            };
        }

        let response = "🎯 **Available Sales Scripts:**\n\n";
        response += "Here are the actual sales scripts from your Sales Rep Resources:\n\n";
        
        scripts.forEach((script, index) => {
            response += `${index + 1}. **${script.name}**\n`;
            response += `   📁 Location: ${script.path}\n`;
            const timing = this.getScriptTiming(script.name);
            if (timing) {
                response += `   ⏰ When to use: ${timing}\n`;
            }
            response += "\n";
        });

        response += "\n💡 **How to Use These Scripts:**\n";
        response += "• Review the script before making the call\n";
        response += "• Adapt the language to your natural speaking style\n";
        response += "• Use as a guide, not a word-for-word script\n";
        response += "• Practice the key points beforehand\n\n";
        response += "📞 **Need help with a specific call?** Tell me the situation and I'll guide you through it!";

        return {
            response,
            type: "document_list",
            documents: scripts
        };
    }

    getScriptTiming(scriptName) {
        const timings = {
            'initial pitch script': 'First contact with homeowner',
            'inspection and post inspection script': 'During and after roof inspection',
            'contingency and claim authorization script': 'When getting signed authorization',
            'post adjuster meeting script': 'After meeting with insurance adjuster',
            'partial estimate phone call': 'When insurance partially approves claim',
            'full approval estimate phone call': 'When insurance fully approves claim'
        };

        const key = scriptName.toLowerCase();
        return timings[key] || null;
    }

    findRoofingKnowledge(query) {
        // Term mapping for common variations
        const termMap = {
            "drip edge": "drip_edge",
            "dripedge": "drip_edge", 
            "drip-edge": "drip_edge",
            "edge flashing": "drip_edge",
            "ice and water": "ice_and_water",
            "ice & water": "ice_and_water",
            "ice and water shield": "ice_and_water",
            "ice barrier": "ice_and_water",
            "starter shingles": "starter_shingles",
            "starter strip": "starter_shingles",
            "ridge vent": "ridge_vent",
            "ridge ventilation": "ridge_vent",
            "step flashing": "step_flashing",
            "wall flashing": "step_flashing",
            "valley flashing": "valley_flashing",
            "valley": "valley_flashing",
            "felt": "felt_underlayment",
            "underlayment": "felt_underlayment",
            "gaf": "gaf_guidelines",
            "matching": "matching_requirements"
        };

        // Direct match
        for (const [term, key] of Object.entries(termMap)) {
            if (query.includes(term)) {
                return this.roofingKnowledge[key];
            }
        }

        return null;
    }

    formatRoofingAnswer(knowledge, term) {
        let response = `✅ **Immediate Answer**\n\n`;
        response += `${knowledge.definition}\n\n`;
        
        response += `🔎 **Supporting Evidence & Code**\n\n`;
        knowledge.codes.forEach(code => {
            response += `• ${code}\n`;
        });
        response += '\n';
        
        response += `🛠️ **Why It Matters for Roofing Claims**\n\n`;
        knowledge.whyItMatters.forEach(matter => {
            response += `• ${matter}\n`;
        });
        response += '\n';
        
        response += `📄 **Ready-to-Use Language (Template Snippet)**\n\n`;
        response += `Use this in an estimate request or supplement email:\n\n`;
        response += `"${knowledge.templateSnippet}"\n\n`;
        
        response += `🧭 **Next Steps**\n\n`;
        knowledge.nextSteps.forEach(step => {
            response += `✅ ${step}\n`;
        });
        response += '\n';
        
        response += `📧 Need a supplement email? I can help you draft one using your specific job info.`;
        
        return {
            response,
            type: "roofing_knowledge",
            knowledge
        };
    }

    getTemplateRecommendation(query) {
        const situationKeywords = {
            'no estimate': 'no_estimate',
            'partial approval': 'partial_approval', 
            'partial estimate': 'partial_approval',
            'denied': 'full_denial',
            'denial': 'full_denial',
            'repair': 'repair_suggested',
            'brittle test': 'repair_suggested',
            'siding': 'siding_issue',
            'discontinued': 'discontinued_shingles',
            'matching': 'discontinued_shingles',
            'stonewalling': 'stonewalling',
            'won\'t respond': 'stonewalling'
        };

        for (const [keyword, situation] of Object.entries(situationKeywords)) {
            if (query.includes(keyword)) {
                return { situation, details: this.decisionTree[situation] };
            }
        }

        return null;
    }

    async formatTemplateRecommendation(recommendation, query) {
        const { situation, details } = recommendation;
        
        let response = `🎯 **Template Recommendation Based on Your Situation**\n\n`;
        response += `**Situation:** ${situation.replace('_', ' ').toUpperCase()}\n`;
        response += `**Recommended Template:** ${details.template}\n`;
        response += `**Goal:** ${details.goal}\n\n`;

        if (details.templateFile) {
            const templatePath = path.join(this.emailTemplatesPath, details.templateFile);
            if (await fs.pathExists(templatePath)) {
                response += `📁 **Template File:** ${templatePath}\n\n`;
            }
        }

        if (details.attachments) {
            response += `📎 **Recommended Attachments:**\n`;
            details.attachments.forEach(attachment => {
                response += `• ${attachment}\n`;
            });
            response += '\n';
        }

        if (details.sendTo) {
            response += `📧 **Send To:** ${details.sendTo}\n\n`;
        }

        response += `🔧 **How to Use:**\n`;
        response += `1. Open the template document from the Sales Rep Resources folder\n`;
        response += `2. Fill in job-specific details in [brackets]\n`;
        response += `3. Delete instructional text before sending\n`;
        response += `4. CC homeowner and BCC Reese when sending to insurance\n\n`;

        response += `💡 **Need help customizing this template for your specific job?** Share the details and I'll help you fill it out!`;

        return {
            response,
            type: "template_recommendation",
            recommendation
        };
    }

    isEscalationRequest(query) {
        const escalationKeywords = [
            'escalate', 'help', 'stuck', 'don\'t know', 'what should i do',
            'team leader', 'manager', 'who to ask'
        ];
        return escalationKeywords.some(keyword => query.includes(keyword));
    }

    formatEscalationGuidance() {
        let response = `🆘 **Escalation Protocol for Field Support**\n\n`;
        response += `When you need additional guidance, follow this systematic approach:\n\n`;

        response += `**1. Self-Check First:**\n`;
        response += `✅ Review uploaded Roof-ER materials for this situation\n`;
        response += `✅ Check if similar template or procedure exists\n`;
        response += `✅ Identify specific question or challenge clearly\n\n`;

        response += `**2. Peer Support (Recommended First Step):**\n`;
        response += `• Ask experienced teammates for their approach\n`;
        response += `• Share situation details for collaborative input\n`;
        response += `• Get feedback on draft responses or strategies\n\n`;

        response += `**3. Team Leader Consultation:**\n`;
        response += `• Present situation with attempted solutions\n`;
        response += `• Ask for guidance on company procedures\n`;
        response += `• Discuss strategy for complex claims\n\n`;

        response += `**4. Management Escalation:**\n`;
        response += `• Contact Sales Manager for policy interpretation\n`;
        response += `• Escalate legal or regulatory questions\n`;
        response += `• Involve management in major disputes\n\n`;

        response += `🤔 **Quick Reference Questions:**\n`;
        response += `• What specific outcome am I trying to achieve?\n`;
        response += `• What materials do I have to support my position?\n`;
        response += `• Who else has faced this situation successfully?\n`;
        response += `• What's the worst-case scenario if I proceed?\n\n`;

        response += `💡 **Remember:** Most situations have been handled before - start with team knowledge!`;

        return {
            response,
            type: "escalation_guidance"
        };
    }

    async getGeneralDocumentList() {
        const allDocs = Array.from(this.documentIndex.entries())
            .map(([key, filePath]) => ({
                name: path.basename(filePath),
                path: filePath,
                category: this.categorizeDocument(key)
            }));

        let response = `📚 **Sales Rep Resources - Available Documents**\n\n`;
        
        const categories = [...new Set(allDocs.map(doc => doc.category))];
        
        categories.forEach(category => {
            response += `**${category}:**\n`;
            const categoryDocs = allDocs.filter(doc => doc.category === category);
            categoryDocs.forEach(doc => {
                response += `• ${doc.name}\n`;
            });
            response += '\n';
        });

        response += `💡 **How to Access:**\n`;
        response += `All documents are located in: /Users/a21/Downloads/Sales Rep Resources/\n\n`;
        response += `🔍 **Need something specific?** Ask me for:\n`;
        response += `• "Show me photo report examples"\n`;
        response += `• "What email templates are available?"\n`;
        response += `• "I need sales scripts"\n`;
        response += `• Or describe your situation for template recommendations!`;

        return {
            response,
            type: "document_overview",
            documents: allDocs
        };
    }

    categorizeDocument(key) {
        if (key.includes('photo_example')) return 'Photo Report Examples';
        if (key.includes('template')) return 'Email Templates';
        if (key.includes('script')) return 'Sales Scripts';
        return 'Other Documents';
    }
}

export default RoofingFieldSupportSystem;