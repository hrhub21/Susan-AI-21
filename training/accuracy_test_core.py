#!/usr/bin/env python3
"""
Core Susan AI Accuracy Testing System
Focused on essential validation of hail damage detection accuracy
"""

import os
import sys
import json
import logging
import numpy as np
import torch
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
from sklearn.calibration import calibration_curve
import cv2
from PIL import Image
import pandas as pd
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class GroundTruthLoader:
    """Load and manage ground truth data from the HuggingFace dataset."""
    
    def __init__(self, dataset_path: str):
        self.dataset_path = Path(dataset_path)
        self.ground_truth = {}
        self.image_paths = {}
        
    def load_ground_truth(self) -> bool:
        """Load ground truth labels from dataset files."""
        try:
            logger.info("Loading ground truth data...")
            
            # Load test data
            test_file = self.dataset_path / "test_final.json"
            train_file = self.dataset_path / "train_final.json"
            val_file = self.dataset_path / "validation_final.json"
            
            total_loaded = 0
            
            # Load test split
            if test_file.exists():
                with open(test_file, 'r') as f:
                    test_data = json.load(f)
                    for item in test_data:
                        self._process_data_item(item, 'test')
                        total_loaded += 1
            
            # Load validation split for more samples
            if val_file.exists():
                with open(val_file, 'r') as f:
                    val_data = json.load(f)
                    for item in val_data:
                        self._process_data_item(item, 'validation')
                        total_loaded += 1
            
            # Load subset of training data for edge cases
            if train_file.exists():
                with open(train_file, 'r') as f:
                    train_data = json.load(f)
                    # Only load first 50 training samples to avoid overwhelming
                    for item in train_data[:50]:
                        self._process_data_item(item, 'train')
                        total_loaded += 1
            
            logger.info(f"Loaded {total_loaded} ground truth labels")
            logger.info(f"Label distribution: {self._get_label_distribution()}")
            
            return len(self.ground_truth) > 0
            
        except Exception as e:
            logger.error(f"Ground truth loading failed: {e}")
            return False
    
    def _process_data_item(self, item: Dict[str, Any], split: str):
        """Process a single data item from the dataset."""
        try:
            # Extract image identifier from sample_id
            sample_id = item.get('sample_id', '')
            if not sample_id:
                return
            
            # Create unique ID including split
            full_id = f"{split}_{sample_id}"
            
            # Extract labels from the nested labels structure
            labels = item.get('labels', {})
            damage_type = labels.get('primary_damage', 'unknown')
            severity = labels.get('severity', 'unknown')
            confidence = labels.get('confidence', 0.0)
            
            # Store ground truth
            self.ground_truth[full_id] = {
                'damage_type': damage_type,
                'severity': severity,
                'has_damage': damage_type != 'no_damage',
                'confidence': confidence,
                'split': split,
                'original_id': sample_id
            }
            
            # Store image path from the dataset (numpy files)
            image_file = item.get('image_file', '')
            if image_file and Path(image_file).exists():
                self.image_paths[full_id] = image_file
            else:
                # Try to construct path from sample_id
                npy_path = self.dataset_path / f"train_{sample_id}.npy"
                if npy_path.exists():
                    self.image_paths[full_id] = str(npy_path)
            
        except Exception as e:
            logger.warning(f"Failed to process data item: {e}")
    
    def _get_label_distribution(self) -> Dict[str, int]:
        """Get distribution of labels in the ground truth data."""
        distribution = {}
        for gt in self.ground_truth.values():
            label = gt['damage_type']
            distribution[label] = distribution.get(label, 0) + 1
        return distribution
    
    def get_samples_by_type(self, damage_type: str) -> List[str]:
        """Get all samples of a specific damage type."""
        return [id for id, gt in self.ground_truth.items() if gt['damage_type'] == damage_type]
    
    def get_samples_by_severity(self, severity: str) -> List[str]:
        """Get all samples of a specific severity level."""
        return [id for id, gt in self.ground_truth.items() if gt['severity'] == severity]


