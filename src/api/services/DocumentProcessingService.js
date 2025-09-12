import fs from 'fs-extra';
import path from 'path';
import pdfParse from 'pdf-parse';

/**
 * Document Processing Service for Roof-ER Company Knowledge
 * Extracts and structures content from company documents
 */
export class DocumentProcessingService {
    constructor() {
        this.supportedFormats = ['.pdf', '.docx', '.txt', '.md', '.xlsx', '.pptx'];
        this.processedDocuments = new Map();
        this.knowledgeEntries = [];
        
        // Roof-ER specific document categories
        this.documentCategories = {
            'sales': ['sales', 'script', 'pitch', 'territory', 'tracker'],
            'insurance': ['insurance', 'claim', 'adjuster', 'coverage', 'argument'],
            'operations': ['repair', 'damage', 'inspection', 'quality', 'process'],
            'training': ['training', 'damage', 'assessment', 'procedure'],
            'templates': ['template', 'email', 'form', 'agreement'],
            'company': ['mission', 'values', 'policy', 'commitment'],
            'resources': ['warranty', 'material', 'certification', 'license']
        };
    }
    
    async processRoofERDocuments() {
        console.log('📁 Starting Roof-ER document processing...');
        
        const basePaths = [
            '/Users/a21/Downloads/Sales Rep Resources',
            '/Users/a21/Downloads/Sales Reps',
            '/Users/a21/Downloads/Training'
        ];
        
        for (const basePath of basePaths) {
            if (await fs.pathExists(basePath)) {
                await this.processDirectory(basePath);
            } else {
                console.log(`⚠️ Directory not found: ${basePath}`);
            }
        }
        
        // Process PowerPoint file
        const pptPath = '/Users/a21/Downloads/Roof-ER Sales Training.pptx';
        if (await fs.pathExists(pptPath)) {
            await this.processDocument(pptPath);
        }
        
        console.log(`✅ Processed ${this.knowledgeEntries.length} knowledge entries from Roof-ER documents`);
        return this.knowledgeEntries;
    }
    
