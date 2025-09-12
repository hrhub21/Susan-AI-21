#!/usr/bin/env python3
"""
Susan AI Accuracy Validation System
Critical testing framework to validate hail damage detection accuracy against real data
Prevents false positives and ensures legitimate performance metrics
"""

import os
import sys
import json
import logging
import asyncio
import numpy as np
import torch
import torch.nn.functional as F
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Union
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_curve, auc,
    precision_recall_curve, average_precision_score
)
from sklearn.calibration import calibration_curve
from scipy import stats
import cv2
from PIL import Image
import pandas as pd
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Import Susan AI components
from susan_integration import SusanAIConnector
from damage_classifier import EnsembleDamageClassifier
from utils.hail_damage_specialist import HailDamageAnalyzer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AccuracyTestResult:
    """Container for accuracy test results."""
    
    def __init__(self):
        self.test_name = ""
        self.accuracy = 0.0
        self.precision = 0.0
        self.recall = 0.0
        self.f1_score = 0.0
        self.specificity = 0.0
        self.false_positive_rate = 0.0
        self.false_negative_rate = 0.0
        self.confusion_matrix = None
        self.classification_report = ""
        self.confidence_calibration = {}
        self.sample_size = 0
        self.test_timestamp = datetime.now().isoformat()
        self.details = {}