class MockSusanPredictor:
    """
    Mock predictor for testing infrastructure when Susan AI components are unavailable.
    Uses simple heuristics to simulate realistic but imperfect predictions.
    """
    
    def __init__(self):
        self.prediction_history = []
        
    def predict(self, image: np.ndarray, image_id: str) -> Dict[str, Any]:
        """Generate mock prediction for testing."""
        try:
            # Simple heuristic based on image characteristics
            # This is intentionally basic to test the validation framework
            
            # Calculate image statistics
            mean_intensity = np.mean(image)
            std_intensity = np.std(image)
            
            # Mock damage detection based on intensity variation
            has_damage = std_intensity > 30  # High variation suggests damage
            
            # Mock damage type based on color characteristics
            if has_damage:
                blue_channel = np.mean(image[:, :, 2])
                green_channel = np.mean(image[:, :, 1])
                red_channel = np.mean(image[:, :, 0])
                
                if blue_channel > green_channel and blue_channel > red_channel:
                    damage_type = 'hail'
                elif red_channel > green_channel:
                    damage_type = 'wind'
                else:
                    damage_type = 'wear'
            else:
                damage_type = 'no_damage'
            
            # Mock severity based on standard deviation
            if has_damage:
                if std_intensity > 50:
                    severity = 'severe'
                elif std_intensity > 40:
                    severity = 'moderate'
                else:
                    severity = 'light'
            else:
                severity = 'none'
            
            # Mock confidence (intentionally varied for calibration testing)
            confidence = min(0.95, max(0.5, (std_intensity / 60.0) + np.random.normal(0, 0.1)))
            
            prediction = {
                'has_damage': has_damage,
                'damage_type': damage_type,
                'severity': severity,
                'confidence': confidence,
                'image_stats': {
                    'mean_intensity': mean_intensity,
                    'std_intensity': std_intensity
                }
            }
            
            self.prediction_history.append({
                'image_id': image_id,
                'prediction': prediction
            })
            
            return prediction
            
        except Exception as e:
            logger.warning(f"Mock prediction failed: {e}")
            return {
                'has_damage': False,
                'damage_type': 'unknown',
                'severity': 'unknown',
                'confidence': 0.0
            }