    async processDirectory(dirPath) {
        try {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    await this.processDirectory(itemPath);
                } else {
                    await this.processDocument(itemPath);
                }
            }
        } catch (error) {
            console.log(`⚠️ Error processing directory ${dirPath}:`, error.message);
        }
    }
    
    async processDocument(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const fileName = path.basename(filePath);
            
            if (!this.supportedFormats.includes(ext)) {
                return;
            }
            
            console.log(`📄 Processing: ${fileName}`);
            
            let content = '';
            let metadata = {
                filename: fileName,
                path: filePath,
                type: ext,
                category: this.categorizeDocument(fileName, filePath),
                processed: new Date().toISOString()
            };
            
            // Extract content based on file type
            if (ext === '.txt' || ext === '.md') {
                content = await this.processTextFile(filePath);
            } else if (ext === '.docx') {
                content = await this.processDocxFile(filePath);
            } else if (ext === '.pdf') {
                content = await this.processPdfFile(filePath);
            } else if (ext === '.xlsx') {
                content = await this.processExcelFile(filePath);
            } else if (ext === '.pptx') {
                content = await this.processPowerpointFile(filePath);
            }
            
            if (content && content.trim()) {
                const entry = this.createKnowledgeEntry(content, metadata);
                this.knowledgeEntries.push(entry);
                this.processedDocuments.set(filePath, entry);
            }
            
        } catch (error) {
            console.log(`⚠️ Error processing ${filePath}:`, error.message);
        }
    }
    
    async processTextFile(filePath) {
        return await fs.readFile(filePath, 'utf8');
    }
    
    async processDocxFile(filePath) {
        // For now, return placeholder - in production would use mammoth or similar
        const fileName = path.basename(filePath);
        return `Document: ${fileName}\n\nThis document contains Roof-ER company information and procedures. For specific details, please refer to the original document or contact your supervisor.`;
    }
    
    async processPdfFile(filePath) {
        try {
            const fileName = path.basename(filePath);
            const pdfBuffer = await fs.readFile(filePath);
            
            console.log(`📄 Processing PDF: ${fileName} (${Math.round(pdfBuffer.length / 1024)}KB)`);
            
            const pdfData = await pdfParse(pdfBuffer);
            
            if (pdfData.text && pdfData.text.trim()) {
                console.log(`✅ Extracted ${pdfData.text.length} characters from PDF`);
                return pdfData.text.trim();
            } else {
                console.log(`⚠️ No text content extracted from PDF: ${fileName}`);
                return `PDF Document: ${fileName}\n\nPDF file was processed but no readable text content was extracted. This may be a scanned document or contain only images.`;
            }
        } catch (error) {
            console.error(`❌ Error processing PDF ${filePath}:`, error.message);
            const fileName = path.basename(filePath);
            return `PDF Document: ${fileName}\n\nError processing PDF file: ${error.message}. Please ensure the file is not corrupted and try again.`;
        }
    }
    
    async processExcelFile(filePath) {
        // Placeholder for Excel processing - would use xlsx package in production
        const fileName = path.basename(filePath);
        return `Spreadsheet: ${fileName}\n\nThis spreadsheet contains Roof-ER data and tracking information. Contact your supervisor for access to specific data.`;
    }
    
    async processPowerpointFile(filePath) {
        // Placeholder for PowerPoint processing
        return `Roof-ER Sales Training Presentation

Key Training Topics:
• Sales processes and procedures
• Customer interaction best practices
• Insurance claim procedures
• Quality standards and requirements
• Territory management
• Documentation requirements

For complete training materials, please refer to the full presentation or contact your training coordinator.`;
    }
    
    categorizeDocument(fileName, filePath) {
        const lowerName = fileName.toLowerCase();
        const lowerPath = filePath.toLowerCase();
        
        for (const [category, keywords] of Object.entries(this.documentCategories)) {
            for (const keyword of keywords) {
                if (lowerName.includes(keyword) || lowerPath.includes(keyword)) {
                    return category;
                }
            }
        }
        
        // Category based on directory structure
        if (lowerPath.includes('sales')) return 'sales';
        if (lowerPath.includes('insurance')) return 'insurance';
        if (lowerPath.includes('training')) return 'training';
        if (lowerPath.includes('template')) return 'templates';
        if (lowerPath.includes('license') || lowerPath.includes('certification')) return 'resources';
        
        return 'general';
    }
    
    createKnowledgeEntry(content, metadata) {
        const keywords = this.extractKeywords(content, metadata);
        const summary = this.generateSummary(content);
        
        return {
            id: this.generateId(metadata.filename),
            title: this.generateTitle(metadata.filename),
            content: content,
            summary: summary,
            category: metadata.category,
            keywords: keywords,
            metadata: metadata,
            confidence: this.calculateConfidence(content, metadata),
            source: metadata.filename,
            templates: this.extractTemplates(content, metadata),
            procedures: this.extractProcedures(content),
            contacts: this.extractContactInfo(content),
            created: new Date().toISOString()
        };
    }
    
    extractKeywords(content, metadata) {
        const keywords = [];
        const text = content.toLowerCase();
        
        // Common Roof-ER terms
        const roofingTerms = [
            'roof', 'shingle', 'damage', 'repair', 'replacement', 'insurance',
            'claim', 'adjuster', 'estimate', 'inspection', 'tpo', 'epdm',
            'modified bitumen', 'gaf', 'warranty', 'quality', 'field tech'
        ];
        
        roofingTerms.forEach(term => {
            if (text.includes(term)) {
                keywords.push(term);
            }
        });
        
        // Add category-specific keywords
        const categoryKeywords = this.documentCategories[metadata.category] || [];
        keywords.push(...categoryKeywords);
        
        // Extract from filename
        const filenameWords = metadata.filename
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2);
        
        keywords.push(...filenameWords);
        
        return [...new Set(keywords)]; // Remove duplicates
    }
    
    generateSummary(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        return sentences.slice(0, 2).join('. ').trim() + (sentences.length > 2 ? '...' : '');
    }
    
    generateTitle(filename) {
        return filename
            .replace(/\.[^/.]+$/, '') // Remove extension
            .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
            .replace(/\b\w/g, l => l.toUpperCase()); // Title case
    }
    
    generateId(filename) {
        return filename
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }
    
    calculateConfidence(content, metadata) {
        let confidence = 0.7; // Base confidence
        
        // Higher confidence for official documents
        if (metadata.filename.includes('template') || 
            metadata.filename.includes('script') ||
            metadata.filename.includes('process')) {
            confidence += 0.2;
        }
        
        // Higher confidence for longer, detailed content
        if (content.length > 500) {
            confidence += 0.1;
        }
        
        return Math.min(1.0, confidence);
    }
    
    extractTemplates(content, metadata) {
        const templates = [];
        
        if (metadata.category === 'templates' || content.includes('template')) {
            // Extract email templates or forms
            const lines = content.split('\n');
            let templateContent = '';
            let inTemplate = false;
            
            for (const line of lines) {
                if (line.includes('Subject:') || line.includes('Dear') || line.includes('Hi ')) {
                    inTemplate = true;
                    templateContent = line;
                } else if (inTemplate) {
                    templateContent += '\n' + line;
                    if (line.includes('Best regards') || line.includes('Sincerely')) {
                        templates.push({
                            type: 'email',
                            content: templateContent.trim()
                        });
                        inTemplate = false;
                        templateContent = '';
                    }
                }
            }
        }
        
        return templates;
    }
    
    extractProcedures(content) {
        const procedures = [];
        const lines = content.split('\n');
        let currentProcedure = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Look for numbered steps or bullet points
            if (/^\d+\.|\•|\*/.test(trimmed)) {
                currentProcedure.push(trimmed);
            } else if (currentProcedure.length > 0 && trimmed === '') {
                if (currentProcedure.length >= 2) {
                    procedures.push(currentProcedure.join('\n'));
                }
                currentProcedure = [];
            }
        }
        
        if (currentProcedure.length >= 2) {
            procedures.push(currentProcedure.join('\n'));
        }
        
        return procedures;
    }
    
    extractContactInfo(content) {
        const contacts = [];
        const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
        const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        
        const emails = content.match(emailRegex) || [];
        const phones = content.match(phoneRegex) || [];
        
        emails.forEach(email => contacts.push({ type: 'email', value: email }));
        phones.forEach(phone => contacts.push({ type: 'phone', value: phone }));
        
        return contacts;
    }
    
    getProcessingStats() {
        const stats = {
            totalDocuments: this.processedDocuments.size,
            totalEntries: this.knowledgeEntries.length,
            categories: {},
            fileTypes: {}
        };
        
        this.knowledgeEntries.forEach(entry => {
            // Count categories
            if (!stats.categories[entry.category]) {
                stats.categories[entry.category] = 0;
            }
            stats.categories[entry.category]++;
            
            // Count file types
            const type = entry.metadata.type;
            if (!stats.fileTypes[type]) {
                stats.fileTypes[type] = 0;
            }
            stats.fileTypes[type]++;
        });
        
        return stats;
    }
    
    searchDocuments(query, category = null) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        for (const entry of this.knowledgeEntries) {
            if (category && entry.category !== category) continue;
            
            let score = 0;
            
            // Check title match
            if (entry.title.toLowerCase().includes(queryLower)) {
                score += 0.5;
            }
            
            // Check keyword match
            const keywordMatches = entry.keywords.filter(keyword => 
                keyword.includes(queryLower) || queryLower.includes(keyword)
            ).length;
            score += keywordMatches * 0.2;
            
            // Check content match
            if (entry.content.toLowerCase().includes(queryLower)) {
                score += 0.3;
            }
            
            if (score > 0) {
                results.push({
                    entry,
                    score,
                    relevance: Math.min(1.0, score)
                });
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }
}