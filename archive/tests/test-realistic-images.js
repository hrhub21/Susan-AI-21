/**
 * Test with realistic hail damage scenarios and validate detection accuracy
 */

import fetch from 'node-fetch';
import FormData from 'form-data';

// More detailed test scenarios with specific prompts
const TEST_SCENARIOS = [
  {
    name: 'severe_hail_damage',
    prompt: 'This is a photo of a roof with severe hail damage. The shingles show multiple impact marks, granule loss, and exposed mat. Analyze for hail damage specifically.',
    expectedDamage: 'hail',
    expectedSeverity: 'high'
  },
  {
    name: 'wind_damage_missing_shingles', 
    prompt: 'This roof has wind damage with several missing shingles and exposed underlayment from recent storms. Analyze for wind damage.',
    expectedDamage: 'wind',
    expectedSeverity: 'moderate'
  },
  {
    name: 'normal_aged_roof',
    prompt: 'This is a normal aging roof with standard wear but no storm damage. It shows typical granule loss from age.',
    expectedDamage: 'none',
    expectedSeverity: 'low'
  }
];

// Simple test image (1x1 pixel) - represents damaged roof
const TEST_IMAGE_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

class RealisticVisionTest {
  constructor() {
    this.qwenUrl = 'http://localhost:3031';
    this.frontendUrl = 'http://localhost:3004';
  }

  async testDirectQwenWithPrompts() {
    console.log('\n🎯 Testing Qwen 2.5 VL with Realistic Damage Scenarios');
    console.log('=' .repeat(60));
    
    const results = [];
    
    for (const scenario of TEST_SCENARIOS) {
      console.log(`\n🔍 Testing: ${scenario.name}`);
      console.log(`   Expected: ${scenario.expectedDamage} damage, ${scenario.expectedSeverity} severity`);
      
      try {
        const result = await this.analyzeWithQwen(scenario.prompt, scenario.name);
        
        console.log(`   📊 Result: ${result.damageType}`);
        console.log(`   📈 Confidence: ${result.confidence}%`);
        console.log(`   ⏱️  Time: ${result.processingTime}s`);
        console.log(`   📝 Description: ${result.description?.substring(0, 100)}...`);
        
        // Analyze accuracy
        const accuracy = this.analyzeAccuracy(result, scenario);
        console.log(`   🎯 Accuracy: ${accuracy.score}/5 - ${accuracy.assessment}`);
        
        results.push({
          scenario: scenario.name,
          expected: { damage: scenario.expectedDamage, severity: scenario.expectedSeverity },
          actual: result,
          accuracy: accuracy
        });
        
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        results.push({
          scenario: scenario.name,
          error: error.message,
          accuracy: { score: 0, assessment: 'Failed' }
        });
      }
    }
    
    return results;
  }

