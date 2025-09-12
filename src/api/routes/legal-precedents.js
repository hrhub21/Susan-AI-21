import express from 'express';
import { LegalPrecedentService } from '../services/LegalPrecedentService.js';

const router = express.Router();
const legalPrecedentService = new LegalPrecedentService();

/**
 * Legal Precedent Search API Routes
 * Comprehensive legal precedent search and analysis endpoints
 */

// Initialize service
let serviceInitialized = false;
legalPrecedentService.on('serviceReady', () => {
    serviceInitialized = true;
    console.log('✅ Legal Precedent Search Service API ready');
});

// Middleware to check service initialization
const checkServiceReady = (req, res, next) => {
    if (!serviceInitialized) {
        return res.status(503).json({
            error: 'Legal Precedent Service not ready',
            message: 'Service is still initializing. Please try again shortly.',
            code: 'SERVICE_INITIALIZING'
        });
    }
    next();
};

/**
 * @route GET /api/legal-precedents/health
 * @desc Health check for Legal Precedent Service
 * @access Public
 */
router.get('/health', (req, res) => {
    res.json({
        status: serviceInitialized ? 'healthy' : 'initializing',
        service: 'Legal Precedent Search System',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: {
            caseDatabase: true,
            similaritySearch: true,
            outcomeAnalysis: true,
            legalResearch: true,
            citationGenerator: true,
            settlementPrediction: true,
            jurisdictionAnalysis: true,
            strategyRecommendations: true,
            precedentMonitoring: true
        }
    });
});

/**
 * @route POST /api/legal-precedents/search/similar
 * @desc Find similar cases based on claim data
 * @access Protected
 */
