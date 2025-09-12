import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class InteractiveTrainingService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/training');
    this.modulesDir = path.join(this.dataDir, 'modules');
    this.progressDir = path.join(this.dataDir, 'progress');
    this.certificationsDir = path.join(this.dataDir, 'certifications');
    this.mediaDir = path.join(this.dataDir, 'media');
    this.assessmentsDir = path.join(this.dataDir, 'assessments');

    // In-memory caches for performance
    this.trainingModules = new Map();
    this.userProgress = new Map();
    this.certifications = new Map();
    this.assessmentResults = new Map();
    this.gamificationData = new Map();

    // AI Integration
    this.aiService = null; // Will be injected
    this.susanFeedbackEngine = new SusanFeedbackEngine();

    // Training categories and modules
    this.trainingCategories = {
      roofing_inspection: {
        name: 'Roofing Inspection Training',
        description: 'Comprehensive roofing inspection techniques and methodologies',
        color: '#3B82F6',
        icon: 'roof',
        modules: [
          'basic_inspection_techniques',
          'photo_analysis_fundamentals',
          'damage_identification',
          'measurement_techniques',
          'safety_protocols',
          'equipment_usage',
          'weather_assessment',
          'structural_analysis'
        ]
      },
      damage_assessment: {
        name: 'Damage Assessment Certification',
        description: 'Professional damage assessment and documentation',
        color: '#EF4444',
        icon: 'assessment',
        modules: [
          'damage_classification',
          'severity_assessment',
          'documentation_standards',
          'before_after_analysis',
          'cost_estimation',
          'material_identification',
          'age_determination',
          'repair_recommendations'
        ]
      },
      insurance_process: {
        name: 'Insurance Process Training',
        description: 'Complete insurance claim lifecycle education',
        color: '#10B981',
        icon: 'insurance',
        modules: [
          'claim_initiation',
          'documentation_requirements',
          'adjuster_communication',
          'negotiation_strategies',
          'settlement_processes',
          'appeals_procedures',
          'legal_compliance',
          'fraud_prevention'
        ]
      },
      building_codes: {
        name: 'Building Code Compliance',
        description: 'State-specific building code training and compliance',
        color: '#8B5CF6',
        icon: 'building',
        modules: [
          'local_building_codes',
          'permit_requirements',
          'inspection_standards',
          'compliance_verification',
          'code_violations',
          'remediation_procedures',
          'updates_tracking',
          'jurisdictional_differences'
        ]
      },
      communication_skills: {
        name: 'Communication Skills',
        description: 'Professional communication and adjuster interaction',
        color: '#F59E0B',
        icon: 'communication',
        modules: [
          'professional_communication',
          'adjuster_relations',
          'client_interaction',
          'difficult_conversations',
          'presentation_skills',
          'written_communication',
          'phone_etiquette',
          'conflict_resolution'
        ]
      },
      susan_ai_mastery: {
        name: 'Susan AI Technology Mastery',
        description: 'Complete Susan AI platform training and optimization',
        color: '#EC4899',
        icon: 'ai',
        modules: [
          'susan_basics',
          'advanced_features',
          'voice_commands',
          'photo_analysis',
          'report_generation',
          'integration_usage',
          'troubleshooting',
          'optimization_techniques'
        ]
      }
    };

    this.ensureDirectories();
    this.initializeTrainingModules();
    this.setupProgressTracking();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.modulesDir);
    await fs.ensureDir(this.progressDir);
    await fs.ensureDir(this.certificationsDir);
    await fs.ensureDir(this.mediaDir);
    await fs.ensureDir(this.assessmentsDir);
  }

  setAIService(aiService) {
    this.aiService = aiService;
    this.susanFeedbackEngine.setAIService(aiService);
  }

  /**
   * Initialize all training modules with content and structure
   */
  async initializeTrainingModules() {
    try {
      for (const [categoryId, category] of Object.entries(this.trainingCategories)) {
        for (const moduleId of category.modules) {
          await this.createTrainingModule(categoryId, moduleId);
        }
      }

      logger.info('Training modules initialized successfully', {
        categoriesCount: Object.keys(this.trainingCategories).length,
        totalModules: Object.values(this.trainingCategories).reduce((sum, cat) => sum + cat.modules.length, 0)
      });
    } catch (error) {
      logger.error('Failed to initialize training modules', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a comprehensive training module
   */
  async createTrainingModule(categoryId, moduleId) {
    const category = this.trainingCategories[categoryId];
    if (!category) {
      throw new ApiError(400, `Invalid category: ${categoryId}`);
    }

    const module = {
      id: moduleId,
      categoryId,
      categoryName: category.name,
      name: this.formatModuleName(moduleId),
      description: this.generateModuleDescription(categoryId, moduleId),
      difficulty: this.calculateModuleDifficulty(categoryId, moduleId),
      estimatedDuration: this.estimateModuleDuration(categoryId, moduleId),
      prerequisites: this.getModulePrerequisites(categoryId, moduleId),
      learningObjectives: this.generateLearningObjectives(categoryId, moduleId),
      content: await this.generateModuleContent(categoryId, moduleId),
      assessments: await this.generateModuleAssessments(categoryId, moduleId),
      multimedia: await this.generateMultimediaContent(categoryId, moduleId),
      interactiveElements: await this.generateInteractiveElements(categoryId, moduleId),
      susanIntegration: await this.generateSusanIntegration(categoryId, moduleId),
      certification: this.generateCertificationInfo(categoryId, moduleId),
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.trainingModules.set(`${categoryId}_${moduleId}`, module);

    // Save to disk
    const moduleFile = path.join(this.modulesDir, `${categoryId}_${moduleId}.json`);
    await fs.writeJson(moduleFile, module, { spaces: 2 });

    return module;
  }

  /**
   * Get all available training modules
   */
  async getTrainingModules(filters = {}) {
    const { categoryId, difficulty, userId, includeProgress = false } = filters;

    try {
      let modules = Array.from(this.trainingModules.values());

      // Apply filters
      if (categoryId) {
        modules = modules.filter(module => module.categoryId === categoryId);
      }

      if (difficulty) {
        modules = modules.filter(module => module.difficulty === difficulty);
      }

      // Add user progress if requested and userId provided
      if (includeProgress && userId) {
        const userProgress = await this.getUserProgress(userId);
        modules = modules.map(module => ({
          ...module,
          userProgress: userProgress.modules[`${module.categoryId}_${module.id}`] || {
            status: 'not_started',
            progress: 0,
            completedLessons: [],
            score: null,
            startedAt: null,
            completedAt: null
          }
        }));
      }

      return {
        categories: this.trainingCategories,
        modules,
        totalModules: modules.length
      };
    } catch (error) {
      logger.error('Failed to get training modules', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Get a specific training module with full content
   */
  async getTrainingModule(categoryId, moduleId, userId = null) {
    const moduleKey = `${categoryId}_${moduleId}`;
    const module = this.trainingModules.get(moduleKey);

    if (!module) {
      throw new ApiError(404, `Training module not found: ${moduleKey}`);
    }

    try {
      // Clone module to avoid modifying original
      const fullModule = { ...module };

      // Add user progress if userId provided
      if (userId) {
        const userProgress = await this.getUserProgress(userId);
        fullModule.userProgress = userProgress.modules[moduleKey] || {
          status: 'not_started',
          progress: 0,
          completedLessons: [],
          score: null,
          startedAt: null,
          completedAt: null
        };

        // Add personalized recommendations
        fullModule.recommendations = await this.generatePersonalizedRecommendations(userId, fullModule);
      }

      // Load multimedia content URLs
      fullModule.multimedia = await this.loadMultimediaUrls(fullModule.multimedia);

      return fullModule;
    } catch (error) {
      logger.error('Failed to get training module', { 
        categoryId, 
        moduleId, 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Start a training module for a user
   */
  async startTrainingModule(userId, categoryId, moduleId) {
    const moduleKey = `${categoryId}_${moduleId}`;
    const module = this.trainingModules.get(moduleKey);

    if (!module) {
      throw new ApiError(404, `Training module not found: ${moduleKey}`);
    }

    try {
      // Check prerequisites
      await this.checkModulePrerequisites(userId, module);

      // Get or create user progress
      const userProgress = await this.getUserProgress(userId);

      // Initialize module progress
      userProgress.modules[moduleKey] = {
        status: 'in_progress',
        progress: 0,
        completedLessons: [],
        currentLesson: 0,
        score: null,
        startedAt: new Date(),
        completedAt: null,
        attempts: 1,
        timeSpent: 0,
        interactions: []
      };

      // Update overall progress
      userProgress.totalModulesStarted += 1;
      userProgress.lastActivity = new Date();

      // Save progress
      await this.saveUserProgress(userId, userProgress);

      // Log activity
      this.emit('training:module_started', {
        userId,
        categoryId,
        moduleId,
        timestamp: new Date()
      });

      logger.info('Training module started', { userId, categoryId, moduleId });

      return {
        status: 'started',
        moduleKey,
        progress: userProgress.modules[moduleKey],
        nextLesson: module.content.lessons[0] || null
      };
    } catch (error) {
      logger.error('Failed to start training module', { 
        userId, 
        categoryId, 
        moduleId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Complete a lesson within a training module
   */
  async completeLesson(userId, categoryId, moduleId, lessonId, lessonData = {}) {
    const moduleKey = `${categoryId}_${moduleId}`;
    const module = this.trainingModules.get(moduleKey);

    if (!module) {
      throw new ApiError(404, `Training module not found: ${moduleKey}`);
    }

    try {
      const userProgress = await this.getUserProgress(userId);
      const moduleProgress = userProgress.modules[moduleKey];

      if (!moduleProgress || moduleProgress.status !== 'in_progress') {
        throw new ApiError(400, 'Module not started or already completed');
      }

      // Find the lesson
      const lesson = module.content.lessons.find(l => l.id === lessonId);
      if (!lesson) {
        throw new ApiError(404, `Lesson not found: ${lessonId}`);
      }

      // Record lesson completion
      if (!moduleProgress.completedLessons.includes(lessonId)) {
        moduleProgress.completedLessons.push(lessonId);
      }

      // Update progress percentage
      const totalLessons = module.content.lessons.length;
      moduleProgress.progress = (moduleProgress.completedLessons.length / totalLessons) * 100;

      // Record interaction data
      moduleProgress.interactions.push({
        type: 'lesson_completed',
        lessonId,
        timestamp: new Date(),
        data: lessonData
      });

      // Generate Susan AI feedback
      const susanFeedback = await this.generateSusanFeedback(userId, module, lesson, lessonData);

      // Check if module is completed
      if (moduleProgress.progress >= 100) {
        moduleProgress.status = 'completed';
        moduleProgress.completedAt = new Date();
        userProgress.totalModulesCompleted += 1;

        // Generate completion certificate
        await this.generateCompletionCertificate(userId, module);

        this.emit('training:module_completed', {
          userId,
          categoryId,
          moduleId,
          score: moduleProgress.score,
          timestamp: new Date()
        });
      }

      // Update last activity
      userProgress.lastActivity = new Date();

      // Save progress
      await this.saveUserProgress(userId, userProgress);

      logger.info('Lesson completed', { 
        userId, 
        categoryId, 
        moduleId, 
        lessonId, 
        progress: moduleProgress.progress 
      });

      return {
        status: 'completed',
        lessonId,
        moduleProgress: moduleProgress.progress,
        susanFeedback,
        nextLesson: this.getNextLesson(module, lessonId),
        moduleCompleted: moduleProgress.status === 'completed'
      };
    } catch (error) {
      logger.error('Failed to complete lesson', { 
        userId, 
        categoryId, 
        moduleId, 
        lessonId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Submit assessment for a training module
   */
  async submitAssessment(userId, categoryId, moduleId, assessmentId, answers) {
    const moduleKey = `${categoryId}_${moduleId}`;
    const module = this.trainingModules.get(moduleKey);

    if (!module) {
      throw new ApiError(404, `Training module not found: ${moduleKey}`);
    }

    try {
      const assessment = module.assessments.find(a => a.id === assessmentId);
      if (!assessment) {
        throw new ApiError(404, `Assessment not found: ${assessmentId}`);
      }

      // Grade the assessment
      const gradingResult = await this.gradeAssessment(assessment, answers);

      // Get user progress
      const userProgress = await this.getUserProgress(userId);
      const moduleProgress = userProgress.modules[moduleKey];

      if (!moduleProgress) {
        throw new ApiError(400, 'Module not started');
      }

      // Record assessment result
      const assessmentResult = {
        assessmentId,
        answers,
        score: gradingResult.score,
        maxScore: gradingResult.maxScore,
        percentage: gradingResult.percentage,
        passed: gradingResult.passed,
        feedback: gradingResult.feedback,
        corrections: gradingResult.corrections,
        submittedAt: new Date(),
        timeSpent: gradingResult.timeSpent || 0
      };

      moduleProgress.assessments = moduleProgress.assessments || [];
      moduleProgress.assessments.push(assessmentResult);

      // Update module score (use highest score)
      const currentScore = moduleProgress.score || 0;
      if (gradingResult.percentage > currentScore) {
        moduleProgress.score = gradingResult.percentage;
      }

      // Generate Susan AI feedback for assessment
      const susanFeedback = await this.generateAssessmentFeedback(userId, module, assessment, assessmentResult);

      // Check certification eligibility
      const certificationEligible = await this.checkCertificationEligibility(userId, module);

      // Save assessment result
      await this.saveAssessmentResult(userId, moduleKey, assessmentResult);

      // Update progress
      userProgress.lastActivity = new Date();
      await this.saveUserProgress(userId, userProgress);

      this.emit('training:assessment_submitted', {
        userId,
        categoryId,
        moduleId,
        assessmentId,
        score: gradingResult.percentage,
        passed: gradingResult.passed,
        timestamp: new Date()
      });

      logger.info('Assessment submitted', { 
        userId, 
        categoryId, 
        moduleId, 
        assessmentId, 
        score: gradingResult.percentage,
        passed: gradingResult.passed
      });

      return {
        status: 'submitted',
        result: assessmentResult,
        susanFeedback,
        certificationEligible,
        recommendations: await this.generatePostAssessmentRecommendations(userId, module, assessmentResult)
      };
    } catch (error) {
      logger.error('Failed to submit assessment', { 
        userId, 
        categoryId, 
        moduleId, 
        assessmentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get user's training progress
   */
  async getUserProgress(userId) {
    try {
      const progressFile = path.join(this.progressDir, `${userId}.json`);
      
      if (await fs.pathExists(progressFile)) {
        const progress = await fs.readJson(progressFile);
        this.userProgress.set(userId, progress);
        return progress;
      }

      // Create new progress record
      const newProgress = {
        userId,
        modules: {},
        certifications: [],
        achievements: [],
        totalModulesStarted: 0,
        totalModulesCompleted: 0,
        totalTimeSpent: 0,
        level: 1,
        experiencePoints: 0,
        streak: 0,
        lastActivity: new Date(),
        createdAt: new Date()
      };

      this.userProgress.set(userId, newProgress);
      await this.saveUserProgress(userId, newProgress);

      return newProgress;
    } catch (error) {
      logger.error('Failed to get user progress', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get comprehensive training analytics for a user
   */
  async getUserTrainingAnalytics(userId, timeframe = '30d') {
    try {
      const userProgress = await this.getUserProgress(userId);
      const assessmentResults = await this.getUserAssessmentResults(userId);

      const analytics = {
        overview: {
          totalModulesStarted: userProgress.totalModulesStarted,
          totalModulesCompleted: userProgress.totalModulesCompleted,
          completionRate: userProgress.totalModulesStarted > 0 
            ? (userProgress.totalModulesCompleted / userProgress.totalModulesStarted) * 100 
            : 0,
          totalTimeSpent: userProgress.totalTimeSpent,
          averageScore: this.calculateAverageScore(userProgress),
          currentLevel: userProgress.level,
          experiencePoints: userProgress.experiencePoints,
          streak: userProgress.streak
        },
        categoryProgress: this.calculateCategoryProgress(userProgress),
        recentActivity: await this.getRecentActivity(userId, timeframe),
        achievements: userProgress.achievements,
        certifications: userProgress.certifications,
        recommendations: await this.generateProgressRecommendations(userId, userProgress),
        competencyMap: await this.generateCompetencyMap(userId, userProgress),
        learningPath: await this.generateOptimalLearningPath(userId, userProgress)
      };

      return analytics;
    } catch (error) {
      logger.error('Failed to get user training analytics', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Generate interactive photo analysis tutorial
   */
  async generatePhotoAnalysisTutorial(photoData, analysisType = 'damage_assessment') {
    try {
      if (!this.aiService) {
        throw new ApiError(500, 'AI service not available for tutorial generation');
      }

      const tutorial = {
        id: `tutorial_${Date.now()}`,
        type: 'photo_analysis',
        analysisType,
        photo: photoData,
        steps: [],
        interactiveElements: [],
        expectedOutcomes: [],
        commonMistakes: [],
        susanTips: [],
        generatedAt: new Date()
      };

      // Generate step-by-step analysis tutorial
      const analysisSteps = await this.generateAnalysisSteps(photoData, analysisType);
      tutorial.steps = analysisSteps;

      // Add interactive hotspots and annotations
      const interactiveElements = await this.generateInteractiveHotspots(photoData, analysisSteps);
      tutorial.interactiveElements = interactiveElements;

      // Generate Susan AI insights and tips
      const susanInsights = await this.generateSusanAnalysisInsights(photoData, analysisType);
      tutorial.susanTips = susanInsights;

      return tutorial;
    } catch (error) {
      logger.error('Failed to generate photo analysis tutorial', { 
        analysisType, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get training recommendations based on user performance
   */
  async getTrainingRecommendations(userId, context = {}) {
    try {
      const userProgress = await this.getUserProgress(userId);
      const assessmentResults = await this.getUserAssessmentResults(userId);

      const recommendations = {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        skillGaps: [],
        strengths: [],
        generatedAt: new Date()
      };

      // Analyze user performance and generate recommendations
      const performanceAnalysis = await this.analyzeUserPerformance(userId, userProgress, assessmentResults);

      // Generate immediate recommendations (next best actions)
      recommendations.immediate = await this.generateImmediateRecommendations(performanceAnalysis, context);

      // Generate short-term learning goals (1-4 weeks)
      recommendations.shortTerm = await this.generateShortTermRecommendations(performanceAnalysis, context);

      // Generate long-term career development (3-12 months)
      recommendations.longTerm = await this.generateLongTermRecommendations(performanceAnalysis, context);

      // Identify skill gaps and strengths
      recommendations.skillGaps = await this.identifySkillGaps(performanceAnalysis);
      recommendations.strengths = await this.identifyStrengths(performanceAnalysis);

      return recommendations;
    } catch (error) {
      logger.error('Failed to get training recommendations', { userId, error: error.message });
      throw error;
    }
  }

  // Helper methods for module content generation

  formatModuleName(moduleId) {
    return moduleId.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  generateModuleDescription(categoryId, moduleId) {
    const descriptions = {
      roofing_inspection: {
        basic_inspection_techniques: 'Learn fundamental roofing inspection methodologies and best practices for comprehensive property assessment.',
        photo_analysis_fundamentals: 'Master the art of analyzing roofing photos to identify damage, materials, and structural issues.',
        damage_identification: 'Develop expertise in identifying various types of roofing damage and their underlying causes.',
        measurement_techniques: 'Learn accurate measurement techniques for roofing materials, areas, and damage quantification.',
        safety_protocols: 'Understand essential safety protocols and procedures for roofing inspections and site visits.',
        equipment_usage: 'Master the use of professional roofing inspection equipment and measurement tools.',
        weather_assessment: 'Learn to assess weather-related damage and understand its impact on roofing systems.',
        structural_analysis: 'Develop skills in analyzing structural integrity and identifying potential safety concerns.'
      },
      damage_assessment: {
        damage_classification: 'Learn to classify different types of damage according to industry standards and insurance requirements.',
        severity_assessment: 'Master the evaluation of damage severity and its impact on structural integrity and repair costs.',
        documentation_standards: 'Understand professional documentation standards for damage assessment and insurance claims.',
        before_after_analysis: 'Develop skills in comparing before and after conditions to assess damage progression.',
        cost_estimation: 'Learn accurate cost estimation techniques for repair and replacement of damaged roofing systems.',
        material_identification: 'Master the identification of roofing materials and their specific characteristics and vulnerabilities.',
        age_determination: 'Develop expertise in determining the age and condition of roofing systems and components.',
        repair_recommendations: 'Learn to provide professional repair recommendations based on damage assessment findings.'
      }
      // Add more descriptions for other categories...
    };

    return descriptions[categoryId]?.[moduleId] || `Comprehensive training module for ${this.formatModuleName(moduleId).toLowerCase()}.`;
  }

  calculateModuleDifficulty(categoryId, moduleId) {
    // Basic modules are beginner level, advanced ones are expert level
    const basicModules = ['basic_inspection_techniques', 'susan_basics', 'professional_communication'];
    const advancedModules = ['structural_analysis', 'optimization_techniques', 'appeals_procedures'];
    
    if (basicModules.includes(moduleId)) return 'beginner';
    if (advancedModules.includes(moduleId)) return 'expert';
    return 'intermediate';
  }

  estimateModuleDuration(categoryId, moduleId) {
    // Duration in minutes based on complexity
    const durations = {
      beginner: 45,
      intermediate: 75,
      expert: 120
    };

    const difficulty = this.calculateModuleDifficulty(categoryId, moduleId);
    return durations[difficulty];
  }

  getModulePrerequisites(categoryId, moduleId) {
    const prerequisites = {
      damage_identification: ['basic_inspection_techniques'],
      structural_analysis: ['damage_identification', 'safety_protocols'],
      advanced_features: ['susan_basics'],
      appeals_procedures: ['claim_initiation', 'documentation_requirements']
    };

    return prerequisites[moduleId] || [];
  }

  async generateModuleContent(categoryId, moduleId) {
    // Generate comprehensive module content structure
    return {
      overview: {
        description: this.generateModuleDescription(categoryId, moduleId),
        objectives: this.generateLearningObjectives(categoryId, moduleId),
        duration: this.estimateModuleDuration(categoryId, moduleId),
        difficulty: this.calculateModuleDifficulty(categoryId, moduleId)
      },
      lessons: await this.generateLessons(categoryId, moduleId),
      practicalExercises: [], // await this.generatePracticalExercises(categoryId, moduleId),
      caseStudies: [], // await this.generateCaseStudies(categoryId, moduleId),
      resources: [], // await this.generateResources(categoryId, moduleId),
      glossary: [] // await this.generateGlossary(categoryId, moduleId)
    };
  }

  generateLearningObjectives(categoryId, moduleId) {
    // Generate specific learning objectives for each module
    const objectives = {
      basic_inspection_techniques: [
        'Conduct systematic roof inspections following industry standards',
        'Identify key components of roofing systems',
        'Document findings using professional terminology',
        'Apply safety protocols during inspections'
      ],
      photo_analysis_fundamentals: [
        'Analyze roofing photos for damage indicators',
        'Use photo analysis tools effectively',
        'Create detailed photo reports',
        'Identify photo quality issues and solutions'
      ]
      // Add more objectives for other modules...
    };

    return objectives[moduleId] || [
      `Master the fundamentals of ${this.formatModuleName(moduleId).toLowerCase()}`,
      `Apply best practices in professional ${categoryId.replace('_', ' ')} scenarios`,
      `Demonstrate competency through practical assessments`
    ];
  }

  async generateLessons(categoryId, moduleId) {
    // Generate detailed lesson structure
    const baseLesson = {
      type: 'interactive',
      estimatedDuration: 15, // minutes
      mediaType: 'mixed',
      hasQuiz: true,
      hasPractical: false
    };

    const lessons = [];
    const lessonCount = this.calculateModuleDifficulty(categoryId, moduleId) === 'expert' ? 8 : 
                       this.calculateModuleDifficulty(categoryId, moduleId) === 'intermediate' ? 6 : 4;

    for (let i = 1; i <= lessonCount; i++) {
      lessons.push({
        ...baseLesson,
        id: `lesson_${i}`,
        title: `${this.formatModuleName(moduleId)} - Part ${i}`,
        description: `Comprehensive lesson ${i} covering key aspects of ${this.formatModuleName(moduleId).toLowerCase()}.`,
        content: await this.generateLessonContent(categoryId, moduleId, i),
        objectives: [`Complete objective ${i} for ${this.formatModuleName(moduleId)}`],
        prerequisites: i > 1 ? [`lesson_${i-1}`] : [],
        sequence: i
      });
    }

    return lessons;
  }

  async generateLessonContent(categoryId, moduleId, lessonNumber) {
    // Generate specific lesson content based on category, module, and lesson number
    return {
      introduction: `Welcome to lesson ${lessonNumber} of ${this.formatModuleName(moduleId)}.`,
      sections: [
        {
          type: 'text',
          title: 'Learning Overview',
          content: `In this lesson, you will learn about key concepts in ${this.formatModuleName(moduleId).toLowerCase()}.`
        },
        {
          type: 'interactive',
          title: 'Interactive Exercise',
          content: 'Hands-on practice with real-world scenarios.'
        },
        {
          type: 'video',
          title: 'Demonstration Video',
          content: 'Visual demonstration of key techniques and concepts.',
          duration: 300 // 5 minutes
        }
      ],
      summary: `Summary of key points covered in lesson ${lessonNumber}.`,
      nextSteps: `Preparation for lesson ${lessonNumber + 1} or module completion.`
    };
  }

  async saveUserProgress(userId, progress) {
    try {
      this.userProgress.set(userId, progress);
      const progressFile = path.join(this.progressDir, `${userId}.json`);
      await fs.writeJson(progressFile, progress, { spaces: 2 });
    } catch (error) {
      logger.error('Failed to save user progress', { userId, error: error.message });
      throw error;
    }
  }

  async setupProgressTracking() {
    // Set up periodic progress tracking and analytics
    setInterval(async () => {
      try {
        await this.updateProgressAnalytics();
      } catch (error) {
        logger.error('Failed to update progress analytics', { error: error.message });
      }
    }, 300000); // Every 5 minutes
  }

  async updateProgressAnalytics() {
    // Update aggregated progress analytics
    const allUsers = Array.from(this.userProgress.keys());
    const analytics = {
      totalUsers: allUsers.length,
      activeUsers: 0,
      completionRates: {},
      popularModules: {},
      averageScores: {},
      lastUpdated: new Date()
    };

    // Calculate analytics
    for (const userId of allUsers) {
      const progress = this.userProgress.get(userId);
      if (progress && progress.lastActivity > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
        analytics.activeUsers++;
      }
    }

    // Save analytics
    const analyticsFile = path.join(this.dataDir, 'analytics.json');
    await fs.writeJson(analyticsFile, analytics, { spaces: 2 });
  }

  // Additional helper methods

  async generateModuleAssessments(categoryId, moduleId) {
    return [
      {
        id: `${moduleId}_quiz`,
        type: 'quiz',
        title: `${this.formatModuleName(moduleId)} Knowledge Check`,
        description: 'Test your understanding of key concepts',
        questions: await this.generateAssessmentQuestions(categoryId, moduleId),
        passingScore: 80,
        timeLimit: 30,
        attempts: 3
      },
      {
        id: `${moduleId}_practical`,
        type: 'practical',
        title: `${this.formatModuleName(moduleId)} Practical Assessment`,
        description: 'Apply your knowledge in real-world scenarios',
        tasks: await this.generatePracticalTasks(categoryId, moduleId),
        passingScore: 85,
        timeLimit: 60
      }
    ];
  }

  async generateAssessmentQuestions(categoryId, moduleId) {
    // Generate contextual assessment questions
    const baseQuestions = [
      {
        id: 'q1',
        type: 'multiple_choice',
        question: `What is the primary focus of ${this.formatModuleName(moduleId).toLowerCase()}?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0,
        explanation: 'Detailed explanation of the correct answer.',
        points: 10
      },
      {
        id: 'q2',
        type: 'scenario',
        question: `In a typical ${categoryId.replace('_', ' ')} scenario, what would you do first?`,
        options: ['Action A', 'Action B', 'Action C', 'Action D'],
        correctAnswer: 1,
        explanation: 'Explanation of best practices.',
        points: 15
      }
    ];

    return baseQuestions;
  }

  async generatePracticalTasks(categoryId, moduleId) {
    return [
      {
        id: 'task1',
        title: 'Photo Analysis Task',
        description: 'Analyze the provided roofing photos and identify key issues',
        type: 'photo_analysis',
        materials: ['sample_photos', 'analysis_template'],
        timeEstimate: 20,
        scoring: {
          accuracy: 40,
          completeness: 30,
          professionalism: 30
        }
      }
    ];
  }

  async generateMultimediaContent(categoryId, moduleId) {
    return {
      videos: [
        {
          id: 'intro_video',
          title: `Introduction to ${this.formatModuleName(moduleId)}`,
          description: 'Overview and key concepts',
          duration: 300,
          url: `/media/videos/${categoryId}/${moduleId}/intro.mp4`,
          thumbnail: `/media/thumbnails/${categoryId}/${moduleId}/intro.jpg`,
          captions: true,
          interactive: false
        }
      ],
      images: [
        {
          id: 'reference_images',
          title: 'Reference Images',
          description: 'Visual examples and references',
          gallery: [`/media/images/${categoryId}/${moduleId}/ref1.jpg`],
          interactive: true,
          annotations: true
        }
      ],
      audio: [
        {
          id: 'expert_interview',
          title: 'Expert Interview',
          description: 'Industry expert insights',
          duration: 600,
          url: `/media/audio/${categoryId}/${moduleId}/interview.mp3`,
          transcript: true
        }
      ],
      interactive: [
        {
          id: 'virtual_simulation',
          title: 'Virtual Inspection Simulation',
          description: 'Interactive inspection scenario',
          type: 'simulation',
          url: `/media/interactive/${categoryId}/${moduleId}/simulation.html`,
          duration: 900
        }
      ]
    };
  }

  async generateInteractiveElements(categoryId, moduleId) {
    return [
      {
        type: 'hotspot_image',
        title: 'Interactive Roof Diagram',
        description: 'Click on different areas to learn more',
        imageUrl: `/media/interactive/${categoryId}/${moduleId}/roof_diagram.jpg`,
        hotspots: [
          {
            x: 100, y: 150,
            title: 'Shingles',
            content: 'Learn about shingle types and common issues'
          }
        ]
      },
      {
        type: 'drag_drop',
        title: 'Damage Classification Exercise',
        description: 'Drag damage types to the correct categories',
        items: ['Storm damage', 'Wear and tear', 'Manufacturing defect'],
        categories: ['Covered', 'Not covered', 'Requires investigation']
      },
      {
        type: 'virtual_walkthrough',
        title: '360° Property Inspection',
        description: 'Navigate through a virtual property inspection',
        scenes: [
          { id: 'exterior', title: 'Exterior View', url: '/media/360/exterior.jpg' },
          { id: 'roof', title: 'Roof View', url: '/media/360/roof.jpg' }
        ]
      }
    ];
  }

  async generateSusanIntegration(categoryId, moduleId) {
    return {
      susanFeatures: [
        {
          feature: 'voice_commands',
          integration: 'Practice using Susan voice commands during training',
          commands: ['Hey Susan, analyze this roof photo', 'Susan, create damage report'],
          availability: 'throughout_module'
        },
        {
          feature: 'ai_feedback',
          integration: 'Get real-time feedback from Susan AI',
          triggers: ['lesson_completion', 'quiz_submission', 'practical_task'],
          personalization: true
        },
        {
          feature: 'smart_recommendations',
          integration: 'Susan suggests next best actions and learning paths',
          based_on: ['performance', 'learning_style', 'goals'],
          frequency: 'adaptive'
        }
      ],
      practiceMode: {
        enabled: true,
        description: 'Practice with Susan AI in realistic scenarios',
        scenarios: [
          'Client consultation simulation',
          'Insurance adjuster meeting',
          'Damage assessment walkthrough'
        ]
      },
      integration_points: [
        'lesson_start',
        'concept_explanation',
        'practical_exercise',
        'assessment_review',
        'module_completion'
      ]
    };
  }

  generateCertificationInfo(categoryId, moduleId) {
    return {
      available: true,
      requirements: {
        module_completion: true,
        passing_score: 85,
        practical_assessment: true,
        time_requirement: this.estimateModuleDuration(categoryId, moduleId)
      },
      certificate: {
        type: 'digital',
        issuer: 'Susan AI Training Academy',
        validFor: '2 years',
        renewalRequired: true,
        industryRecognition: true
      },
      benefits: [
        'Professional credential',
        'Industry recognition',
        'Career advancement',
        'Continued education credits'
      ]
    };
  }

  async checkModulePrerequisites(userId, module) {
    const prerequisites = module.prerequisites || [];
    if (prerequisites.length === 0) return true;

    const userProgress = await this.getUserProgress(userId);
    
    for (const prereq of prerequisites) {
      const prereqModule = this.trainingModules.get(prereq);
      if (!prereqModule) continue;

      const prereqProgress = userProgress.modules[prereq];
      if (!prereqProgress || prereqProgress.status !== 'completed') {
        throw new ApiError(400, `Prerequisite not met: ${prereqModule.name}`);
      }
    }

    return true;
  }

  async generateSusanFeedback(userId, module, lesson, lessonData) {
    return await this.susanFeedbackEngine.generateFeedback(userId, {
      module,
      lesson,
      type: 'lesson_completion'
    }, lessonData);
  }

  getNextLesson(module, currentLessonId) {
    const lessons = module.content.lessons;
    const currentIndex = lessons.findIndex(lesson => lesson.id === currentLessonId);
    
    if (currentIndex >= 0 && currentIndex < lessons.length - 1) {
      return lessons[currentIndex + 1];
    }
    
    return null;
  }

  async gradeAssessment(assessment, answers) {
    let score = 0;
    let maxScore = 0;
    const feedback = [];
    const corrections = [];

    for (const question of assessment.questions) {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correctAnswer;
      
      maxScore += question.points;
      if (isCorrect) {
        score += question.points;
      } else {
        corrections.push({
          questionId: question.id,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation
        });
      }
    }

    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const passed = percentage >= assessment.passingScore;

    return {
      score,
      maxScore,
      percentage,
      passed,
      feedback,
      corrections,
      timeSpent: 0 // Would be calculated from actual timing data
    };
  }

  async generateAssessmentFeedback(userId, module, assessment, result) {
    return await this.susanFeedbackEngine.generateFeedback(userId, {
      module,
      assessment,
      type: 'assessment_completion'
    }, result);
  }

  async checkCertificationEligibility(userId, module) {
    const userProgress = await this.getUserProgress(userId);
    const moduleProgress = userProgress.modules[`${module.categoryId}_${module.id}`];
    
    if (!moduleProgress) return false;

    const requirements = module.certification.requirements;
    return moduleProgress.status === 'completed' && 
           moduleProgress.score >= requirements.passing_score;
  }

  async generateCompletionCertificate(userId, module) {
    const certificate = {
      id: `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      moduleId: `${module.categoryId}_${module.id}`,
      moduleName: module.name,
      categoryName: module.categoryName,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000), // 2 years
      issuer: 'Susan AI Training Academy',
      verified: true
    };

    // Save certificate
    const certFile = path.join(this.certificationsDir, `${certificate.id}.json`);
    await fs.writeJson(certFile, certificate, { spaces: 2 });

    return certificate;
  }

  async generatePostAssessmentRecommendations(userId, module, result) {
    const recommendations = [];

    if (result.percentage < 70) {
      recommendations.push({
        type: 'remedial',
        title: 'Review Key Concepts',
        description: 'Focus on areas where you scored below 70%',
        priority: 'high'
      });
    }

    if (result.percentage >= 85) {
      recommendations.push({
        type: 'advancement',
        title: 'Advanced Training',
        description: 'You\'re ready for advanced topics in this area',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  async loadMultimediaUrls(multimedia) {
    // In a real implementation, this would resolve actual file URLs
    return multimedia;
  }

  async generatePersonalizedRecommendations(userId, module) {
    const userProgress = await this.getUserProgress(userId);
    
    return [
      {
        type: 'study_tip',
        title: 'Recommended Study Approach',
        description: 'Based on your learning style, focus on visual materials first'
      },
      {
        type: 'time_management',
        title: 'Optimal Schedule',
        description: 'Complete this module in 2-3 sessions for best retention'
      }
    ];
  }

  calculateAverageScore(userProgress) {
    const modules = Object.values(userProgress.modules);
    const completedModules = modules.filter(m => m.status === 'completed' && m.score);
    
    if (completedModules.length === 0) return 0;
    
    const totalScore = completedModules.reduce((sum, m) => sum + m.score, 0);
    return totalScore / completedModules.length;
  }

  calculateCategoryProgress(userProgress) {
    const categoryProgress = {};
    
    for (const [categoryId, category] of Object.entries(this.trainingCategories)) {
      const categoryModules = category.modules.map(moduleId => 
        userProgress.modules[`${categoryId}_${moduleId}`]
      ).filter(Boolean);
      
      const completed = categoryModules.filter(m => m.status === 'completed').length;
      const total = category.modules.length;
      
      categoryProgress[categoryId] = {
        name: category.name,
        completed,
        total,
        percentage: total > 0 ? (completed / total) * 100 : 0
      };
    }
    
    return categoryProgress;
  }

  async getRecentActivity(userId, timeframe) {
    // Implementation would fetch recent training activities
    return [];
  }

  async generateProgressRecommendations(userId, userProgress) {
    return [
      {
        type: 'next_module',
        title: 'Continue Learning',
        description: 'Based on your progress, we recommend starting the Advanced Inspection module'
      }
    ];
  }

  async generateCompetencyMap(userId, userProgress) {
    const competencyMap = {};
    
    for (const [categoryId, category] of Object.entries(this.trainingCategories)) {
      const categoryModules = category.modules.map(moduleId => 
        userProgress.modules[`${categoryId}_${moduleId}`]
      ).filter(Boolean);
      
      const avgScore = categoryModules.length > 0 
        ? categoryModules.reduce((sum, m) => sum + (m.score || 0), 0) / categoryModules.length
        : 0;
      
      competencyMap[categoryId] = {
        name: category.name,
        level: Math.min(Math.floor(avgScore / 20) + 1, 5), // 1-5 scale
        score: avgScore
      };
    }
    
    return competencyMap;
  }

  async generateOptimalLearningPath(userId, userProgress) {
    const path = [];
    
    // Analyze user's current progress and recommend next steps
    for (const [categoryId, category] of Object.entries(this.trainingCategories)) {
      const categoryProgress = this.calculateCategoryProgress(userProgress)[categoryId];
      
      if (categoryProgress.percentage < 100) {
        const nextModule = category.modules.find(moduleId => {
          const moduleKey = `${categoryId}_${moduleId}`;
          return !userProgress.modules[moduleKey] || 
                 userProgress.modules[moduleKey].status === 'not_started';
        });
        
        if (nextModule) {
          path.push({
            categoryId,
            moduleId: nextModule,
            priority: category.weight,
            reason: `Continue progress in ${category.name}`
          });
        }
      }
    }
    
    // Sort by priority (category weight)
    return path.sort((a, b) => b.priority - a.priority);
  }

  async getUserAssessmentResults(userId) {
    // Implementation would fetch assessment results from storage
    return [];
  }

  async generateAnalysisSteps(photoData, analysisType) {
    // Generate step-by-step photo analysis tutorial
    return [
      {
        step: 1,
        title: 'Initial Visual Assessment',
        description: 'Examine the overall condition and identify obvious damage',
        action: 'Look for visible damage indicators',
        expectedFindings: ['Missing shingles', 'Discoloration', 'Debris']
      },
      {
        step: 2,
        title: 'Detailed Inspection',
        description: 'Focus on specific areas and measure damage extent',
        action: 'Use measurement tools to quantify damage',
        expectedFindings: ['Damage area measurements', 'Material type identification']
      }
    ];
  }

  async generateInteractiveHotspots(photoData, analysisSteps) {
    return [
      {
        id: 'hotspot1',
        x: 100,
        y: 200,
        title: 'Potential Damage Area',
        description: 'Click to learn about this damage type',
        relatedStep: 1
      }
    ];
  }

  async generateSusanAnalysisInsights(photoData, analysisType) {
    return [
      {
        type: 'tip',
        content: 'Susan AI Tip: Look for water staining patterns to identify leak sources'
      },
      {
        type: 'warning',
        content: 'Safety Alert: This area may require ladder inspection - ensure proper safety protocols'
      }
    ];
  }

  async analyzeUserPerformance(userId, userProgress, assessmentResults) {
    return {
      strengths: ['Technical accuracy', 'Attention to detail'],
      weaknesses: ['Communication', 'Time management'],
      trends: ['Improving steadily', 'Consistent performance'],
      overall: 'Strong performer with room for growth in soft skills'
    };
  }

  async generateImmediateRecommendations(performanceAnalysis, context) {
    return [
      {
        title: 'Focus on Communication Skills',
        description: 'Complete the Professional Communication module',
        urgency: 'high',
        estimatedTime: '2 hours'
      }
    ];
  }

  async generateShortTermRecommendations(performanceAnalysis, context) {
    return [
      {
        title: 'Advanced Damage Assessment',
        description: 'Build expertise in complex damage scenarios',
        timeframe: '2-4 weeks',
        priority: 'medium'
      }
    ];
  }

  async generateLongTermRecommendations(performanceAnalysis, context) {
    return [
      {
        title: 'Leadership Development',
        description: 'Prepare for team leadership roles',
        timeframe: '6-12 months',
        priority: 'low'
      }
    ];
  }

  async identifySkillGaps(performanceAnalysis) {
    return [
      {
        skill: 'Insurance Negotiation',
        currentLevel: 2,
        targetLevel: 4,
        gap: 2,
        priority: 'high'
      }
    ];
  }

  async identifyStrengths(performanceAnalysis) {
    return [
      {
        skill: 'Technical Inspection',
        level: 4,
        description: 'Excellent technical inspection skills',
        leverage: 'Mentor others in technical aspects'
      }
    ];
  }
}

/**
 * Susan AI Feedback Engine for providing intelligent training feedback
 */
class SusanFeedbackEngine {
  constructor() {
    this.aiService = null;
    this.feedbackTemplates = new Map();
    this.feedbackHistory = new Map();
  }

  setAIService(aiService) {
    this.aiService = aiService;
  }

  async generateFeedback(userId, context, userResponse) {
    if (!this.aiService) {
      return this.generateStaticFeedback(context, userResponse);
    }

    try {
      const feedbackPrompt = this.buildFeedbackPrompt(context, userResponse);
      const feedback = await this.aiService.generateResponse(feedbackPrompt, {
        temperature: 0.7,
        maxTokens: 500,
        systemPrompt: 'You are Susan AI, an expert roofing and insurance training assistant. Provide constructive, encouraging, and actionable feedback to help users improve their skills.'
      });

      return {
        type: 'ai_generated',
        content: feedback.content,
        encouragement: this.generateEncouragement(userResponse),
        suggestions: await this.generateSuggestions(context, userResponse),
        nextSteps: await this.generateNextSteps(context, userResponse),
        confidence: feedback.confidence || 0.8,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to generate AI feedback', { userId, error: error.message });
      return this.generateStaticFeedback(context, userResponse);
    }
  }

  generateStaticFeedback(context, userResponse) {
    return {
      type: 'template',
      content: 'Great work on completing this lesson! Continue practicing to improve your skills.',
      encouragement: 'You\'re making excellent progress in your training journey.',
      suggestions: ['Review the key concepts', 'Practice with additional examples'],
      nextSteps: ['Move to the next lesson', 'Complete the module assessment'],
      confidence: 0.7,
      generatedAt: new Date()
    };
  }

  buildFeedbackPrompt(context, userResponse) {
    return `
As Susan AI, provide personalized feedback for a roofing professional's training response.

Context: ${JSON.stringify(context, null, 2)}
User Response: ${JSON.stringify(userResponse, null, 2)}

Please provide:
1. Specific feedback on their response
2. What they did well
3. Areas for improvement
4. Actionable next steps
5. Encouragement to continue learning

Keep the tone professional, supportive, and educational.
    `.trim();
  }

  generateEncouragement(userResponse) {
    const encouragements = [
      'Excellent effort! Your dedication to learning is evident.',
      'Great job! You\'re developing strong professional skills.',
      'Well done! Your progress is impressive.',
      'Fantastic work! Keep up the momentum.',
      'Outstanding! You\'re becoming a true expert.'
    ];

    return encouragements[Math.floor(Math.random() * encouragements.length)];
  }

  async generateSuggestions(context, userResponse) {
    // Generate contextual suggestions based on performance
    return [
      'Consider reviewing the key concepts from this lesson',
      'Practice with additional real-world scenarios',
      'Connect with peers to discuss different approaches'
    ];
  }

  async generateNextSteps(context, userResponse) {
    // Generate personalized next steps
    return [
      'Complete the lesson quiz to reinforce learning',
      'Move to the next lesson in the sequence',
      'Apply these concepts in a practical exercise'
    ];
  }
}

export default InteractiveTrainingService;