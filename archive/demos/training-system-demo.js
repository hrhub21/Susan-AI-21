#!/usr/bin/env node

/**
 * Susan AI Training & Performance Coaching System Demo
 * 
 * This demo showcases the comprehensive Interactive Training Modules and
 * Performance Coaching systems integrated with Susan AI's intelligence.
 * 
 * Features demonstrated:
 * - Interactive training modules with AI feedback
 * - Performance assessments and coaching
 * - Gamification and achievement system
 * - Industry benchmarking and analytics
 * - Personalized learning paths
 * - Enterprise training management
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { InteractiveTrainingService } from './src/api/services/InteractiveTrainingService.js';
import { PerformanceCoachingService } from './src/api/services/PerformanceCoachingService.js';
import { TrainingIntegrationService } from './src/api/services/TrainingIntegrationService.js';
import { AIService } from './src/api/services/AIService.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TrainingSystemDemo {
  constructor() {
    this.initializeServices();
    this.demoUsers = [
      { id: 'user_001', name: 'John Smith', role: 'inspector', experience: 'beginner' },
      { id: 'user_002', name: 'Sarah Johnson', role: 'adjuster', experience: 'intermediate' },
      { id: 'user_003', name: 'Mike Davis', role: 'manager', experience: 'expert' }
    ];
  }

  async initializeServices() {
    console.log(chalk.blue('🚀 Initializing Susan AI Training & Coaching System...\n'));

    // Initialize core services
    this.aiService = new AIService();
    this.trainingService = new InteractiveTrainingService();
    this.coachingService = new PerformanceCoachingService();
    this.integrationService = new TrainingIntegrationService();

    // Connect AI service to training and coaching
    this.trainingService.setAIService(this.aiService);
    this.coachingService.setAIService(this.aiService);

    // Set up service integration
    this.integrationService.initializeServices({
      trainingService: this.trainingService,
      coachingService: this.coachingService,
      aiService: this.aiService
    });

    console.log(chalk.green('✅ All services initialized successfully!\n'));
  }

  async runFullDemo() {
    try {
      await this.showWelcome();
      await this.demoTrainingModules();
      await this.demoPerformanceAssessment();
      await this.demoPersonalizedCoaching();
      await this.demoPhotoAnalysisTraining();
      await this.demoGameficationSystem();
      await this.demoEnterpriseFeatures();
      await this.demoAnalyticsAndReporting();
      await this.showConclusion();
    } catch (error) {
      console.error(chalk.red('❌ Demo error:'), error.message);
    }
  }

  async showWelcome() {
    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║              SUSAN AI TRAINING & COACHING SYSTEM              ║'));
    console.log(chalk.cyan('║                    Comprehensive Demo                         ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.yellow('📚 Features Overview:'));
    console.log('• Interactive Training Modules with AI Feedback');
    console.log('• Performance Assessments & Personalized Coaching');
    console.log('• Gamification with Badges & Achievements');
    console.log('• Industry Benchmarking & Analytics');
    console.log('• Photo Analysis Training with Susan AI');
    console.log('• Enterprise Learning Management');
    console.log('• Real-time Progress Tracking\n');

    await this.pause();
  }

  async demoTrainingModules() {
    console.log(chalk.blue('🎓 INTERACTIVE TRAINING MODULES DEMO\n'));

    // Get available training modules
    const modules = await this.trainingService.getTrainingModules({
      includeProgress: false
    });

    console.log(chalk.green(`📋 Available Training Categories: ${Object.keys(modules.categories).length}`));
    console.log(chalk.green(`📖 Total Training Modules: ${modules.totalModules}\n`));

    // Show training categories
    for (const [categoryId, category] of Object.entries(modules.categories)) {
      console.log(chalk.cyan(`🏷️  ${category.name}`));
      console.log(`   📝 ${category.description}`);
      console.log(`   📚 Modules: ${category.modules.length}`);
      console.log(`   🎨 Color: ${category.color}\n`);
    }

    // Demo starting a training module
    const demoUser = this.demoUsers[0];
    console.log(chalk.yellow(`👤 Demo User: ${demoUser.name} (${demoUser.role})\n`));

    console.log(chalk.blue('🚀 Starting Roofing Inspection Training Module...\n'));

    const moduleStart = await this.trainingService.startTrainingModule(
      demoUser.id, 
      'roofing_inspection', 
      'basic_inspection_techniques'
    );

    console.log(chalk.green('✅ Module Started Successfully!'));
    console.log(`📊 Progress: ${moduleStart.progress.progress}%`);
    console.log(`📝 Status: ${moduleStart.progress.status}`);
    console.log(`⏰ Started At: ${moduleStart.progress.startedAt}\n`);

    // Demo completing a lesson
    console.log(chalk.blue('📚 Completing First Lesson...\n'));

    const lessonCompletion = await this.trainingService.completeLesson(
      demoUser.id,
      'roofing_inspection',
      'basic_inspection_techniques',
      'lesson_1',
      { timeSpent: 1200, interaction_quality: 'high' }
    );

    console.log(chalk.green('✅ Lesson Completed!'));
    console.log(`📊 Module Progress: ${lessonCompletion.moduleProgress}%`);
    console.log(`🤖 Susan AI Feedback: ${lessonCompletion.susanFeedback.content}`);

    if (lessonCompletion.nextLesson) {
      console.log(`➡️  Next Lesson: ${lessonCompletion.nextLesson.title}\n`);
    }

    await this.pause();
  }

  async demoPerformanceAssessment() {
    console.log(chalk.blue('📊 PERFORMANCE ASSESSMENT & COACHING DEMO\n'));

    const demoUser = this.demoUsers[1]; // Sarah Johnson (adjuster)
    console.log(chalk.yellow(`👤 Demo User: ${demoUser.name} (${demoUser.role})\n`));

    // Start comprehensive assessment
    console.log(chalk.blue('🧭 Starting Comprehensive Skill Assessment...\n'));

    const assessment = await this.coachingService.conductSkillAssessment(
      demoUser.id,
      'comprehensive',
      { role: demoUser.role, experience: demoUser.experience }
    );

    console.log(chalk.green('✅ Assessment Framework Generated!'));
    console.log(`📋 Assessment ID: ${assessment.assessmentId}`);
    console.log(`⏱️  Estimated Duration: ${assessment.estimatedDuration} minutes`);
    console.log(`📝 Total Questions: ${assessment.framework.totalQuestions}\n`);

    // Show assessment sections
    console.log(chalk.cyan('📚 Assessment Sections:'));
    for (const section of assessment.framework.sections) {
      console.log(`   🏷️  ${section.name} (Weight: ${section.weight})`);
      console.log(`   ❓ Questions: ${section.questions.length}`);
      console.log(`   ⏰ Time Limit: ${section.timeLimit} minutes\n`);
    }

    // Simulate assessment responses
    console.log(chalk.blue('✍️  Simulating Assessment Responses...\n'));

    const sampleResponses = this.generateSampleAssessmentResponses(assessment.framework);
    
    const assessmentResult = await this.coachingService.submitAssessmentResponses(
      assessment.assessmentId,
      sampleResponses
    );

    console.log(chalk.green('✅ Assessment Completed!'));
    console.log(`📊 Overall Score: ${assessmentResult.results.overall.percentage.toFixed(1)}%`);
    console.log(`🎯 Competency Level: ${this.getLevelName(assessmentResult.competencyProfile.overall.level)}`);
    console.log(`💪 Strengths: ${assessmentResult.results.strengths.length}`);
    console.log(`📈 Improvement Areas: ${assessmentResult.results.weaknesses.length}\n`);

    // Show competency breakdown
    console.log(chalk.cyan('🎯 Competency Profile:'));
    for (const [categoryId, category] of Object.entries(assessmentResult.competencyProfile.categories)) {
      const statusIcon = category.score >= 75 ? '🟢' : category.score >= 60 ? '🟡' : '🔴';
      console.log(`   ${statusIcon} ${category.name}: ${category.score.toFixed(1)}% (Level ${category.level})`);
    }
    console.log();

    await this.pause();
  }

  async demoPersonalizedCoaching() {
    console.log(chalk.blue('🎯 PERSONALIZED COACHING DEMO\n'));

    const demoUser = this.demoUsers[1];

    // Get personalized coaching
    console.log(chalk.blue('🤖 Generating AI-Powered Coaching Recommendations...\n'));

    const coaching = await this.coachingService.getPersonalizedCoaching(demoUser.id, 'overall');

    console.log(chalk.green('✅ Personalized Coaching Generated!'));
    console.log(`🤖 Type: ${coaching.type}`);
    console.log(`🎯 Confidence: ${(coaching.confidence * 100).toFixed(1)}%\n`);

    console.log(chalk.cyan('📋 Recommendations:'));
    for (const rec of coaching.recommendations) {
      console.log(`   • ${rec}`);
    }
    console.log();

    console.log(chalk.cyan('📅 Action Plan:'));
    for (const action of coaching.actionPlan) {
      console.log(`   ✅ ${action}`);
    }
    console.log();

    console.log(chalk.cyan('💡 Motivation:'));
    console.log(`   "${coaching.motivation}"\n`);

    // Demo setting a performance goal
    console.log(chalk.blue('🎯 Setting Performance Goal...\n'));

    const goalData = {
      title: 'Improve Communication Skills',
      description: 'Enhance client interaction and adjuster communication abilities',
      category: 'communication_skills',
      targetValue: 85,
      currentValue: 65,
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      priority: 'high',
      milestones: [
        { title: 'Complete Communication Basics', targetValue: 70 },
        { title: 'Practice Client Scenarios', targetValue: 80 },
        { title: 'Master Difficult Conversations', targetValue: 85 }
      ]
    };

    const goalResult = await this.coachingService.setPerformanceGoal(demoUser.id, goalData);

    console.log(chalk.green('✅ Performance Goal Set!'));
    console.log(`🎯 Goal ID: ${goalResult.goalId}`);
    console.log(`📈 Target Improvement: ${goalData.targetValue - goalData.currentValue} points`);
    console.log(`📅 Deadline: ${goalData.deadline.toDateString()}`);
    console.log(`🏁 Milestones: ${goalData.milestones.length}\n`);

    await this.pause();
  }

  async demoPhotoAnalysisTraining() {
    console.log(chalk.blue('📸 PHOTO ANALYSIS TRAINING DEMO\n'));

    // Simulate photo data
    const samplePhotoData = {
      url: '/demo/roof-damage-sample.jpg',
      metadata: {
        property: 'Residential Home',
        roofType: 'Asphalt Shingles',
        weatherEvent: 'Hail Storm',
        dateInspected: new Date().toISOString()
      }
    };

    console.log(chalk.blue('🧠 Generating Interactive Photo Analysis Tutorial...\n'));

    const tutorial = await this.trainingService.generatePhotoAnalysisTutorial(
      samplePhotoData,
      'damage_assessment'
    );

    console.log(chalk.green('✅ Photo Analysis Tutorial Generated!'));
    console.log(`🔍 Tutorial ID: ${tutorial.id}`);
    console.log(`📋 Analysis Type: ${tutorial.analysisType}`);
    console.log(`📚 Analysis Steps: ${tutorial.steps.length}`);
    console.log(`🎯 Interactive Elements: ${tutorial.interactiveElements.length}\n`);

    console.log(chalk.cyan('📚 Analysis Steps:'));
    for (const step of tutorial.steps) {
      console.log(`   ${step.step}. ${step.title}`);
      console.log(`      📝 ${step.description}`);
      console.log(`      🎯 Action: ${step.action}`);
      console.log(`      🔍 Expected Findings: ${step.expectedFindings.join(', ')}\n`);
    }

    console.log(chalk.cyan('🤖 Susan AI Tips:'));
    for (const tip of tutorial.susanTips) {
      const icon = tip.type === 'tip' ? '💡' : tip.type === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`   ${icon} ${tip.content}`);
    }
    console.log();

    await this.pause();
  }

  async demoGameficationSystem() {
    console.log(chalk.blue('🏆 GAMIFICATION & ACHIEVEMENTS DEMO\n'));

    const demoUser = this.demoUsers[2]; // Mike Davis (manager)

    // Award achievement points for various actions
    console.log(chalk.blue('🎉 Simulating Achievement Activities...\n'));

    const achievements = [
      { action: 'assessment_completed', context: { score: 92 } },
      { action: 'module_completed', context: { category: 'communication_skills' } },
      { action: 'goal_completed', context: { difficulty: 'high' } },
      { action: 'mentor_activity', context: { helpedUsers: 3 } }
    ];

    let totalPoints = 0;
    for (const achievement of achievements) {
      const result = await this.coachingService.awardAchievementPoints(
        demoUser.id,
        achievement.action,
        achievement.context
      );

      console.log(chalk.green(`✅ Achievement: ${achievement.action}`));
      console.log(`   🎯 Points Awarded: ${result.pointsAwarded}`);
      console.log(`   📊 Total Points: ${result.totalPoints}`);
      console.log(`   📈 Current Level: ${result.currentLevel}`);
      
      if (result.leveledUp) {
        console.log(chalk.yellow(`   🎉 LEVEL UP! Welcome to Level ${result.currentLevel}!`));
      }
      
      if (result.newBadges.length > 0) {
        console.log(chalk.magenta(`   🏅 New Badges Earned: ${result.newBadges.length}`));
        for (const badge of result.newBadges) {
          console.log(`      🏆 ${badge.name}: ${badge.description}`);
        }
      }
      
      console.log();
      totalPoints = result.totalPoints;
    }

    // Show level progression
    const nextLevelPoints = Math.pow(result.currentLevel, 2) * 1000;
    const progressToNext = ((totalPoints % 1000) / 1000) * 100;

    console.log(chalk.cyan('📊 Gamification Summary:'));
    console.log(`   🎖️  Current Level: ${result.currentLevel}`);
    console.log(`   ⭐ Total Experience Points: ${totalPoints}`);
    console.log(`   📈 Progress to Next Level: ${progressToNext.toFixed(1)}%`);
    console.log(`   🎯 Points Needed: ${nextLevelPoints - (totalPoints % 1000)}\n`);

    await this.pause();
  }

  async demoEnterpriseFeatures() {
    console.log(chalk.blue('🏢 ENTERPRISE TRAINING MANAGEMENT DEMO\n'));

    const organizationId = 'org_roofing_pros_001';

    // Create enterprise training initiative
    console.log(chalk.blue('🚀 Creating Enterprise Training Initiative...\n'));

    const initiativeData = {
      title: 'Q4 Insurance Process Mastery',
      description: 'Company-wide initiative to improve insurance claim processing skills',
      targetRoles: ['adjuster', 'inspector'],
      requiredModules: [
        'insurance_process.claim_initiation',
        'insurance_process.documentation_requirements',
        'damage_assessment.damage_classification'
      ],
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      priority: 'high'
    };

    const initiative = await this.integrationService.manageEnterpriseTrainingInitiative(
      organizationId,
      initiativeData
    );

    console.log(chalk.green('✅ Enterprise Initiative Created!'));
    console.log(`🏢 Initiative ID: ${initiative.id}`);
    console.log(`📋 Title: ${initiative.title}`);
    console.log(`👥 Target Roles: ${initiative.targetRoles.join(', ')}`);
    console.log(`📚 Required Modules: ${initiative.requiredModules.length}`);
    console.log(`👤 Enrolled Participants: ${initiative.participants.length}`);
    console.log(`📅 Deadline: ${initiative.deadline.toDateString()}\n`);

    // Generate organization training report
    console.log(chalk.blue('📊 Generating Organization Training Report...\n'));

    const report = await this.integrationService.generateOrganizationTrainingReport(
      organizationId,
      { 
        timeframe: '30d',
        includeIndividualProgress: true,
        includeROIAnalysis: true 
      }
    );

    console.log(chalk.green('✅ Organization Report Generated!'));
    console.log(chalk.cyan('📊 Training Summary:'));
    console.log(`   👥 Total Users: ${report.summary.totalUsers}`);
    console.log(`   🎓 Active Trainees: ${report.summary.activeTrainees}`);
    console.log(`   ✅ Completed Modules: ${report.summary.completedModules}`);
    console.log(`   📈 Average Progress: ${report.summary.averageProgress.toFixed(1)} modules/user`);
    console.log(`   ⏰ Total Training Hours: ${report.summary.totalTrainingHours.toFixed(1)}`);
    console.log(`   🏆 Certifications Earned: ${report.summary.certificationCount}\n`);

    await this.pause();
  }

  async demoAnalyticsAndReporting() {
    console.log(chalk.blue('📈 ANALYTICS & BENCHMARKING DEMO\n'));

    const demoUser = this.demoUsers[0];

    // Get comprehensive analytics
    console.log(chalk.blue('📊 Generating Comprehensive User Analytics...\n'));

    const analytics = await this.trainingService.getUserTrainingAnalytics(demoUser.id, '30d');

    console.log(chalk.green('✅ Analytics Generated!'));
    console.log(chalk.cyan('📊 Overview:'));
    console.log(`   🎓 Modules Started: ${analytics.overview.totalModulesStarted}`);
    console.log(`   ✅ Modules Completed: ${analytics.overview.totalModulesCompleted}`);
    console.log(`   📈 Completion Rate: ${analytics.overview.completionRate.toFixed(1)}%`);
    console.log(`   ⏰ Total Time Spent: ${(analytics.overview.totalTimeSpent / 60).toFixed(1)} hours`);
    console.log(`   🎯 Average Score: ${analytics.overview.averageScore.toFixed(1)}%`);
    console.log(`   📊 Current Level: ${analytics.overview.currentLevel}`);
    console.log(`   ⭐ Experience Points: ${analytics.overview.experiencePoints}\n`);

    // Show industry benchmark comparison
    console.log(chalk.blue('🏆 Industry Benchmark Comparison...\n'));

    const benchmarkComparison = await this.coachingService.compareWithIndustryBenchmarks(demoUser.id);

    console.log(chalk.green('✅ Benchmark Analysis Complete!'));
    console.log(chalk.cyan('🎯 Overall Performance:'));
    console.log(`   📊 User Score: ${benchmarkComparison.overall.userScore.toFixed(1)}%`);
    console.log(`   📈 Industry Average: ${benchmarkComparison.overall.industryAverage}%`);
    console.log(`   🏆 Top 10% Benchmark: ${benchmarkComparison.overall.industryTop10}%`);
    console.log(`   📊 Percentile Ranking: ${benchmarkComparison.overall.percentile.toFixed(1)}%\n`);

    // Show category performance
    console.log(chalk.cyan('📚 Category Performance:'));
    for (const [categoryId, category] of Object.entries(benchmarkComparison.categories)) {
      const statusIcon = category.status === 'above_average' ? '🟢' : '🔴';
      console.log(`   ${statusIcon} ${category.name}: ${category.userScore.toFixed(1)}% (${category.percentile.toFixed(1)}th percentile)`);
    }
    console.log();

    // Show improvement recommendations
    if (benchmarkComparison.gaps.length > 0) {
      console.log(chalk.cyan('🎯 Priority Improvement Areas:'));
      for (const gap of benchmarkComparison.gaps.slice(0, 3)) {
        console.log(`   📈 ${gap.category}: ${gap.gap.toFixed(1)} point gap (Priority: ${gap.priority.toFixed(1)})`);
      }
      console.log();
    }

    await this.pause();
  }

  async showConclusion() {
    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                        DEMO COMPLETE!                         ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.green('🎉 Susan AI Training & Coaching System Demo Completed!\n'));

    console.log(chalk.yellow('✨ Key Features Demonstrated:'));
    console.log('  ✅ Interactive Training Modules with Smart Content');
    console.log('  ✅ AI-Powered Performance Assessments');
    console.log('  ✅ Personalized Coaching Recommendations');
    console.log('  ✅ Photo Analysis Training with Susan AI');
    console.log('  ✅ Gamification with Achievements & Levels');
    console.log('  ✅ Enterprise Training Management');
    console.log('  ✅ Industry Benchmarking & Analytics');
    console.log('  ✅ Comprehensive Progress Tracking\n');

    console.log(chalk.blue('🚀 Ready for Production Deployment!'));
    console.log(chalk.blue('📚 Full API Documentation Available'));
    console.log(chalk.blue('🔧 Fully Integrated with Susan AI Platform\n'));

    console.log(chalk.cyan('🌟 Thank you for exploring Susan AI\'s Training & Coaching System!'));
  }

  // Helper methods

  generateSampleAssessmentResponses(framework) {
    const responses = {};
    
    for (const section of framework.sections) {
      for (const question of section.questions) {
        // Simulate realistic responses with some variation
        const isCorrect = Math.random() > 0.3; // 70% correct rate
        responses[question.id] = isCorrect ? question.correctAnswer : 
          (question.correctAnswer + 1) % question.options.length;
      }
    }
    
    return responses;
  }

  getLevelName(level) {
    const levelNames = {
      1: 'Novice',
      2: 'Developing',
      3: 'Proficient',
      4: 'Advanced',
      5: 'Expert'
    };
    return levelNames[level] || 'Unknown';
  }

  async pause() {
    console.log(chalk.gray('Press Enter to continue...'));
    return new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
  }
}

// Run the demo
async function main() {
  const demo = new TrainingSystemDemo();
  await demo.runFullDemo();
  process.exit(0);
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('❌ Unhandled error:'), error.message);
  process.exit(1);
});

// Start demo if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default TrainingSystemDemo;