router.post('/search/similar', checkServiceReady, async (req, res) => {
    try {
        const { claimData, options = {} } = req.body;

        // Validate required fields
        if (!claimData || !claimData.claimType) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'claimData with claimType is required',
                code: 'VALIDATION_ERROR'
            });
        }

        const searchResult = await legalPrecedentService.findSimilarCases(claimData, options);

        res.json({
            success: true,
            searchResult,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error finding similar cases:', error);
        res.status(500).json({
            error: 'Similar case search failed',
            message: error.message,
            code: 'SIMILAR_SEARCH_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-precedents/analyze/outcomes
 * @desc Analyze case outcomes and settlement patterns
 * @access Protected
 */
router.post('/analyze/outcomes', checkServiceReady, async (req, res) => {
    try {
        const analysisRequest = req.body;

        const outcomeAnalysis = await legalPrecedentService.analyzeOutcomes(analysisRequest);

        res.json({
            success: true,
            outcomeAnalysis,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error analyzing outcomes:', error);
        res.status(500).json({
            error: 'Outcome analysis failed',
            message: error.message,
            code: 'OUTCOME_ANALYSIS_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-precedents/predict/outcome
 * @desc Predict likely outcomes based on similar cases
 * @access Protected
 */
router.post('/predict/outcome', checkServiceReady, async (req, res) => {
    try {
        const predictionRequest = req.body;

        // Validate required fields
        if (!predictionRequest.claimData) {
            return res.status(400).json({
                error: 'Missing required field',
                message: 'claimData is required',
                code: 'VALIDATION_ERROR'
            });
        }

        const prediction = await legalPrecedentService.predictLikelyOutcome(predictionRequest);

        res.json({
            success: true,
            prediction,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error predicting outcome:', error);
        res.status(500).json({
            error: 'Outcome prediction failed',
            message: error.message,
            code: 'PREDICTION_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-precedents/generate/citation
 * @desc Generate legal citations for cases
 * @access Protected
 */
router.post('/generate/citation', checkServiceReady, async (req, res) => {
    try {
        const citationRequest = req.body;

        // Validate required fields
        if (!citationRequest.caseId) {
            return res.status(400).json({
                error: 'Missing required field',
                message: 'caseId is required',
                code: 'VALIDATION_ERROR'
            });
        }

        const citation = await legalPrecedentService.generateCitation(citationRequest);

        res.json({
            success: true,
            citation,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error generating citation:', error);
        res.status(500).json({
            error: 'Citation generation failed',
            message: error.message,
            code: 'CITATION_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-precedents/analyze/jurisdiction
 * @desc Analyze jurisdiction patterns and outcomes
 * @access Protected
 */
router.post('/analyze/jurisdiction', checkServiceReady, async (req, res) => {
    try {
        const jurisdictionRequest = req.body;

        const jurisdictionAnalysis = await legalPrecedentService.analyzeJurisdictionPatterns(jurisdictionRequest);

        res.json({
            success: true,
            jurisdictionAnalysis,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error analyzing jurisdiction patterns:', error);
        res.status(500).json({
            error: 'Jurisdiction analysis failed',
            message: error.message,
            code: 'JURISDICTION_ANALYSIS_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-precedents/search/legal-databases
 * @desc Search external legal databases
 * @access Protected
 */
router.post('/search/legal-databases', checkServiceReady, async (req, res) => {
    try {
        const searchRequest = req.body;

        // Validate required fields
        if (!searchRequest.query) {
            return res.status(400).json({
                error: 'Missing required field',
                message: 'query is required',
                code: 'VALIDATION_ERROR'
            });
        }

        const searchResults = await legalPrecedentService.searchLegalDatabases(searchRequest);

        res.json({
            success: true,
            searchResults,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error searching legal databases:', error);
        res.status(500).json({
            error: 'Legal database search failed',
            message: error.message,
            code: 'DATABASE_SEARCH_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-precedents/generate/strategy
 * @desc Generate strategy recommendations based on precedents
 * @access Protected
 */
router.post('/generate/strategy', checkServiceReady, async (req, res) => {
    try {
        const strategyRequest = req.body;

        // Validate required fields
        if (!strategyRequest.claimData) {
            return res.status(400).json({
                error: 'Missing required field',
                message: 'claimData is required',
                code: 'VALIDATION_ERROR'
            });
        }

        const recommendations = await legalPrecedentService.generateStrategyRecommendations(strategyRequest);

        res.json({
            success: true,
            recommendations,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error generating strategy recommendations:', error);
        res.status(500).json({
            error: 'Strategy generation failed',
            message: error.message,
            code: 'STRATEGY_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-precedents/case/:caseId
 * @desc Get detailed information about a specific case
 * @access Protected
 */
router.get('/case/:caseId', checkServiceReady, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { includeRelated = false, includeCitation = false } = req.query;

        const caseDetails = legalPrecedentService.getCaseDetails(caseId);

        if (!caseDetails) {
            return res.status(404).json({
                error: 'Case not found',
                message: `No case found with ID: ${caseId}`,
                code: 'CASE_NOT_FOUND'
            });
        }

        const response = {
            success: true,
            caseId,
            caseDetails,
            timestamp: new Date().toISOString()
        };

        // Include related cases if requested
        if (includeRelated === 'true') {
            const relatedCases = await legalPrecedentService.findRelatedCases(caseId, 5);
            response.relatedCases = relatedCases;
        }

        // Include citations if requested
        if (includeCitation === 'true') {
            const citation = await legalPrecedentService.generateCitation({ caseId });
            response.citations = citation.citations;
        }

        res.json(response);

    } catch (error) {
        console.error('Error retrieving case details:', error);
        res.status(500).json({
            error: 'Case retrieval failed',
            message: error.message,
            code: 'CASE_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-precedents/cases
 * @desc Get all cases with optional filtering
 * @access Protected
 */
router.get('/cases', checkServiceReady, async (req, res) => {
    try {
        const { 
            jurisdiction, 
            claimType, 
            year, 
            outcome,
            limit = 50,
            offset = 0,
            sortBy = 'year',
            sortOrder = 'desc'
        } = req.query;

        const filters = {};
        if (jurisdiction) filters.jurisdiction = jurisdiction;
        if (claimType) filters.claimType = claimType;
        if (year) filters.year = parseInt(year);
        if (outcome) filters.outcome = outcome;

        let cases = legalPrecedentService.getAllCases(filters);

        // Sort cases
        cases.sort((a, b) => {
            const aValue = a[sortBy];
            const bValue = b[sortBy];
            
            if (sortOrder === 'desc') {
                return bValue > aValue ? 1 : -1;
            } else {
                return aValue > bValue ? 1 : -1;
            }
        });

        // Apply pagination
        const totalCases = cases.length;
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        cases = cases.slice(startIndex, endIndex);

        res.json({
            success: true,
            totalCases,
            returnedCases: cases.length,
            offset: startIndex,
            limit: parseInt(limit),
            cases,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving cases:', error);
        res.status(500).json({
            error: 'Cases retrieval failed',
            message: error.message,
            code: 'CASES_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-precedents/search/history
 * @desc Get search history
 * @access Protected
 */
router.get('/search/history', checkServiceReady, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const searchHistory = legalPrecedentService.getSearchHistory(parseInt(limit));

        res.json({
            success: true,
            totalSearches: searchHistory.length,
            searches: searchHistory,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving search history:', error);
        res.status(500).json({
            error: 'Search history retrieval failed',
            message: error.message,
            code: 'HISTORY_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-precedents/metrics
 * @desc Get system metrics and statistics
 * @access Protected
 */
router.get('/metrics', checkServiceReady, async (req, res) => {
    try {
        const metrics = legalPrecedentService.getSystemMetrics();

        res.json({
            success: true,
            metrics,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving system metrics:', error);
        res.status(500).json({
            error: 'Metrics retrieval failed',
            message: error.message,
            code: 'METRICS_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-precedents/batch/analyze
 * @desc Batch analysis of multiple claims
 * @access Protected
 */
router.post('/batch/analyze', checkServiceReady, async (req, res) => {
    try {
        const { claims, analysisType = 'similarity' } = req.body;

        if (!claims || !Array.isArray(claims)) {
            return res.status(400).json({
                error: 'Invalid claims data',
                message: 'claims must be an array',
                code: 'VALIDATION_ERROR'
            });
        }

        const batchResults = {
            batchId: `BATCH-${Date.now()}`,
            timestamp: new Date().toISOString(),
            analysisType,
            totalClaims: claims.length,
            results: [],
            summary: {
                successful: 0,
                failed: 0,
                errors: []
            }
        };

        for (const [index, claim] of claims.entries()) {
            try {
                let result;
                
                switch (analysisType) {
                    case 'similarity':
                        result = await legalPrecedentService.findSimilarCases(claim, {
                            maxResults: 5,
                            includeAnalysis: true
                        });
                        break;
                    case 'prediction':
                        result = await legalPrecedentService.predictLikelyOutcome({ claimData: claim });
                        break;
                    case 'strategy':
                        result = await legalPrecedentService.generateStrategyRecommendations({ claimData: claim });
                        break;
                    default:
                        throw new Error(`Unsupported analysis type: ${analysisType}`);
                }

                batchResults.results.push({
                    index,
                    claimId: claim.claimId || `claim_${index}`,
                    success: true,
                    result
                });

                batchResults.summary.successful++;

            } catch (error) {
                batchResults.results.push({
                    index,
                    claimId: claim.claimId || `claim_${index}`,
                    success: false,
                    error: error.message
                });

                batchResults.summary.failed++;
                batchResults.summary.errors.push({
                    index,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            batchResults,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error performing batch analysis:', error);
        res.status(500).json({
            error: 'Batch analysis failed',
            message: error.message,
            code: 'BATCH_ANALYSIS_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-precedents/reports/comprehensive
 * @desc Generate comprehensive precedent analysis report
 * @access Protected
 */
router.get('/reports/comprehensive', checkServiceReady, async (req, res) => {
    try {
        const { 
            jurisdiction, 
            claimType, 
            dateRange,
            includeAnalytics = true,
            includeRecommendations = true 
        } = req.query;

        const report = {
            reportId: `REPORT-${Date.now()}`,
            timestamp: new Date().toISOString(),
            scope: { jurisdiction, claimType, dateRange },
            sections: {}
        };

        // System metrics
        report.sections.systemMetrics = legalPrecedentService.getSystemMetrics();

        // Case database overview
        const allCases = legalPrecedentService.getAllCases({ jurisdiction, claimType });
        report.sections.caseOverview = {
            totalCases: allCases.length,
            byJurisdiction: this.groupBy(allCases, 'jurisdiction'),
            byClaimType: this.groupBy(allCases, 'claimType'),
            byOutcome: this.groupBy(allCases, 'outcome'),
            byYear: this.groupBy(allCases, 'year')
        };

        // Outcome analysis if requested
        if (includeAnalytics === 'true') {
            const outcomeAnalysis = await legalPrecedentService.analyzeOutcomes({
                jurisdiction,
                claimType,
                includeStatistics: true,
                includeTrends: true
            });
            report.sections.outcomeAnalysis = outcomeAnalysis;
        }

        // Jurisdiction analysis
        if (jurisdiction) {
            const jurisdictionAnalysis = await legalPrecedentService.analyzeJurisdictionPatterns({
                targetJurisdiction: jurisdiction,
                claimType,
                includeRecommendations: includeRecommendations === 'true'
            });
            report.sections.jurisdictionAnalysis = jurisdictionAnalysis;
        }

        res.json({
            success: true,
            report,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error generating comprehensive report:', error);
        res.status(500).json({
            error: 'Report generation failed',
            message: error.message,
            code: 'REPORT_GENERATION_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-precedents/export/results
 * @desc Export search results in various formats
 * @access Protected
 */
router.post('/export/results', checkServiceReady, async (req, res) => {
    try {
        const { searchId, format = 'json', includeAnalysis = true } = req.body;

        if (!searchId) {
            return res.status(400).json({
                error: 'Missing required field',
                message: 'searchId is required',
                code: 'VALIDATION_ERROR'
            });
        }

        // Get search results from cache
        const searchResult = legalPrecedentService.searchCache.get(searchId);
        if (!searchResult) {
            return res.status(404).json({
                error: 'Search results not found',
                message: `No cached results found for searchId: ${searchId}`,
                code: 'SEARCH_NOT_FOUND'
            });
        }

        let exportData;
        let contentType;
        let filename;

        switch (format.toLowerCase()) {
            case 'csv':
                exportData = this.convertToCSV(searchResult);
                contentType = 'text/csv';
                filename = `precedent-search-${searchId}.csv`;
                break;
            case 'pdf':
                exportData = await this.convertToPDF(searchResult);
                contentType = 'application/pdf';
                filename = `precedent-search-${searchId}.pdf`;
                break;
            case 'json':
            default:
                exportData = JSON.stringify(searchResult, null, 2);
                contentType = 'application/json';
                filename = `precedent-search-${searchId}.json`;
                break;
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exportData);

    } catch (error) {
        console.error('Error exporting results:', error);
        res.status(500).json({
            error: 'Export failed',
            message: error.message,
            code: 'EXPORT_ERROR'
        });
    }
});

// Helper functions
function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const value = item[key];
        groups[value] = (groups[value] || 0) + 1;
        return groups;
    }, {});
}

function convertToCSV(searchResult) {
    const headers = [
        'Case ID', 'Case Name', 'Jurisdiction', 'Year', 'Claim Type', 
        'Outcome', 'Damage Amount', 'Settlement Amount', 'Settlement Ratio',
        'Similarity Score', 'Citation'
    ];

    const rows = searchResult.results.map(result => [
        result.caseId,
        result.caseName,
        result.jurisdiction,
        result.year,
        result.claimType,
        result.outcome,
        result.damageAmount,
        result.settlementAmount,
        result.settlementRatio,
        result.similarity.overallScore,
        result.citation
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field || ''}"`).join(','))
        .join('\n');

    return csvContent;
}

async function convertToPDF(searchResult) {
    // Simplified PDF generation - in real implementation would use proper PDF library
    const pdfContent = `
Legal Precedent Search Report
============================

Search ID: ${searchResult.searchId}
Timestamp: ${searchResult.timestamp}
Total Results: ${searchResult.totalResults}

Results:
${searchResult.results.map(result => `
- ${result.caseName} (${result.year})
  Jurisdiction: ${result.jurisdiction}
  Outcome: ${result.outcome}
  Similarity: ${Math.round(result.similarity.overallScore * 100)}%
  Citation: ${result.citation}
`).join('')}
`;

    return pdfContent;
}

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Legal Precedent API Error:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred in the Legal Precedent Service',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString()
    });
});

export default router;