class AccuracyTester:
    """Core accuracy testing system for Susan AI hail damage detection."""
    
    def __init__(self, dataset_path: str):
        self.dataset_path = dataset_path
        self.ground_truth_loader = GroundTruthLoader(dataset_path)
        self.predictor = MockSusanPredictor()  # Will be replaced with real Susan AI
        
        # Results storage
        self.test_results = {}
        self.predictions = {}
        
    def run_accuracy_tests(self) -> Dict[str, Any]:
        """Run comprehensive accuracy tests."""
        try:
            logger.info("Starting accuracy tests...")
            
            # Load ground truth data
            if not self.ground_truth_loader.load_ground_truth():
                raise Exception("Failed to load ground truth data")
            
            # Run individual tests
            self._test_overall_damage_detection()
            self._test_damage_type_classification()
            self._test_hail_specific_detection()
            self._test_false_positive_prevention()
            self._test_severity_assessment()
            self._test_confidence_calibration()
            
            # Generate final report
            report = self._generate_final_report()
            
            logger.info("Accuracy tests completed successfully")
            return report
            
        except Exception as e:
            logger.error(f"Accuracy tests failed: {e}")
            return {"error": str(e)}
    
    def _test_overall_damage_detection(self):
        """Test overall damage vs no-damage detection."""
        logger.info("Testing overall damage detection...")
        
        try:
            true_labels = []
            predicted_labels = []
            confidence_scores = []
            
            processed_count = 0
            max_samples = 100  # Limit for testing
            
            for image_id, ground_truth in self.ground_truth_loader.ground_truth.items():
                if processed_count >= max_samples:
                    break
                
                # Load and predict
                image = self._load_image(image_id)
                if image is None:
                    continue
                
                prediction = self.predictor.predict(image, image_id)
                self.predictions[image_id] = prediction
                
                # Extract binary classification
                true_has_damage = ground_truth['has_damage']
                pred_has_damage = prediction['has_damage']
                confidence = prediction['confidence']
                
                true_labels.append(int(true_has_damage))
                predicted_labels.append(int(pred_has_damage))
                confidence_scores.append(confidence)
                
                processed_count += 1
            
            if len(true_labels) > 0:
                # Calculate metrics
                accuracy = accuracy_score(true_labels, predicted_labels)
                precision = precision_score(true_labels, predicted_labels, zero_division=0)
                recall = recall_score(true_labels, predicted_labels, zero_division=0)
                f1 = f1_score(true_labels, predicted_labels, zero_division=0)
                cm = confusion_matrix(true_labels, predicted_labels)
                
                # Calculate specificity
                tn, fp, fn, tp = cm.ravel()
                specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
                
                self.test_results['overall_damage_detection'] = {
                    'accuracy': accuracy,
                    'precision': precision,
                    'recall': recall,
                    'f1_score': f1,
                    'specificity': specificity,
                    'confusion_matrix': cm.tolist(),
                    'sample_size': len(true_labels),
                    'confidence_scores': confidence_scores,
                    'true_labels': true_labels,
                    'predicted_labels': predicted_labels
                }
                
                logger.info(f"Overall damage detection - Accuracy: {accuracy:.3f}, F1: {f1:.3f}")
                
        except Exception as e:
            logger.error(f"Overall damage detection test failed: {e}")
    
    def _test_damage_type_classification(self):
        """Test multi-class damage type classification."""
        logger.info("Testing damage type classification...")
        
        try:
            true_types = []
            predicted_types = []
            damage_types = ['hail', 'wind', 'wear', 'impact', 'no_damage']
            
            processed_count = 0
            max_samples = 80
            
            for image_id, ground_truth in self.ground_truth_loader.ground_truth.items():
                if processed_count >= max_samples:
                    break
                
                if image_id in self.predictions:
                    prediction = self.predictions[image_id]
                else:
                    image = self._load_image(image_id)
                    if image is None:
                        continue
                    prediction = self.predictor.predict(image, image_id)
                    self.predictions[image_id] = prediction
                
                true_type = ground_truth['damage_type']
                pred_type = prediction['damage_type']
                
                if true_type in damage_types and pred_type in damage_types:
                    true_types.append(true_type)
                    predicted_types.append(pred_type)
                
                processed_count += 1
            
            if len(true_types) > 0:
                accuracy = accuracy_score(true_types, predicted_types)
                precision = precision_score(true_types, predicted_types, average='weighted', zero_division=0)
                recall = recall_score(true_types, predicted_types, average='weighted', zero_division=0)
                f1 = f1_score(true_types, predicted_types, average='weighted', zero_division=0)
                cm = confusion_matrix(true_types, predicted_types, labels=damage_types)
                
                self.test_results['damage_type_classification'] = {
                    'accuracy': accuracy,
                    'precision': precision,
                    'recall': recall,
                    'f1_score': f1,
                    'confusion_matrix': cm.tolist(),
                    'sample_size': len(true_types),
                    'damage_types': damage_types,
                    'true_types': true_types,
                    'predicted_types': predicted_types
                }
                
                logger.info(f"Damage type classification - Accuracy: {accuracy:.3f}, F1: {f1:.3f}")
                
        except Exception as e:
            logger.error(f"Damage type classification test failed: {e}")
    
    def _test_hail_specific_detection(self):
        """Test hail-specific detection accuracy."""
        logger.info("Testing hail-specific detection...")
        
        try:
            hail_samples = self.ground_truth_loader.get_samples_by_type('hail')
            non_hail_samples = [id for id in self.ground_truth_loader.ground_truth.keys() 
                              if self.ground_truth_loader.ground_truth[id]['damage_type'] != 'hail']
            
            # Balance the test
            test_samples = hail_samples[:30] + non_hail_samples[:30]
            
            true_labels = []
            predicted_labels = []
            confidences = []
            
            for image_id in test_samples:
                if image_id in self.predictions:
                    prediction = self.predictions[image_id]
                else:
                    image = self._load_image(image_id)
                    if image is None:
                        continue
                    prediction = self.predictor.predict(image, image_id)
                    self.predictions[image_id] = prediction
                
                ground_truth = self.ground_truth_loader.ground_truth[image_id]
                
                is_hail_true = ground_truth['damage_type'] == 'hail'
                is_hail_pred = prediction['damage_type'] == 'hail'
                confidence = prediction['confidence']
                
                true_labels.append(int(is_hail_true))
                predicted_labels.append(int(is_hail_pred))
                confidences.append(confidence)
            
            if len(true_labels) > 0:
                accuracy = accuracy_score(true_labels, predicted_labels)
                precision = precision_score(true_labels, predicted_labels, zero_division=0)
                recall = recall_score(true_labels, predicted_labels, zero_division=0)
                f1 = f1_score(true_labels, predicted_labels, zero_division=0)
                cm = confusion_matrix(true_labels, predicted_labels)
                
                self.test_results['hail_specific_detection'] = {
                    'accuracy': accuracy,
                    'precision': precision,
                    'recall': recall,
                    'f1_score': f1,
                    'confusion_matrix': cm.tolist(),
                    'sample_size': len(true_labels),
                    'hail_samples_tested': sum(true_labels),
                    'non_hail_samples_tested': len(true_labels) - sum(true_labels)
                }
                
                logger.info(f"Hail-specific detection - Precision: {precision:.3f}, Recall: {recall:.3f}")
                
        except Exception as e:
            logger.error(f"Hail-specific detection test failed: {e}")
    
    def _test_false_positive_prevention(self):
        """Test false positive prevention on undamaged roofs."""
        logger.info("Testing false positive prevention...")
        
        try:
            no_damage_samples = self.ground_truth_loader.get_samples_by_type('no_damage')
            
            true_negatives = 0
            false_positives = 0
            
            for image_id in no_damage_samples[:40]:  # Test up to 40 samples
                if image_id in self.predictions:
                    prediction = self.predictions[image_id]
                else:
                    image = self._load_image(image_id)
                    if image is None:
                        continue
                    prediction = self.predictor.predict(image, image_id)
                    self.predictions[image_id] = prediction
                
                if prediction['has_damage'] == False:
                    true_negatives += 1
                else:
                    false_positives += 1
            
            total_negatives = true_negatives + false_positives
            if total_negatives > 0:
                false_positive_rate = false_positives / total_negatives
                specificity = true_negatives / total_negatives
                
                self.test_results['false_positive_prevention'] = {
                    'specificity': specificity,
                    'false_positive_rate': false_positive_rate,
                    'true_negatives': true_negatives,
                    'false_positives': false_positives,
                    'sample_size': total_negatives
                }
                
                logger.info(f"False positive prevention - Specificity: {specificity:.3f}, FPR: {false_positive_rate:.3f}")
                
        except Exception as e:
            logger.error(f"False positive prevention test failed: {e}")
    
    def _test_severity_assessment(self):
        """Test severity level assessment accuracy."""
        logger.info("Testing severity assessment...")
        
        try:
            severity_levels = ['light', 'moderate', 'severe']
            true_severities = []
            predicted_severities = []
            
            # Get samples with severity labels
            severity_samples = []
            for image_id, gt in self.ground_truth_loader.ground_truth.items():
                if gt['severity'] in severity_levels:
                    severity_samples.append(image_id)
            
            for image_id in severity_samples[:50]:  # Test up to 50 samples
                if image_id in self.predictions:
                    prediction = self.predictions[image_id]
                else:
                    image = self._load_image(image_id)
                    if image is None:
                        continue
                    prediction = self.predictor.predict(image, image_id)
                    self.predictions[image_id] = prediction
                
                ground_truth = self.ground_truth_loader.ground_truth[image_id]
                
                true_sev = ground_truth['severity']
                pred_sev = prediction['severity']
                
                if true_sev in severity_levels and pred_sev in severity_levels:
                    true_severities.append(true_sev)
                    predicted_severities.append(pred_sev)
            
            if len(true_severities) > 0:
                accuracy = accuracy_score(true_severities, predicted_severities)
                precision = precision_score(true_severities, predicted_severities, average='weighted', zero_division=0)
                recall = recall_score(true_severities, predicted_severities, average='weighted', zero_division=0)
                f1 = f1_score(true_severities, predicted_severities, average='weighted', zero_division=0)
                
                self.test_results['severity_assessment'] = {
                    'accuracy': accuracy,
                    'precision': precision,
                    'recall': recall,
                    'f1_score': f1,
                    'sample_size': len(true_severities)
                }
                
                logger.info(f"Severity assessment - Accuracy: {accuracy:.3f}, F1: {f1:.3f}")
                
        except Exception as e:
            logger.error(f"Severity assessment test failed: {e}")
    
    def _test_confidence_calibration(self):
        """Test confidence score calibration."""
        logger.info("Testing confidence calibration...")
        
        try:
            if 'overall_damage_detection' not in self.test_results:
                logger.warning("No overall damage detection results for calibration test")
                return
            
            overall_results = self.test_results['overall_damage_detection']
            confidences = np.array(overall_results['confidence_scores'])
            correct_predictions = (np.array(overall_results['true_labels']) == 
                                 np.array(overall_results['predicted_labels']))
            
            # Calculate calibration curve
            fraction_of_positives, mean_predicted_value = calibration_curve(
                correct_predictions, confidences, n_bins=5
            )
            
            # Calculate Expected Calibration Error (ECE)
            bin_boundaries = np.linspace(0, 1, 6)
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
            
            # Test specific thresholds
            threshold_tests = {}
            for threshold in [0.8, 0.85, 0.9]:
                high_conf_mask = confidences >= threshold
                if high_conf_mask.sum() > 0:
                    actual_accuracy = correct_predictions[high_conf_mask].mean()
                    threshold_tests[f"threshold_{threshold}"] = {
                        'expected_accuracy': threshold,
                        'actual_accuracy': actual_accuracy,
                        'sample_size': int(high_conf_mask.sum()),
                        'calibration_error': abs(threshold - actual_accuracy)
                    }
            
            self.test_results['confidence_calibration'] = {
                'expected_calibration_error': ece,
                'fraction_of_positives': fraction_of_positives.tolist(),
                'mean_predicted_value': mean_predicted_value.tolist(),
                'threshold_tests': threshold_tests,
                'sample_size': len(confidences)
            }
            
            logger.info(f"Confidence calibration - ECE: {ece:.3f}")
            
        except Exception as e:
            logger.error(f"Confidence calibration test failed: {e}")
    
    def _load_image(self, image_id: str) -> Optional[np.ndarray]:
        """Load image by ID."""
        try:
            if image_id in self.ground_truth_loader.image_paths:
                image_path = self.ground_truth_loader.image_paths[image_id]
                
                # Handle numpy files
                if image_path.endswith('.npy'):
                    image_array = np.load(image_path)
                    # Ensure proper format (H, W, C) and data type
                    if image_array.ndim == 3 and image_array.shape[2] == 3:
                        # Convert to uint8 if needed
                        if image_array.dtype != np.uint8:
                            if image_array.max() <= 1.0:
                                image_array = (image_array * 255).astype(np.uint8)
                            else:
                                image_array = image_array.astype(np.uint8)
                        return image_array
                    else:
                        logger.warning(f"Unexpected image array shape: {image_array.shape}")
                        return None
                
                # Handle regular image files
                else:
                    image = cv2.imread(image_path)
                    if image is not None:
                        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # If no stored path, try to construct it
            original_id = self.ground_truth_loader.ground_truth[image_id]['original_id']
            
            # Try numpy file first
            npy_path = Path(self.dataset_path) / f"train_{original_id}.npy"
            if npy_path.exists():
                image_array = np.load(str(npy_path))
                if image_array.ndim == 3 and image_array.shape[2] == 3:
                    if image_array.dtype != np.uint8:
                        if image_array.max() <= 1.0:
                            image_array = (image_array * 255).astype(np.uint8)
                        else:
                            image_array = image_array.astype(np.uint8)
                    return image_array
            
            # Try regular image files
            possible_extensions = ['.jpg', '.jpeg', '.png', '.bmp']
            for ext in possible_extensions:
                possible_path = Path(self.dataset_path) / "raw" / f"{original_id}{ext}"
                if possible_path.exists():
                    image = cv2.imread(str(possible_path))
                    if image is not None:
                        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            logger.warning(f"Could not load image: {image_id}")
            return None
            
        except Exception as e:
            logger.warning(f"Image loading failed for {image_id}: {e}")
            return None
    
    def _generate_final_report(self) -> Dict[str, Any]:
        """Generate comprehensive final report."""
        try:
            report = {
                'test_summary': {
                    'timestamp': datetime.now().isoformat(),
                    'total_tests_run': len(self.test_results),
                    'dataset_size': len(self.ground_truth_loader.ground_truth)
                },
                'test_results': self.test_results,
                'overall_assessment': {},
                'production_readiness': {}
            }
            
            # Calculate overall metrics
            key_metrics = ['accuracy', 'precision', 'recall', 'f1_score']
            overall_metrics = {}
            
            for metric in key_metrics:
                metric_values = []
                for test_result in self.test_results.values():
                    if metric in test_result and test_result[metric] > 0:
                        metric_values.append(test_result[metric])
                
                if metric_values:
                    overall_metrics[f'avg_{metric}'] = np.mean(metric_values)
                    overall_metrics[f'min_{metric}'] = np.min(metric_values)
                    overall_metrics[f'max_{metric}'] = np.max(metric_values)
            
            report['overall_assessment'] = overall_metrics
            
            # Production readiness assessment
            production_ready = self._assess_production_readiness()
            report['production_readiness'] = production_ready
            
            return report
            
        except Exception as e:
            logger.error(f"Final report generation failed: {e}")
            return {"error": str(e)}
    
    def _assess_production_readiness(self) -> Dict[str, Any]:
        """Assess production readiness based on test results."""
        try:
            assessment = {
                'ready_for_production': False,
                'confidence_threshold_recommendation': 0.85,
                'risk_level': 'high',
                'critical_issues': [],
                'recommendations': []
            }
            
            # Check minimum requirements
            min_accuracy = 0.85
            min_precision = 0.80
            min_specificity = 0.90
            max_false_positive_rate = 0.10
            max_calibration_error = 0.10
            
            issues = []
            
            # Check overall damage detection
            if 'overall_damage_detection' in self.test_results:
                overall = self.test_results['overall_damage_detection']
                if overall['accuracy'] < min_accuracy:
                    issues.append(f"Overall accuracy ({overall['accuracy']:.3f}) below minimum ({min_accuracy})")
                if overall['precision'] < min_precision:
                    issues.append(f"Overall precision ({overall['precision']:.3f}) below minimum ({min_precision})")
                if overall['specificity'] < min_specificity:
                    issues.append(f"Specificity ({overall['specificity']:.3f}) below minimum ({min_specificity})")
            
            # Check false positive prevention
            if 'false_positive_prevention' in self.test_results:
                fp_test = self.test_results['false_positive_prevention']
                if fp_test['false_positive_rate'] > max_false_positive_rate:
                    issues.append(f"False positive rate ({fp_test['false_positive_rate']:.3f}) above maximum ({max_false_positive_rate})")
            
            # Check confidence calibration
            if 'confidence_calibration' in self.test_results:
                calib = self.test_results['confidence_calibration']
                if calib['expected_calibration_error'] > max_calibration_error:
                    issues.append(f"Calibration error ({calib['expected_calibration_error']:.3f}) above maximum ({max_calibration_error})")
            
            # Check hail-specific performance
            if 'hail_specific_detection' in self.test_results:
                hail = self.test_results['hail_specific_detection']
                if hail['precision'] < 0.75 or hail['recall'] < 0.75:
                    issues.append(f"Hail detection performance insufficient (Precision: {hail['precision']:.3f}, Recall: {hail['recall']:.3f})")
            
            assessment['critical_issues'] = issues
            
            if len(issues) == 0:
                assessment['ready_for_production'] = True
                assessment['risk_level'] = 'low'
            elif len(issues) <= 2:
                assessment['ready_for_production'] = False
                assessment['risk_level'] = 'medium'
                assessment['confidence_threshold_recommendation'] = 0.90
            else:
                assessment['ready_for_production'] = False
                assessment['risk_level'] = 'high'
                assessment['confidence_threshold_recommendation'] = 0.95
            
            # Generate recommendations
            recommendations = [
                "Conduct additional validation with larger dataset",
                "Implement confidence threshold monitoring in production",
                "Set up automated performance tracking",
                "Regular retraining with new expert-labeled data"
            ]
            
            if not assessment['ready_for_production']:
                recommendations.extend([
                    "Address critical issues before production deployment",
                    "Consider ensemble methods to improve accuracy",
                    "Implement human review for low-confidence predictions"
                ])
            
            assessment['recommendations'] = recommendations
            
            return assessment
            
        except Exception as e:
            logger.error(f"Production readiness assessment failed: {e}")
            return {"error": str(e)}
    
    def save_results(self, output_path: str = None) -> str:
        """Save test results to JSON file."""
        try:
            if not output_path:
                output_path = f"susan_accuracy_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            report = self._generate_final_report()
            
            with open(output_path, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            
            logger.info(f"Test results saved to: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to save results: {e}")
            return ""
    
    def generate_plots(self, output_dir: str = None):
        """Generate visualization plots."""
        try:
            if not output_dir:
                output_dir = f"accuracy_plots_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            os.makedirs(output_dir, exist_ok=True)
            
            # Plot accuracy comparison
            self._plot_accuracy_comparison(output_dir)
            
            # Plot confusion matrices
            self._plot_confusion_matrices(output_dir)
            
            # Plot confidence calibration
            if 'confidence_calibration' in self.test_results:
                self._plot_confidence_calibration(output_dir)
            
            logger.info(f"Plots saved to: {output_dir}")
            return output_dir
            
        except Exception as e:
            logger.error(f"Plot generation failed: {e}")
            return ""
    
    def _plot_accuracy_comparison(self, output_dir: str):
        """Plot accuracy comparison across tests."""
        test_names = []
        accuracies = []
        
        for test_name, result in self.test_results.items():
            if 'accuracy' in result and result['accuracy'] > 0:
                test_names.append(test_name.replace('_', ' ').title())
                accuracies.append(result['accuracy'])
        
        if test_names:
            plt.figure(figsize=(12, 6))
            bars = plt.bar(test_names, accuracies, color=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'][:len(test_names)])
            plt.ylim(0, 1)
            plt.ylabel('Accuracy')
            plt.title('Susan AI Accuracy Test Results')
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
            plt.savefig(f"{output_dir}/accuracy_comparison.png", dpi=300, bbox_inches='tight')
            plt.close()
    
    def _plot_confusion_matrices(self, output_dir: str):
        """Plot confusion matrices."""
        for test_name, result in self.test_results.items():
            if 'confusion_matrix' in result:
                plt.figure(figsize=(8, 6))
                cm = np.array(result['confusion_matrix'])
                
                # Handle different matrix sizes
                if cm.shape == (2, 2):
                    labels = ['No Damage', 'Damage']
                else:
                    labels = None
                
                sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=labels, yticklabels=labels)
                plt.title(f'Confusion Matrix - {test_name.replace("_", " ").title()}')
                plt.ylabel('True Label')
                plt.xlabel('Predicted Label')
                plt.tight_layout()
                plt.savefig(f"{output_dir}/confusion_matrix_{test_name}.png", dpi=300, bbox_inches='tight')
                plt.close()
    
    def _plot_confidence_calibration(self, output_dir: str):
        """Plot confidence calibration curve."""
        calib_result = self.test_results['confidence_calibration']
        
        plt.figure(figsize=(8, 6))
        plt.plot(calib_result['mean_predicted_value'], calib_result['fraction_of_positives'], 
                marker='o', label='Susan AI', linewidth=2, markersize=8)
        plt.plot([0, 1], [0, 1], linestyle='--', color='gray', label='Perfect Calibration')
        plt.xlabel('Mean Predicted Confidence')
        plt.ylabel('Fraction of Positives (Accuracy)')
        plt.title('Confidence Calibration Curve')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(f"{output_dir}/confidence_calibration.png", dpi=300, bbox_inches='tight')
        plt.close()


def main():
    """Main function for running accuracy tests."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Susan AI Accuracy Testing')
    parser.add_argument('--dataset-path', type=str, default='./datasets/processed', 
                       help='Path to processed dataset')
    parser.add_argument('--output', type=str, help='Output file for results')
    parser.add_argument('--generate-plots', action='store_true', help='Generate visualization plots')
    
    args = parser.parse_args()
    
    try:
        # Initialize tester
        tester = AccuracyTester(args.dataset_path)
        
        # Run tests
        logger.info("Starting Susan AI accuracy validation...")
        results = tester.run_accuracy_tests()
        
        # Save results
        output_file = tester.save_results(args.output)
        
        # Generate plots
        plot_dir = ""
        if args.generate_plots:
            plot_dir = tester.generate_plots()
        
        # Print summary
        print("\n" + "="*80)
        print("SUSAN AI ACCURACY VALIDATION COMPLETE")
        print("="*80)
        
        if 'overall_assessment' in results:
            assessment = results['overall_assessment']
            print(f"Average Accuracy: {assessment.get('avg_accuracy', 0):.3f}")
            print(f"Average Precision: {assessment.get('avg_precision', 0):.3f}")
            print(f"Average Recall: {assessment.get('avg_recall', 0):.3f}")
            print(f"Average F1 Score: {assessment.get('avg_f1_score', 0):.3f}")
        
        if 'production_readiness' in results:
            prod_ready = results['production_readiness']
            print(f"\nProduction Ready: {prod_ready.get('ready_for_production', False)}")
            print(f"Risk Level: {prod_ready.get('risk_level', 'unknown').upper()}")
            print(f"Recommended Confidence Threshold: {prod_ready.get('confidence_threshold_recommendation', 0.85)}")
            
            if prod_ready.get('critical_issues'):
                print(f"\nCritical Issues ({len(prod_ready['critical_issues'])}):")
                for issue in prod_ready['critical_issues']:
                    print(f"  • {issue}")
        
        print(f"\nDetailed results: {output_file}")
        if plot_dir:
            print(f"Visualization plots: {plot_dir}")
        print("="*80)
        
    except Exception as e:
        logger.error(f"Accuracy testing failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()