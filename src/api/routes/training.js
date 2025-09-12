import express from 'express';
import { InteractiveTrainingService } from '../services/InteractiveTrainingService.js';
import { PerformanceCoachingService } from '../services/PerformanceCoachingService.js';
import { AIService } from '../services/AIService.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

const router = express.Router();

// Initialize services
const trainingService = new InteractiveTrainingService();
const coachingService = new PerformanceCoachingService();
const aiService = new AIService();

// Set AI service for intelligent features
trainingService.setAIService(aiService);
coachingService.setAIService(aiService);

/**
 * @swagger
 * /api/training/modules:
 *   get:
 *     summary: Get all available training modules
 *     tags: [Training]
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, expert]
 *         description: Filter by difficulty level
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Include user progress
 *     responses:
 *       200:
 *         description: Training modules retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/modules', async (req, res, next) => {
  try {
    const { categoryId, difficulty, userId, includeProgress } = req.query;
    
    const filters = {
      categoryId,
      difficulty,
      userId,
      includeProgress: includeProgress === 'true'
    };

    const modules = await trainingService.getTrainingModules(filters);

    res.json({
      success: true,
      data: modules,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/modules/{categoryId}/{moduleId}:
 *   get:
 *     summary: Get specific training module with full content
 *     tags: [Training]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User ID for personalized content
 *     responses:
 *       200:
 *         description: Training module retrieved successfully
 *       404:
 *         description: Module not found
 */
