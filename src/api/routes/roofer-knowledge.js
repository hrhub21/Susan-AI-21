import express from 'express';
import { RoofERKnowledgeService } from '../services/RoofERKnowledgeService.js';

const router = express.Router();
const knowledgeService = new RoofERKnowledgeService();

/**
 * @route POST /api/roofer-knowledge/query
 * @desc Process employee question with Roof-ER context
 * @access Public (internal company use)
 */
router.post('/query', async (req, res) => {
    try {
        const { message, context = {} } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Message is required and must be a string'
            });
        }
        
        console.log(`🏢 Roof-ER Knowledge Query: "${message}"`);
        
        // Process query with Roof-ER knowledge
        const result = await knowledgeService.processQuery(message, context);
        
        // Enhanced response with company branding
        const response = {
            content: `🏢 **Roof-ER Employee Assistant**\n\n${result.response}`,
            confidence: result.confidence,
            sources: result.sources,
            category: result.category,
            examples: result.examples,
            escalation: result.escalation,
            metadata: {
                system: 'Roof-ER Knowledge Base',
                timestamp: result.timestamp,
                knowledgeBase: 'company_specific'
            }
        };
        
        // Add escalation notice if needed
        if (result.escalation?.needed) {
            response.content += `\n\n⚠️ **For Additional Help:** ${result.escalation.reason}\n📞 Please contact: ${result.escalation.contact}`;
        }
        
        // Add copy-paste examples if available
        if (result.examples && result.examples.length > 0) {
            response.content += '\n\n📄 **Copy-Paste Templates:**';
            result.examples.forEach((example, index) => {
                response.content += `\n\n**${example.title}:**\n\`\`\`\n${example.content}\n\`\`\``;
            });
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Roof-ER Knowledge Query Error:', error);
        res.status(500).json({
            error: 'Internal server error processing knowledge query',
            content: 'I apologize for the technical issue. Please contact your supervisor or HR department for assistance with your question.',
            escalation: {
                needed: true,
                contact: 'IT Support or HR Manager',
                reason: 'System error - technical assistance required'
            }
        });
    }
});

/**
 * @route GET /api/roofer-knowledge/directory
 * @desc Get company directory and organizational information
 * @access Public (internal company use)
 */
router.get('/directory', async (req, res) => {
    try {
        const directory = await knowledgeService.getCompanyDirectory();
        res.json({
            ...directory,
            message: 'Roof-ER Company Directory and Resources'
        });
    } catch (error) {
        console.error('❌ Error fetching company directory:', error);
        res.status(500).json({ error: 'Failed to fetch company directory' });
    }
});

/**
 * @route GET /api/roofer-knowledge/stats
 * @desc Get knowledge base statistics and health metrics
 * @access Public (internal company use)
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await knowledgeService.getKnowledgeStats();
        res.json({
            ...stats,
            system: 'Roof-ER Knowledge Base',
            status: 'operational',
            lastUpdate: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error fetching knowledge stats:', error);
        res.status(500).json({ error: 'Failed to fetch knowledge statistics' });
    }
});

/**
 * @route GET /api/roofer-knowledge/help
 * @desc Get help information for using the knowledge system
 * @access Public (internal company use)
 */
router.get('/help', (req, res) => {
    res.json({
        system: 'Roof-ER Employee Knowledge Assistant',
        description: 'Ask Susan anything about Roof-ER company policies, procedures, and resources',
        capabilities: [
            'Company policies and procedures',
            'Sales processes and training',
            'Insurance claims and arguments',
            'Operational procedures and workflows',
            'Email templates and examples',
            'Contact directory and escalation',
            'Territory information and coverage',
            'Training materials and resources'
        ],
        examples: [
            'How do I handle an insurance claim dispute?',
            'What are the steps for a repair attempt?',
            'Can you give me the estimate request email template?',
            'Who should I contact about territory coverage?',
            'What are Roof-ER\'s core values?',
            'How do I document wind damage?'
        ],
        escalation: {
            policy: 'If Susan cannot provide adequate information, she will direct you to the appropriate department or supervisor',
            contacts: {
                'General HR': 'HR Manager',
                'Sales Questions': 'Sales Manager',
                'Operations': 'Operations Manager',
                'Technical Issues': 'Field Supervisor'
            }
        }
    });
});

export default router;