class SusanAccuracyValidator:
    """
    Comprehensive accuracy validation system for Susan AI hail damage detection.
    Tests against real ground truth data to ensure legitimate performance.
    """
    
    def __init__(self, dataset_path: str = None):
        """Initialize the accuracy validator."""
        self.dataset_path = dataset_path or "/Users/a21/Desktop/Susan-AI-Enhanced-JARVIS-Edition-Final/training/datasets/processed"
        
        # Initialize Susan AI components
        self.susan_connector = None
        self.damage_classifier = None
        self.hail_analyzer = None
        
        # Test data storage
        self.ground_truth_labels = {}
        self.susan_predictions = {}
        self.confidence_scores = {}
        
        # Results storage
        self.test_results = {}
        
        logger.info("Susan AI Accuracy Validator initialized")
    
    async def initialize_susan_ai(self):
        """Initialize Susan AI components for testing."""
        try:
            logger.info("Initializing Susan AI components...")
            
            # Initialize Susan AI connector
            self.susan_connector = SusanAIConnector()
            await self.susan_connector.initialize()
            
            # Initialize damage classifier
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            self.damage_classifier = EnsembleDamageClassifier(device=device)
            
            # Initialize hail analyzer
            self.hail_analyzer = HailDamageAnalyzer()
            
            logger.info("Susan AI components initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Susan AI initialization failed: {e}")
            return False
    
    def load_ground_truth_dataset(self):
        """Load the HuggingFace dataset with ground truth labels."""
        try:
            logger.info("Loading ground truth dataset...")
            
            # Load test split with ground truth labels
            test_data_path = Path(self.dataset_path) / "test_final.json"
            if test_data_path.exists():
                with open(test_data_path, 'r') as f:
                    test_data = json.load(f)
                
                # Extract ground truth labels
                for item in test_data:
                    image_id = item.get('id', item.get('image_path', ''))
                    label = item.get('label', item.get('damage_type', ''))
                    severity = item.get('severity', 'unknown')
                    
                    self.ground_truth_labels[image_id] = {
                        'damage_type': label,
                        'severity': severity,
                        'has_damage': label != 'no_damage'
                    }
                
                logger.info(f"Loaded {len(self.ground_truth_labels)} ground truth labels")
                return True
            else:
                logger.error(f"Test data file not found: {test_data_path}")
                return False
                
        except Exception as e:
            logger.error(f"Ground truth dataset loading failed: {e}")
            return False
    
    async def run_comprehensive_accuracy_tests(self) -> Dict[str, Any]:
        """Run comprehensive accuracy tests against real data."""
        try:
            logger.info("Starting comprehensive accuracy tests...")
            
            # Test 1: Overall Damage Detection Accuracy
            await self._test_overall_damage_detection()
            
            # Test 2: Hail vs Other Damage Type Classification
            await self._test_damage_type_specificity()
            
            # Test 3: Severity Assessment Accuracy
            await self._test_severity_assessment()
            
            # Test 4: Confidence Score Calibration
            await self._test_confidence_calibration()
            
            # Test 5: False Positive Prevention
            await self._test_false_positive_prevention()
            
            # Test 6: Edge Case Handling
            await self._test_edge_cases()
            
            # Generate comprehensive report
            report = self._generate_accuracy_report()
            
            logger.info("Comprehensive accuracy tests completed")
            return report
            
        except Exception as e:
            logger.error(f"Comprehensive accuracy tests failed: {e}")
            return {"error": str(e)}
    
    async def _test_overall_damage_detection(self):
        """Test overall damage vs no-damage detection accuracy."""
        logger.info("Testing overall damage detection accuracy...")
        
        try:
            true_labels = []
            predicted_labels = []
            confidence_scores = []
            
            for image_id, ground_truth in self.ground_truth_labels.items():
                try:
                    # Load image
                    image = await self._load_test_image(image_id)
                    if image is None:
                        continue
                    
                    # Get Susan AI prediction
                    prediction = await self._get_susan_prediction(image)
                    
                    # Extract binary classification (damage vs no damage)
                    true_has_damage = ground_truth['has_damage']
                    pred_has_damage = prediction.get('has_damage', False)
                    confidence = prediction.get('confidence', 0.0)
                    
                    true_labels.append(int(true_has_damage))
                    predicted_labels.append(int(pred_has_damage))
                    confidence_scores.append(confidence)
                    
                except Exception as e:
                    logger.warning(f"Failed to process image {image_id}: {e}")
                    continue
            
            # Calculate metrics
            if len(true_labels) > 0:
                result = AccuracyTestResult()
                result.test_name = "Overall Damage Detection"
                result.sample_size = len(true_labels)
                result.accuracy = accuracy_score(true_labels, predicted_labels)
                result.precision = precision_score(true_labels, predicted_labels, zero_division=0)
                result.recall = recall_score(true_labels, predicted_labels, zero_division=0)
                result.f1_score = f1_score(true_labels, predicted_labels, zero_division=0)
                result.confusion_matrix = confusion_matrix(true_labels, predicted_labels).tolist()
                result.classification_report = classification_report(true_labels, predicted_labels)
                
                # Calculate specificity and false positive rate
                tn, fp, fn, tp = confusion_matrix(true_labels, predicted_labels).ravel()
                result.specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
                result.false_positive_rate = fp / (fp + tn) if (fp + tn) > 0 else 0
                result.false_negative_rate = fn / (fn + tp) if (fn + tp) > 0 else 0
                
                # Store confidence scores for calibration analysis
                result.details = {
                    'confidence_scores': confidence_scores,
                    'true_labels': true_labels,
                    'predicted_labels': predicted_labels
                }
                
                self.test_results['overall_damage_detection'] = result
                logger.info(f"Overall damage detection - Accuracy: {result.accuracy:.3f}, F1: {result.f1_score:.3f}")
            
        except Exception as e:
            logger.error(f"Overall damage detection test failed: {e}")
    
    async def _test_damage_type_specificity(self):
        """Test ability to distinguish between hail, wind, wear, and other damage types."""
        logger.info("Testing damage type specificity...")
        
        try:
            true_labels = []
            predicted_labels = []
            damage_types = ['hail', 'wind', 'wear', 'impact', 'no_damage']
            
            for image_id, ground_truth in self.ground_truth_labels.items():
                try:
                    # Skip if no damage
                    if ground_truth['damage_type'] == 'no_damage':
                        continue
                    
                    # Load image
                    image = await self._load_test_image(image_id)
                    if image is None:
                        continue
                    
                    # Get Susan AI prediction
                    prediction = await self._get_susan_prediction(image)
                    
                    # Extract damage type classification
                    true_type = ground_truth['damage_type']
                    pred_type = prediction.get('damage_type', 'unknown')
                    
                    if true_type in damage_types and pred_type in damage_types:
                        true_labels.append(true_type)
                        predicted_labels.append(pred_type)
                
                except Exception as e:
                    logger.warning(f"Failed to process image {image_id}: {e}")
                    continue
            
            # Calculate multi-class metrics
            if len(true_labels) > 0:
                result = AccuracyTestResult()
                result.test_name = "Damage Type Specificity"
                result.sample_size = len(true_labels)
                result.accuracy = accuracy_score(true_labels, predicted_labels)
                result.precision = precision_score(true_labels, predicted_labels, average='weighted', zero_division=0)
                result.recall = recall_score(true_labels, predicted_labels, average='weighted', zero_division=0)
                result.f1_score = f1_score(true_labels, predicted_labels, average='weighted', zero_division=0)
                result.confusion_matrix = confusion_matrix(true_labels, predicted_labels, labels=damage_types).tolist()
                result.classification_report = classification_report(true_labels, predicted_labels, labels=damage_types)
                
                # Calculate hail-specific metrics
                hail_precision = precision_score(
                    [1 if label == 'hail' else 0 for label in true_labels],
                    [1 if label == 'hail' else 0 for label in predicted_labels],
                    zero_division=0
                )
                hail_recall = recall_score(
                    [1 if label == 'hail' else 0 for label in true_labels],
                    [1 if label == 'hail' else 0 for label in predicted_labels],
                    zero_division=0
                )
                
                result.details = {
                    'hail_precision': hail_precision,
                    'hail_recall': hail_recall,
                    'true_labels': true_labels,
                    'predicted_labels': predicted_labels,
                    'damage_types': damage_types
                }
                
                self.test_results['damage_type_specificity'] = result
                logger.info(f"Damage type specificity - Accuracy: {result.accuracy:.3f}, Hail Precision: {hail_precision:.3f}")
            
        except Exception as e:
            logger.error(f"Damage type specificity test failed: {e}")
    
    async def _test_severity_assessment(self):
        """Test severity assessment accuracy (light, moderate, severe)."""
        logger.info("Testing severity assessment accuracy...")
        
        try:
            true_severities = []
            predicted_severities = []
            severity_levels = ['light', 'moderate', 'severe']
            
            for image_id, ground_truth in self.ground_truth_labels.items():
                try:
                    # Skip if no damage
                    if ground_truth['damage_type'] == 'no_damage':
                        continue
                    
                    # Load image
                    image = await self._load_test_image(image_id)
                    if image is None:
                        continue
                    
                    # Get Susan AI prediction
                    prediction = await self._get_susan_prediction(image)
                    
                    # Extract severity assessment
                    true_severity = ground_truth.get('severity', 'unknown')
                    pred_severity = prediction.get('severity', 'unknown')
                    
                    if true_severity in severity_levels and pred_severity in severity_levels:
                        true_severities.append(true_severity)
                        predicted_severities.append(pred_severity)
                
                except Exception as e:
                    logger.warning(f"Failed to process image {image_id}: {e}")
                    continue
            
            # Calculate severity metrics
            if len(true_severities) > 0:
                result = AccuracyTestResult()
                result.test_name = "Severity Assessment"
                result.sample_size = len(true_severities)
                result.accuracy = accuracy_score(true_severities, predicted_severities)
                result.precision = precision_score(true_severities, predicted_severities, average='weighted', zero_division=0)
                result.recall = recall_score(true_severities, predicted_severities, average='weighted', zero_division=0)
                result.f1_score = f1_score(true_severities, predicted_severities, average='weighted', zero_division=0)
                result.confusion_matrix = confusion_matrix(true_severities, predicted_severities, labels=severity_levels).tolist()
                result.classification_report = classification_report(true_severities, predicted_severities, labels=severity_levels)
                
                self.test_results['severity_assessment'] = result
                logger.info(f"Severity assessment - Accuracy: {result.accuracy:.3f}, F1: {result.f1_score:.3f}")
            
        except Exception as e:
            logger.error(f"Severity assessment test failed: {e}")
    
    async def _test_confidence_calibration(self):
        """Test if confidence scores are properly calibrated (85% confidence = 85% accuracy)."""
        logger.info("Testing confidence score calibration...")
        
        try:
            # Get confidence scores and accuracies from overall damage detection
            if 'overall_damage_detection' in self.test_results:
                result_data = self.test_results['overall_damage_detection'].details
                confidence_scores = result_data['confidence_scores']
                true_labels = result_data['true_labels']
                predicted_labels = result_data['predicted_labels']
                
                # Convert to numpy arrays
                confidences = np.array(confidence_scores)
                correct_predictions = np.array(true_labels) == np.array(predicted_labels)
                
                # Calculate calibration curve
                fraction_of_positives, mean_predicted_value = calibration_curve(
                    correct_predictions, confidences, n_bins=10
                )
                
                # Calculate Expected Calibration Error (ECE)
                bin_boundaries = np.linspace(0, 1, 11)
                bin_lowers = bin_boundaries[:-1]
                bin_uppers = bin_boundaries[1:]
                
                ece = 0
                for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
                    in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
                    prop_in_bin = in_bin.mean()
                    
                    if prop_in_bin > 0:
                        accuracy_in_bin = correct_predictions[in_bin].mean()
                        avg_confidence_in_bin = confidences[in_bin].mean()
                        ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
                
                # Test specific confidence thresholds
                threshold_tests = {}
                for threshold in [0.7, 0.8, 0.85, 0.9, 0.95]:
                    high_conf_mask = confidences >= threshold
                    if high_conf_mask.sum() > 0:
                        actual_accuracy = correct_predictions[high_conf_mask].mean()
                        threshold_tests[f"threshold_{threshold}"] = {
                            'expected_accuracy': threshold,
                            'actual_accuracy': actual_accuracy,
                            'sample_size': high_conf_mask.sum(),
                            'calibration_error': abs(threshold - actual_accuracy)
                        }
                
                result = AccuracyTestResult()
                result.test_name = "Confidence Calibration"
                result.sample_size = len(confidences)
                result.accuracy = ece  # Using ECE as the primary metric (lower is better)
                result.details = {
                    'expected_calibration_error': ece,
                    'calibration_curve': {
                        'fraction_of_positives': fraction_of_positives.tolist(),
                        'mean_predicted_value': mean_predicted_value.tolist()
                    },
                    'threshold_tests': threshold_tests
                }
                
                self.test_results['confidence_calibration'] = result
                logger.info(f"Confidence calibration - ECE: {ece:.3f}")
            
        except Exception as e:
            logger.error(f"Confidence calibration test failed: {e}")
    
    async def _test_false_positive_prevention(self):
        """Test false positive prevention on undamaged roofs."""
        logger.info("Testing false positive prevention...")
        
        try:
            true_negatives = 0
            false_positives = 0
            
            # Test specifically on no_damage samples
            for image_id, ground_truth in self.ground_truth_labels.items():
                if ground_truth['damage_type'] != 'no_damage':
                    continue
                
                try:
                    # Load image
                    image = await self._load_test_image(image_id)
                    if image is None:
                        continue
                    
                    # Get Susan AI prediction
                    prediction = await self._get_susan_prediction(image)
                    
                    # Check if correctly identified as no damage
                    if prediction.get('has_damage', True) == False:
                        true_negatives += 1
                    else:
                        false_positives += 1
                        logger.warning(f"False positive detected on image {image_id}")
                
                except Exception as e:
                    logger.warning(f"Failed to process no-damage image {image_id}: {e}")
                    continue
            
            # Calculate false positive rate
            total_negatives = true_negatives + false_positives
            if total_negatives > 0:
                false_positive_rate = false_positives / total_negatives
                specificity = true_negatives / total_negatives
                
                result = AccuracyTestResult()
                result.test_name = "False Positive Prevention"
                result.sample_size = total_negatives
                result.specificity = specificity
                result.false_positive_rate = false_positive_rate
                result.accuracy = specificity  # For no-damage samples, accuracy = specificity
                result.details = {
                    'true_negatives': true_negatives,
                    'false_positives': false_positives,
                    'total_no_damage_samples': total_negatives
                }
                
                self.test_results['false_positive_prevention'] = result
                logger.info(f"False positive prevention - Specificity: {specificity:.3f}, FPR: {false_positive_rate:.3f}")
            
        except Exception as e:
            logger.error(f"False positive prevention test failed: {e}")
    
    async def _test_edge_cases(self):
        """Test edge cases: mixed damage, partial images, poor lighting, etc."""
        logger.info("Testing edge case handling...")
        
        try:
            edge_case_results = {
                'mixed_damage': {'correct': 0, 'total': 0},
                'severe_damage': {'correct': 0, 'total': 0},
                'light_damage': {'correct': 0, 'total': 0}
            }
            
            for image_id, ground_truth in self.ground_truth_labels.items():
                try:
                    # Load image
                    image = await self._load_test_image(image_id)
                    if image is None:
                        continue
                    
                    # Get Susan AI prediction
                    prediction = await self._get_susan_prediction(image)
                    
                    # Test severe damage cases
                    if ground_truth.get('severity') == 'severe':
                        edge_case_results['severe_damage']['total'] += 1
                        if prediction.get('severity') == 'severe':
                            edge_case_results['severe_damage']['correct'] += 1
                    
                    # Test light damage cases
                    elif ground_truth.get('severity') == 'light':
                        edge_case_results['light_damage']['total'] += 1
                        if prediction.get('has_damage', False):
                            edge_case_results['light_damage']['correct'] += 1
                
                except Exception as e:
                    logger.warning(f"Failed to process edge case image {image_id}: {e}")
                    continue
            
            # Calculate edge case accuracies
            result = AccuracyTestResult()
            result.test_name = "Edge Case Handling"
            result.details = {}
            
            for case_type, stats in edge_case_results.items():
                if stats['total'] > 0:
                    accuracy = stats['correct'] / stats['total']
                    result.details[case_type] = {
                        'accuracy': accuracy,
                        'correct': stats['correct'],
                        'total': stats['total']
                    }
            
            overall_correct = sum(stats['correct'] for stats in edge_case_results.values())
            overall_total = sum(stats['total'] for stats in edge_case_results.values())
            result.accuracy = overall_correct / overall_total if overall_total > 0 else 0
            result.sample_size = overall_total
            
            self.test_results['edge_case_handling'] = result
            logger.info(f"Edge case handling - Overall accuracy: {result.accuracy:.3f}")
            
        except Exception as e:
            logger.error(f"Edge case testing failed: {e}")
    
    async def _load_test_image(self, image_id: str) -> Optional[np.ndarray]:
        """Load test image by ID."""
        try:
            # Try different possible paths
            possible_paths = [
                Path(self.dataset_path) / "raw" / f"{image_id}.jpg",
                Path(self.dataset_path) / "raw" / f"{image_id}.png",
                Path(self.dataset_path) / "images" / f"{image_id}.jpg",
                Path(self.dataset_path) / "images" / f"{image_id}.png",
                Path(image_id)  # If image_id is already a full path
            ]
            
            for path in possible_paths:
                if path.exists():
                    image = cv2.imread(str(path))
                    if image is not None:
                        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            logger.warning(f"Could not find image: {image_id}")
            return None
            
        except Exception as e:
            logger.warning(f"Failed to load image {image_id}: {e}")
            return None
    
    async def _get_susan_prediction(self, image: np.ndarray) -> Dict[str, Any]:
        """Get prediction from Susan AI system."""
        try:
            if self.susan_connector:
                # Use Susan AI connector
                result = await self.susan_connector.process_roof_damage_analysis(
                    image, 'comprehensive', 1500, False
                )
                
                # Extract standardized prediction format
                prediction = {
                    'has_damage': True,  # Default assumption
                    'damage_type': 'unknown',
                    'severity': 'unknown',
                    'confidence': 0.5
                }
                
                # Extract from ensemble analysis
                if 'ensemble_analysis' in result:
                    ensemble = result['ensemble_analysis']
                    prediction['has_damage'] = ensemble.get('has_damage', True)
                    prediction['damage_type'] = ensemble.get('primary_damage_type', 'unknown')
                    prediction['confidence'] = ensemble.get('primary_confidence', 0.5)
                
                # Extract from hail analysis
                if 'hail_analysis' in result:
                    hail = result['hail_analysis']
                    if 'severity_assessment' in hail:
                        severity_info = hail['severity_assessment']
                        prediction['severity'] = severity_info.get('severity_level', 'unknown')
                
                return prediction
            
            else:
                # Fallback to direct classifier usage
                if self.damage_classifier and self.hail_analyzer:
                    # Convert image to tensor
                    image_tensor = torch.tensor(image).permute(2, 0, 1).unsqueeze(0).float()
                    
                    # Get ensemble prediction
                    ensemble_result = self.damage_classifier.analyze_damage(image_tensor, 1500)
                    
                    # Get hail-specific prediction
                    hail_result = self.hail_analyzer.analyze_hail_damage(image, 1500)
                    
                    return {
                        'has_damage': ensemble_result.get('has_damage', True),
                        'damage_type': ensemble_result.get('primary_damage_type', 'unknown'),
                        'severity': hail_result.get('severity_assessment', {}).get('severity_level', 'unknown'),
                        'confidence': ensemble_result.get('primary_confidence', 0.5)
                    }
                
                else:
                    # Mock prediction for testing infrastructure
                    return {
                        'has_damage': True,
                        'damage_type': 'hail',
                        'severity': 'moderate',
                        'confidence': 0.8
                    }
            
        except Exception as e:
            logger.warning(f"Prediction failed: {e}")
            return {
                'has_damage': False,
                'damage_type': 'unknown',
                'severity': 'unknown',
                'confidence': 0.0
            }
    
    def _generate_accuracy_report(self) -> Dict[str, Any]:
        """Generate comprehensive accuracy report."""
        try:
            report = {
                'test_summary': {
                    'timestamp': datetime.now().isoformat(),
                    'total_tests': len(self.test_results),
                    'dataset_size': len(self.ground_truth_labels)
                },
                'test_results': {},
                'overall_assessment': {},
                'production_recommendations': {}
            }
            
            # Compile test results
            for test_name, result in self.test_results.items():
                report['test_results'][test_name] = {
                    'accuracy': result.accuracy,
                    'precision': result.precision,
                    'recall': result.recall,
                    'f1_score': result.f1_score,
                    'specificity': result.specificity,
                    'false_positive_rate': result.false_positive_rate,
                    'false_negative_rate': result.false_negative_rate,
                    'sample_size': result.sample_size,
                    'confusion_matrix': result.confusion_matrix,
                    'details': result.details
                }
            
            # Calculate overall assessment
            accuracies = [result.accuracy for result in self.test_results.values() if result.accuracy > 0]
            f1_scores = [result.f1_score for result in self.test_results.values() if result.f1_score > 0]
            
            if accuracies:
                report['overall_assessment'] = {
                    'average_accuracy': np.mean(accuracies),
                    'min_accuracy': np.min(accuracies),
                    'max_accuracy': np.max(accuracies),
                    'average_f1_score': np.mean(f1_scores) if f1_scores else 0,
                    'reliability_score': self._calculate_reliability_score()
                }
            
            # Generate production recommendations
            report['production_recommendations'] = self._generate_production_recommendations()
            
            return report
            
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            return {"error": str(e)}
    
    def _calculate_reliability_score(self) -> float:
        """Calculate overall reliability score for production use."""
        try:
            weights = {
                'overall_damage_detection': 0.3,
                'damage_type_specificity': 0.25,
                'false_positive_prevention': 0.25,
                'confidence_calibration': 0.1,
                'severity_assessment': 0.1
            }
            
            weighted_score = 0
            total_weight = 0
            
            for test_name, weight in weights.items():
                if test_name in self.test_results:
                    result = self.test_results[test_name]
                    
                    # Use appropriate metric for each test
                    if test_name == 'confidence_calibration':
                        score = max(0, 1 - result.accuracy)  # ECE (lower is better)
                    else:
                        score = result.accuracy
                    
                    weighted_score += score * weight
                    total_weight += weight
            
            return weighted_score / total_weight if total_weight > 0 else 0
            
        except Exception as e:
            logger.warning(f"Reliability score calculation failed: {e}")
            return 0.5
    
    def _generate_production_recommendations(self) -> Dict[str, Any]:
        """Generate recommendations for production deployment."""
        try:
            recommendations = {
                'deployment_ready': False,
                'confidence_threshold': 0.8,
                'risk_assessment': 'high',
                'required_improvements': [],
                'monitoring_requirements': []
            }
            
            # Check minimum thresholds
            min_accuracy = 0.85
            min_precision = 0.80
            min_specificity = 0.90  # Critical for false positive prevention
            
            overall_test = self.test_results.get('overall_damage_detection')
            if overall_test:
                if (overall_test.accuracy >= min_accuracy and 
                    overall_test.precision >= min_precision and 
                    overall_test.specificity >= min_specificity):
                    recommendations['deployment_ready'] = True
                    recommendations['risk_assessment'] = 'medium'
                else:
                    if overall_test.accuracy < min_accuracy:
                        recommendations['required_improvements'].append(
                            f"Improve overall accuracy from {overall_test.accuracy:.3f} to {min_accuracy}"
                        )
                    if overall_test.precision < min_precision:
                        recommendations['required_improvements'].append(
                            f"Improve precision from {overall_test.precision:.3f} to {min_precision}"
                        )
                    if overall_test.specificity < min_specificity:
                        recommendations['required_improvements'].append(
                            f"Improve specificity from {overall_test.specificity:.3f} to {min_specificity}"
                        )
            
            # Check confidence calibration
            calibration_test = self.test_results.get('confidence_calibration')
            if calibration_test and calibration_test.details.get('expected_calibration_error', 1) > 0.1:
                recommendations['required_improvements'].append(
                    "Improve confidence score calibration (ECE > 0.1)"
                )
                recommendations['confidence_threshold'] = 0.9  # Higher threshold due to poor calibration
            
            # Check false positive prevention
            fp_test = self.test_results.get('false_positive_prevention')
            if fp_test and fp_test.false_positive_rate > 0.1:
                recommendations['required_improvements'].append(
                    f"Reduce false positive rate from {fp_test.false_positive_rate:.3f} to <0.1"
                )
                recommendations['risk_assessment'] = 'high'
            
            # Monitoring requirements
            recommendations['monitoring_requirements'] = [
                "Monitor confidence score distribution in production",
                "Track false positive rates on known undamaged roofs",
                "Validate severity assessments with expert inspections",
                "Regular performance audits with new ground truth data"
            ]
            
            return recommendations
            
        except Exception as e:
            logger.warning(f"Production recommendations generation failed: {e}")
            return {"error": str(e)}
    
    def save_results(self, output_path: str = None):
        """Save test results to file."""
        try:
            if not output_path:
                output_path = f"susan_accuracy_validation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            report = self._generate_accuracy_report()
            
            with open(output_path, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            
            logger.info(f"Accuracy validation report saved to: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to save results: {e}")
            return None
    
    def generate_visualizations(self, output_dir: str = None):
        """Generate visualization plots for test results."""
        try:
            if not output_dir:
                output_dir = f"accuracy_validation_plots_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            os.makedirs(output_dir, exist_ok=True)
            
            # Plot confusion matrices
            self._plot_confusion_matrices(output_dir)
            
            # Plot confidence calibration
            self._plot_confidence_calibration(output_dir)
            
            # Plot accuracy comparison
            self._plot_accuracy_comparison(output_dir)
            
            logger.info(f"Visualization plots saved to: {output_dir}")
            return output_dir
            
        except Exception as e:
            logger.error(f"Visualization generation failed: {e}")
            return None
    
    def _plot_confusion_matrices(self, output_dir: str):
        """Plot confusion matrices for key tests."""
        for test_name, result in self.test_results.items():
            if result.confusion_matrix is not None:
                plt.figure(figsize=(8, 6))
                cm = np.array(result.confusion_matrix)
                sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
                plt.title(f'Confusion Matrix - {test_name}')
                plt.ylabel('True Label')
                plt.xlabel('Predicted Label')
                plt.tight_layout()
                plt.savefig(f"{output_dir}/confusion_matrix_{test_name.lower().replace(' ', '_')}.png")
                plt.close()
    
    def _plot_confidence_calibration(self, output_dir: str):
        """Plot confidence calibration curve."""
        if 'confidence_calibration' in self.test_results:
            result = self.test_results['confidence_calibration']
            calib_data = result.details.get('calibration_curve', {})
            
            if calib_data:
                plt.figure(figsize=(8, 6))
                plt.plot(calib_data['mean_predicted_value'], calib_data['fraction_of_positives'], 
                        marker='o', label='Susan AI')
                plt.plot([0, 1], [0, 1], linestyle='--', label='Perfect Calibration')
                plt.xlabel('Mean Predicted Confidence')
                plt.ylabel('Fraction of Positives')
                plt.title('Confidence Calibration Curve')
                plt.legend()
                plt.grid(True, alpha=0.3)
                plt.tight_layout()
                plt.savefig(f"{output_dir}/confidence_calibration.png")
                plt.close()
    
    def _plot_accuracy_comparison(self, output_dir: str):
        """Plot accuracy comparison across tests."""
        test_names = []
        accuracies = []
        
        for test_name, result in self.test_results.items():
            if result.accuracy > 0:
                test_names.append(test_name.replace('_', ' ').title())
                accuracies.append(result.accuracy)
        
        if test_names:
            plt.figure(figsize=(12, 6))
            bars = plt.bar(test_names, accuracies)
            plt.ylim(0, 1)
            plt.ylabel('Accuracy')
            plt.title('Susan AI Accuracy Across Different Tests')
            plt.xticks(rotation=45, ha='right')
            
            # Add accuracy values on bars
            for bar, accuracy in zip(bars, accuracies):
                plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                        f'{accuracy:.3f}', ha='center', va='bottom')
            
            # Add reference lines
            plt.axhline(y=0.85, color='green', linestyle='--', alpha=0.7, label='Target (85%)')
            plt.axhline(y=0.80, color='orange', linestyle='--', alpha=0.7, label='Minimum (80%)')
            plt.legend()
            plt.tight_layout()
            plt.savefig(f"{output_dir}/accuracy_comparison.png")
            plt.close()