router.get('/modules/:categoryId/:moduleId', async (req, res, next) => {
  try {
    const { categoryId, moduleId } = req.params;
    const { userId } = req.query;

    const module = await trainingService.getTrainingModule(categoryId, moduleId, userId);

    res.json({
      success: true,
      data: module,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/modules/{categoryId}/{moduleId}/start:
 *   post:
 *     summary: Start a training module
 *     tags: [Training]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Module started successfully
 *       400:
 *         description: Prerequisites not met or invalid request
 */
router.post('/modules/:categoryId/:moduleId/start', async (req, res, next) => {
  try {
    const { categoryId, moduleId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    const result = await trainingService.startTrainingModule(userId, categoryId, moduleId);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/modules/{categoryId}/{moduleId}/lessons/{lessonId}/complete:
 *   post:
 *     summary: Complete a lesson within a training module
 *     tags: [Training]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *               lessonData:
 *                 type: object
 *                 description: Additional lesson completion data
 *     responses:
 *       200:
 *         description: Lesson completed successfully
 *       400:
 *         description: Invalid request
 */
router.post('/modules/:categoryId/:moduleId/lessons/:lessonId/complete', async (req, res, next) => {
  try {
    const { categoryId, moduleId, lessonId } = req.params;
    const { userId, lessonData = {} } = req.body;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    const result = await trainingService.completeLesson(userId, categoryId, moduleId, lessonId, lessonData);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/modules/{categoryId}/{moduleId}/assessments/{assessmentId}/submit:
 *   post:
 *     summary: Submit assessment for a training module
 *     tags: [Training]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - answers
 *             properties:
 *               userId:
 *                 type: string
 *               answers:
 *                 type: object
 *                 description: Assessment answers
 *     responses:
 *       200:
 *         description: Assessment submitted successfully
 *       400:
 *         description: Invalid request
 */
router.post('/modules/:categoryId/:moduleId/assessments/:assessmentId/submit', async (req, res, next) => {
  try {
    const { categoryId, moduleId, assessmentId } = req.params;
    const { userId, answers } = req.body;

    if (!userId || !answers) {
      throw new ApiError(400, 'User ID and answers are required');
    }

    const result = await trainingService.submitAssessment(userId, categoryId, moduleId, assessmentId, answers);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/users/{userId}/progress:
 *   get:
 *     summary: Get user's training progress
 *     tags: [Training]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User progress retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/users/:userId/progress', async (req, res, next) => {
  try {
    const { userId } = req.params;

    const progress = await trainingService.getUserProgress(userId);

    res.json({
      success: true,
      data: progress,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/users/{userId}/analytics:
 *   get:
 *     summary: Get comprehensive training analytics for user
 *     tags: [Training]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           default: 30d
 *         description: Analytics timeframe
 *     responses:
 *       200:
 *         description: Training analytics retrieved successfully
 */
router.get('/users/:userId/analytics', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { timeframe = '30d' } = req.query;

    const analytics = await trainingService.getUserTrainingAnalytics(userId, timeframe);

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/users/{userId}/recommendations:
 *   get:
 *     summary: Get training recommendations based on user performance
 *     tags: [Training]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context:
 *                 type: object
 *                 description: Additional context for recommendations
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 */
router.get('/users/:userId/recommendations', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const context = req.body?.context || {};

    const recommendations = await trainingService.getTrainingRecommendations(userId, context);

    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/photo-analysis/tutorial:
 *   post:
 *     summary: Generate interactive photo analysis tutorial
 *     tags: [Training]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - photoData
 *             properties:
 *               photoData:
 *                 type: object
 *                 description: Photo data for analysis
 *               analysisType:
 *                 type: string
 *                 default: damage_assessment
 *                 description: Type of analysis to perform
 *     responses:
 *       200:
 *         description: Tutorial generated successfully
 *       400:
 *         description: Invalid photo data
 */
router.post('/photo-analysis/tutorial', async (req, res, next) => {
  try {
    const { photoData, analysisType = 'damage_assessment' } = req.body;

    if (!photoData) {
      throw new ApiError(400, 'Photo data is required');
    }

    const tutorial = await trainingService.generatePhotoAnalysisTutorial(photoData, analysisType);

    res.json({
      success: true,
      data: tutorial,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Performance Coaching Routes

/**
 * @swagger
 * /api/training/coaching/assessments:
 *   post:
 *     summary: Conduct comprehensive skill assessment
 *     tags: [Coaching]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *               assessmentType:
 *                 type: string
 *                 enum: [comprehensive, technical, communication, quick]
 *                 default: comprehensive
 *               context:
 *                 type: object
 *                 description: Additional assessment context
 *     responses:
 *       200:
 *         description: Assessment initiated successfully
 *       400:
 *         description: Invalid request
 */
router.post('/coaching/assessments', async (req, res, next) => {
  try {
    const { userId, assessmentType = 'comprehensive', context = {} } = req.body;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    const assessment = await coachingService.conductSkillAssessment(userId, assessmentType, context);

    res.json({
      success: true,
      data: assessment,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/coaching/assessments/{assessmentId}/submit:
 *   post:
 *     summary: Submit assessment responses
 *     tags: [Coaching]
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - responses
 *             properties:
 *               responses:
 *                 type: object
 *                 description: Assessment responses
 *     responses:
 *       200:
 *         description: Assessment completed successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Assessment not found
 */
router.post('/coaching/assessments/:assessmentId/submit', async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const { responses } = req.body;

    if (!responses) {
      throw new ApiError(400, 'Assessment responses are required');
    }

    const result = await coachingService.submitAssessmentResponses(assessmentId, responses);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/coaching/users/{userId}/coaching:
 *   get:
 *     summary: Get personalized coaching recommendations
 *     tags: [Coaching]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: focus
 *         schema:
 *           type: string
 *           default: overall
 *         description: Focus area for coaching
 *     responses:
 *       200:
 *         description: Coaching recommendations retrieved successfully
 *       404:
 *         description: No assessment found for user
 */
router.get('/coaching/users/:userId/coaching', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { focus = 'overall' } = req.query;

    const coaching = await coachingService.getPersonalizedCoaching(userId, focus);

    res.json({
      success: true,
      data: coaching,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/coaching/goals:
 *   post:
 *     summary: Set performance goal for user
 *     tags: [Coaching]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - title
 *               - targetValue
 *               - deadline
 *             properties:
 *               userId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               targetValue:
 *                 type: number
 *               currentValue:
 *                 type: number
 *                 default: 0
 *               deadline:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Goal set successfully
 *       400:
 *         description: Invalid goal data
 */
router.post('/coaching/goals', async (req, res, next) => {
  try {
    const goalData = req.body;

    const { userId, title, targetValue, deadline } = goalData;
    if (!userId || !title || !targetValue || !deadline) {
      throw new ApiError(400, 'Required fields: userId, title, targetValue, deadline');
    }

    const result = await coachingService.setPerformanceGoal(userId, goalData);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/coaching/goals/{goalId}/progress:
 *   put:
 *     summary: Update goal progress
 *     tags: [Coaching]
 *     parameters:
 *       - in: path
 *         name: goalId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *               currentValue:
 *                 type: number
 *               notes:
 *                 type: string
 *               milestoneCompleted:
 *                 type: string
 *     responses:
 *       200:
 *         description: Goal progress updated successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Goal not found
 */
router.put('/coaching/goals/:goalId/progress', async (req, res, next) => {
  try {
    const { goalId } = req.params;
    const { userId, ...progressData } = req.body;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    const result = await coachingService.updateGoalProgress(userId, goalId, progressData);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/coaching/users/{userId}/analytics:
 *   get:
 *     summary: Get comprehensive performance analytics
 *     tags: [Coaching]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           default: 30d
 *         description: Analytics timeframe
 *     responses:
 *       200:
 *         description: Performance analytics retrieved successfully
 */
router.get('/coaching/users/:userId/analytics', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { timeframe = '30d' } = req.query;

    const analytics = await coachingService.getPerformanceAnalytics(userId, timeframe);

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/coaching/users/{userId}/benchmarks:
 *   get:
 *     summary: Compare performance against industry benchmarks
 *     tags: [Coaching]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Specific category to compare
 *     responses:
 *       200:
 *         description: Benchmark comparison retrieved successfully
 */
router.get('/coaching/users/:userId/benchmarks', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { category } = req.query;

    const comparison = await coachingService.compareWithIndustryBenchmarks(userId, category);

    res.json({
      success: true,
      data: comparison,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/coaching/users/{userId}/achievements:
 *   post:
 *     summary: Award achievement points to user
 *     tags: [Coaching]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 description: Achievement action type
 *               context:
 *                 type: object
 *                 description: Additional context for achievement
 *     responses:
 *       200:
 *         description: Achievement points awarded successfully
 */
router.post('/coaching/users/:userId/achievements', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { action, context = {} } = req.body;

    if (!action) {
      throw new ApiError(400, 'Achievement action is required');
    }

    const result = await coachingService.awardAchievementPoints(userId, action, context);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/training/coaching/users/{userId}/learning-path:
 *   get:
 *     summary: Generate optimal learning path for user
 *     tags: [Coaching]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: currentLevel
 *         schema:
 *           type: integer
 *         description: User's current level
 *     responses:
 *       200:
 *         description: Learning path generated successfully
 */
router.get('/coaching/users/:userId/learning-path', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { currentLevel } = req.query;

    const learningPath = await coachingService.generateOptimalLearningPath(
      userId, 
      currentLevel ? parseInt(currentLevel) : null
    );

    res.json({
      success: true,
      data: learningPath,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('Training API error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    body: req.body
  });

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.statusCode
      },
      timestamp: new Date()
    });
  } else {
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 500
      },
      timestamp: new Date()
    });
  }
});

export default router;