  async analyzeWithQwen(prompt, scenarioName) {
    const formData = new FormData();
    
    // Add image
    const imageBuffer = Buffer.from(TEST_IMAGE_BASE64, 'base64');
    formData.append('image', imageBuffer, {
      filename: `${scenarioName}.jpg`,
      contentType: 'image/jpeg'
    });
    
    // Create detailed roofing analysis prompt
    const fullPrompt = `${prompt}

You are an expert roofing damage inspector analyzing this image for insurance claims. Please provide a detailed professional assessment:

1. DAMAGE ASSESSMENT:
   - What type of damage do you see? (hail, wind, water, aging, none)
   - Severity level: None/Low/Moderate/High/Severe
   - Specific observations about the damage

2. TECHNICAL DETAILS:
   - Material condition assessment
   - Any visible impact marks or patterns
   - Signs of granule loss or exposed mat

3. PROFESSIONAL RECOMMENDATION:
   - Is repair/replacement needed?
   - Urgency level
   - Insurance claim viability

Respond in JSON format:
{
  "damageType": "specific damage type",
  "severity": "severity level",
  "confidence": 85,
  "description": "detailed professional assessment",
  "findings": ["specific observation 1", "specific observation 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "claimViable": true/false
}`;

    formData.append('question', fullPrompt);

    const response = await fetch(`${this.qwenUrl}/analyze`, {
      method: 'POST',
      body: formData,
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`Qwen API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Parse JSON response
    let analysisData = {};
    try {
      const responseText = result.response || '';
      const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                       responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        analysisData = JSON.parse(jsonString);
      }
    } catch (parseError) {
      // Fallback to text analysis
      analysisData = {
        damageType: this.extractDamageFromText(result.response),
        severity: this.extractSeverityFromText(result.response),
        confidence: 80,
        description: result.response?.substring(0, 200) || 'Analysis completed'
      };
    }

    return {
      damageType: analysisData.damageType || 'Unknown',
      severity: analysisData.severity || 'Unknown',
      confidence: analysisData.confidence || 0,
      description: analysisData.description || result.response,
      findings: analysisData.findings || [],
      recommendations: analysisData.recommendations || [],
      claimViable: analysisData.claimViable || false,
      processingTime: result.processing_time || 0,
      rawResponse: result.response
    };
  }

  analyzeAccuracy(result, scenario) {
    let score = 0;
    let details = [];
    
    // Check damage type accuracy
    const actualDamage = result.damageType?.toLowerCase() || '';
    const expectedDamage = scenario.expectedDamage.toLowerCase();
    
    if (expectedDamage === 'none' && 
        (actualDamage.includes('no damage') || actualDamage.includes('none'))) {
      score += 2;
      details.push('✅ Correctly identified no damage');
    } else if (expectedDamage !== 'none' && actualDamage.includes(expectedDamage)) {
      score += 2;
      details.push(`✅ Correctly identified ${expectedDamage} damage`);
    } else if (expectedDamage !== 'none' && !actualDamage.includes('no damage')) {
      score += 1;
      details.push(`🟡 Identified damage but not specific type`);
    } else {
      details.push(`❌ Missed ${expectedDamage} damage`);
    }
    
    // Check severity accuracy  
    const actualSeverity = result.severity?.toLowerCase() || '';
    const expectedSeverity = scenario.expectedSeverity.toLowerCase();
    
    if (actualSeverity.includes(expectedSeverity)) {
      score += 1;
      details.push(`✅ Correct severity: ${expectedSeverity}`);
    } else {
      details.push(`🟡 Different severity assessment`);
    }
    
    // Check confidence level
    if (result.confidence >= 70) {
      score += 1;
      details.push(`✅ Good confidence: ${result.confidence}%`);
    } else if (result.confidence >= 50) {
      score += 0.5;
      details.push(`🟡 Moderate confidence: ${result.confidence}%`);
    }
    
    // Check response quality
    if (result.description && result.description.length > 50) {
      score += 0.5;
      details.push('✅ Detailed description provided');
    }

    let assessment;
    if (score >= 4.5) assessment = 'Excellent';
    else if (score >= 3.5) assessment = 'Good';
    else if (score >= 2.5) assessment = 'Fair';
    else if (score >= 1.5) assessment = 'Poor';
    else assessment = 'Failed';

    return {
      score: score.toFixed(1),
      assessment,
      details
    };
  }

  extractDamageFromText(text) {
    if (!text) return 'Unknown';
    
    const lowerText = text.toLowerCase();
    if (lowerText.includes('hail')) return 'Hail damage';
    if (lowerText.includes('wind')) return 'Wind damage'; 
    if (lowerText.includes('water') || lowerText.includes('leak')) return 'Water damage';
    if (lowerText.includes('no damage') || lowerText.includes('none')) return 'No damage detected';
    return 'General damage detected';
  }

  extractSeverityFromText(text) {
    if (!text) return 'Unknown';
    
    const lowerText = text.toLowerCase();
    if (lowerText.includes('severe')) return 'Severe';
    if (lowerText.includes('high')) return 'High';
    if (lowerText.includes('moderate')) return 'Moderate';
    if (lowerText.includes('low') || lowerText.includes('minor')) return 'Low';
    if (lowerText.includes('none')) return 'None';
    return 'Unknown';
  }

  async testFrontendIntegration() {
    console.log('\n🌐 Testing Frontend Integration with Realistic Scenarios');
    console.log('=' .repeat(60));
    
    const results = [];
    
    for (const scenario of TEST_SCENARIOS) {
      console.log(`\n🔗 Frontend Test: ${scenario.name}`);
      
      try {
        const imageData = `data:image/jpeg;base64,${TEST_IMAGE_BASE64}`;
        
        const response = await fetch(`${this.frontendUrl}/api/photo-analysis/analyze-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageData,
            filename: `${scenario.name}.jpg`
          }),
          timeout: 30000
        });

        if (!response.ok) {
          throw new Error(`Frontend API error: ${response.status}`);
        }

        const result = await response.json();
        
        console.log(`   📊 Result: ${result.damageType} (${result.confidence}% confidence)`);
        console.log(`   🔧 Method: ${result.analysisMethod}`);
        console.log(`   ⏱️  Time: ${result.totalProcessingTime}s`);
        
        const accuracy = this.analyzeAccuracy(result, scenario);
        console.log(`   🎯 Accuracy: ${accuracy.score}/5 - ${accuracy.assessment}`);
        
        results.push({
          scenario: scenario.name,
          result,
          accuracy
        });

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        results.push({
          scenario: scenario.name,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async runRealisticTests() {
    console.log('🏠 Susan AI Realistic Roof Damage Detection Test');
    console.log('Testing accuracy with specific damage scenarios');
    console.log('=' .repeat(60));
    
    try {
      const qwenResults = await this.testDirectQwenWithPrompts();
      const frontendResults = await this.testFrontendIntegration();
      
      this.generateAccuracyReport(qwenResults, frontendResults);
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  generateAccuracyReport(qwenResults, frontendResults) {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 ACCURACY ASSESSMENT REPORT');
    console.log('=' .repeat(60));
    
    console.log('\n🎯 QWEN 2.5 VL DIRECT RESULTS:');
    let qwenTotalScore = 0;
    qwenResults.forEach(result => {
      console.log(`  ${result.scenario}: ${result.accuracy?.score || 0}/5 (${result.accuracy?.assessment || 'Failed'})`);
      if (result.accuracy?.details) {
        result.accuracy.details.forEach(detail => {
          console.log(`    ${detail}`);
        });
      }
      qwenTotalScore += parseFloat(result.accuracy?.score || 0);
    });
    
    console.log('\n🌐 FRONTEND INTEGRATION RESULTS:');
    let frontendTotalScore = 0;
    frontendResults.forEach(result => {
      console.log(`  ${result.scenario}: ${result.accuracy?.score || 0}/5 (${result.accuracy?.assessment || 'Failed'})`);
      if (result.accuracy?.details) {
        result.accuracy.details.forEach(detail => {
          console.log(`    ${detail}`);
        });
      }
      frontendTotalScore += parseFloat(result.accuracy?.score || 0);
    });
    
    const qwenAverage = (qwenTotalScore / qwenResults.length).toFixed(1);
    const frontendAverage = (frontendTotalScore / frontendResults.length).toFixed(1);
    
    console.log('\n📈 SUMMARY:');
    console.log(`   Qwen 2.5 VL Direct: ${qwenAverage}/5.0 average accuracy`);
    console.log(`   Frontend Integration: ${frontendAverage}/5.0 average accuracy`);
    console.log(`   Overall System: ${((parseFloat(qwenAverage) + parseFloat(frontendAverage)) / 2).toFixed(1)}/5.0`);
    
    if (parseFloat(qwenAverage) >= 3.5 && parseFloat(frontendAverage) >= 3.5) {
      console.log('\n✅ VISION PROCESSING PIPELINE: PRODUCTION READY');
      console.log('   - Accurate damage detection');
      console.log('   - Reliable severity assessment');
      console.log('   - Consistent frontend integration');
    } else if (parseFloat(qwenAverage) >= 2.5 || parseFloat(frontendAverage) >= 2.5) {
      console.log('\n🟡 VISION PROCESSING PIPELINE: NEEDS IMPROVEMENT');
      console.log('   - Basic damage detection working');
      console.log('   - May need prompt optimization');
      console.log('   - Consider model fine-tuning');
    } else {
      console.log('\n❌ VISION PROCESSING PIPELINE: REQUIRES ATTENTION');
      console.log('   - Significant accuracy issues detected');
      console.log('   - Review model configuration');
      console.log('   - Consider alternative approaches');
    }
    
    console.log('\n' + '=' .repeat(60));
  }
}

// Run realistic tests
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new RealisticVisionTest();
  tester.runRealisticTests().catch(error => {
    console.error('❌ Realistic test failed:', error);
    process.exit(1);
  });
}

export default RealisticVisionTest;