async def main():
    """Main function for running Susan AI accuracy validation."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Susan AI Accuracy Validation')
    parser.add_argument('--dataset-path', type=str, help='Path to ground truth dataset')
    parser.add_argument('--output-dir', type=str, help='Output directory for results')
    parser.add_argument('--save-plots', action='store_true', help='Generate visualization plots')
    
    args = parser.parse_args()
    
    try:
        # Initialize validator
        validator = SusanAccuracyValidator(args.dataset_path)
        
        # Initialize Susan AI
        success = await validator.initialize_susan_ai()
        if not success:
            logger.error("Failed to initialize Susan AI components")
            return
        
        # Load ground truth data
        success = validator.load_ground_truth_dataset()
        if not success:
            logger.error("Failed to load ground truth dataset")
            return
        
        # Run comprehensive tests
        logger.info("Starting comprehensive accuracy validation...")
        results = await validator.run_comprehensive_accuracy_tests()
        
        # Save results
        output_file = validator.save_results(args.output_dir)
        
        # Generate plots if requested
        if args.save_plots:
            validator.generate_visualizations(args.output_dir)
        
        # Print summary
        print("\n" + "="*80)
        print("SUSAN AI ACCURACY VALIDATION RESULTS")
        print("="*80)
        
        if 'overall_assessment' in results:
            assessment = results['overall_assessment']
            print(f"Average Accuracy: {assessment.get('average_accuracy', 0):.3f}")
            print(f"Reliability Score: {assessment.get('reliability_score', 0):.3f}")
        
        if 'production_recommendations' in results:
            recommendations = results['production_recommendations']
            print(f"Deployment Ready: {recommendations.get('deployment_ready', False)}")
            print(f"Risk Assessment: {recommendations.get('risk_assessment', 'unknown')}")
            
            if recommendations.get('required_improvements'):
                print("\nRequired Improvements:")
                for improvement in recommendations['required_improvements']:
                    print(f"  • {improvement}")
        
        print(f"\nDetailed results saved to: {output_file}")
        print("="*80)
        
    except Exception as e:
        logger.error(f"Accuracy validation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())