#!/usr/bin/env python3
"""
Advanced Hail Damage Detection Specialist for Susan AI
Specialized deep learning models and algorithms for precise hail damage detection,
quantification, and analysis. Integrates with the main training system.
"""

import os
import sys
import json
import logging
import numpy as np
import cv2
from PIL import Image
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Union
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import ndimage, signal
from skimage import measure, morphology, filters, segmentation
from skimage.feature import blob_dog, blob_log, blob_doh
from scipy.ndimage import maximum_filter
from skimage.transform import hough_circle, hough_circle_peaks
import timm
import albumentations as A
from collections import defaultdict
import warnings
warnings.filterwarnings('ignore')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class CircularFeatureDetector:
    """
    Advanced circular feature detection for hail impact identification.
    Uses multiple complementary algorithms for robust detection.
    """
    
    def __init__(
        self,
        min_radius: int = 3,
        max_radius: int = 50,
        detection_threshold: float = 0.6
    ):
        """Initialize the circular feature detector."""
        self.min_radius = min_radius
        self.max_radius = max_radius
        self.detection_threshold = detection_threshold
        
        # Hail size classification (in pixels at standard resolution)
        self.hail_size_classes = {
            'pea': (3, 8),         # 0.25-0.5 inches
            'marble': (8, 15),     # 0.5-0.75 inches  
            'penny': (15, 20),     # 0.75-1 inches
            'nickel': (20, 25),    # 1-1.25 inches
            'quarter': (25, 30),   # 1.25-1.5 inches
            'half_dollar': (30, 35), # 1.5-1.75 inches
            'ping_pong': (35, 40), # 1.75-2 inches
            'golf_ball': (40, 50), # 2+ inches
            'tennis_ball': (50, 70) # 2.5+ inches
        }
        
        logger.info("CircularFeatureDetector initialized")
    
    def detect_circular_impacts(
        self,
        image: np.ndarray,
        method: str = 'multi_method'
    ) -> List[Dict[str, Any]]:
        """
        Detect circular impacts using multiple methods for robustness.
        
        Args:
            image: Input grayscale or RGB image
            method: Detection method ('hough', 'blob', 'contour', 'multi_method')
            
        Returns:
            List of detected impact dictionaries
        """
        try:
            # Ensure grayscale
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            else:
                gray = image.copy()
            
            if method == 'multi_method':
                # Combine multiple detection methods
                hough_impacts = self._detect_hough_circles(gray)
                blob_impacts = self._detect_blob_circles(gray)
                contour_impacts = self._detect_contour_circles(gray)
                
                # Merge and filter results
                all_impacts = hough_impacts + blob_impacts + contour_impacts
                merged_impacts = self._merge_overlapping_detections(all_impacts)
                
            elif method == 'hough':
                merged_impacts = self._detect_hough_circles(gray)
            elif method == 'blob':
                merged_impacts = self._detect_blob_circles(gray)
            elif method == 'contour':
                merged_impacts = self._detect_contour_circles(gray)
            else:
                logger.warning(f"Unknown method {method}, using multi_method")
                return self.detect_circular_impacts(image, 'multi_method')
            
            # Post-process detections
            processed_impacts = self._post_process_detections(merged_impacts, gray)
            
            return processed_impacts
            
        except Exception as e:
            logger.error(f"Error in circular impact detection: {e}")
            return []
    
    def _detect_hough_circles(self, gray_image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect circles using Hough Circle Transform."""
        try:
            # Apply Gaussian blur
            blurred = cv2.GaussianBlur(gray_image, (5, 5), 0)
            
            # Detect circles
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1,
                minDist=self.min_radius * 2,
                param1=50,
                param2=30,
                minRadius=self.min_radius,
                maxRadius=self.max_radius
            )
            
            impacts = []
            if circles is not None:
                circles = np.round(circles[0, :]).astype("int")
                
                for (x, y, r) in circles:
                    # Validate detection
                    if self._validate_circular_impact(gray_image, x, y, r):
                        impacts.append({
                            'center': (int(x), int(y)),
                            'radius': int(r),
                            'confidence': self._calculate_confidence(gray_image, x, y, r),
                            'method': 'hough',
                            'size_class': self._classify_hail_size(r)
                        })
            
            return impacts
            
        except Exception as e:
            logger.warning(f"Hough circle detection failed: {e}")
            return []
    
    def _detect_blob_circles(self, gray_image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect circles using blob detection algorithms."""
        try:
            impacts = []
            
            # Difference of Gaussian (DoG) blob detection
            try:
                blobs_dog = blob_dog(gray_image, min_sigma=1, max_sigma=30, threshold=0.1)
                for blob in blobs_dog:
                    y, x, sigma = blob
                    r = int(sigma * np.sqrt(2))
                    if self.min_radius <= r <= self.max_radius:
                        if self._validate_circular_impact(gray_image, x, y, r):
                            impacts.append({
                                'center': (int(x), int(y)),
                                'radius': r,
                                'confidence': self._calculate_confidence(gray_image, x, y, r),
                                'method': 'blob_dog',
                                'size_class': self._classify_hail_size(r)
                            })
            except Exception as e:
                logger.warning(f"DoG blob detection failed: {e}")
            
            # Laplacian of Gaussian (LoG) blob detection
            try:
                blobs_log = blob_log(gray_image, min_sigma=1, max_sigma=30, threshold=0.1)
                for blob in blobs_log:
                    y, x, sigma = blob
                    r = int(sigma * np.sqrt(2))
                    if self.min_radius <= r <= self.max_radius:
                        if self._validate_circular_impact(gray_image, x, y, r):
                            impacts.append({
                                'center': (int(x), int(y)),
                                'radius': r,
                                'confidence': self._calculate_confidence(gray_image, x, y, r),
                                'method': 'blob_log',
                                'size_class': self._classify_hail_size(r)
                            })
            except Exception as e:
                logger.warning(f"LoG blob detection failed: {e}")
            
            return impacts
            
        except Exception as e:
            logger.warning(f"Blob circle detection failed: {e}")
            return []
    
    def _detect_contour_circles(self, gray_image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect circles using contour analysis."""
        try:
            impacts = []
            
            # Edge detection
            edges = cv2.Canny(gray_image, 50, 150)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                # Calculate contour properties
                area = cv2.contourArea(contour)
                perimeter = cv2.arcLength(contour, True)
                
                if perimeter == 0:
                    continue
                
                # Check if contour is roughly circular
                circularity = 4 * np.pi * area / (perimeter ** 2)
                
                if 0.6 <= circularity <= 1.4:  # Circular threshold
                    # Get bounding circle
                    (x, y), radius = cv2.minEnclosingCircle(contour)
                    x, y, radius = int(x), int(y), int(radius)
                    
                    if self.min_radius <= radius <= self.max_radius:
                        if self._validate_circular_impact(gray_image, x, y, radius):
                            impacts.append({
                                'center': (x, y),
                                'radius': radius,
                                'confidence': self._calculate_confidence(gray_image, x, y, radius),
                                'method': 'contour',
                                'size_class': self._classify_hail_size(radius),
                                'circularity': circularity
                            })
            
            return impacts
            
        except Exception as e:
            logger.warning(f"Contour circle detection failed: {e}")
            return []
    
    def _validate_circular_impact(
        self,
        gray_image: np.ndarray,
        x: int,
        y: int,
        radius: int
    ) -> bool:
        """Validate if detected circle is likely a hail impact."""
        try:
            h, w = gray_image.shape
            
            # Check if circle is within image bounds
            if x - radius < 0 or x + radius >= w or y - radius < 0 or y + radius >= h:
                return False
            
            # Extract circular region
            mask = np.zeros_like(gray_image)
            cv2.circle(mask, (x, y), radius, 255, -1)
            
            # Get pixel values in circle
            circle_pixels = gray_image[mask > 0]
            
            if len(circle_pixels) == 0:
                return False
            
            # Get surrounding pixels for comparison
            ring_mask = np.zeros_like(gray_image)
            cv2.circle(ring_mask, (x, y), min(radius + 10, max(w, h) // 4), 255, -1)
            cv2.circle(ring_mask, (x, y), radius, 0, -1)
            
            ring_pixels = gray_image[ring_mask > 0]
            
            if len(ring_pixels) == 0:
                return False
            
            # Statistical validation
            circle_mean = np.mean(circle_pixels)
            ring_mean = np.mean(ring_pixels)
            circle_std = np.std(circle_pixels)
            
            # Hail impacts are typically darker than surroundings
            darkness_contrast = ring_mean - circle_mean
            
            # Check for sufficient contrast and reasonable uniformity
            if darkness_contrast > 10 and circle_std < 30:  # Adjustable thresholds
                return True
            
            return False
            
        except Exception as e:
            logger.warning(f"Impact validation failed: {e}")
            return False
    
    def _calculate_confidence(
        self,
        gray_image: np.ndarray,
        x: int,
        y: int,
        radius: int
    ) -> float:
        """Calculate confidence score for detected impact."""
        try:
            # Extract circular region and surrounding ring
            mask = np.zeros_like(gray_image)
            cv2.circle(mask, (x, y), radius, 255, -1)
            circle_pixels = gray_image[mask > 0]
            
            ring_mask = np.zeros_like(gray_image)
            cv2.circle(ring_mask, (x, y), min(radius + 15, min(gray_image.shape) // 3), 255, -1)
            cv2.circle(ring_mask, (x, y), radius, 0, -1)
            ring_pixels = gray_image[ring_mask > 0]
            
            if len(circle_pixels) == 0 or len(ring_pixels) == 0:
                return 0.0
            
            # Calculate various confidence metrics
            circle_mean = np.mean(circle_pixels)
            ring_mean = np.mean(ring_pixels)
            circle_std = np.std(circle_pixels)
            
            # Contrast confidence (higher is better)
            contrast_confidence = min((ring_mean - circle_mean) / 50, 1.0)
            
            # Uniformity confidence (lower std is better)
            uniformity_confidence = max(0, 1.0 - circle_std / 50)
            
            # Size confidence (middle sizes are more common)
            size_confidence = 1.0 - abs(radius - 20) / 30
            size_confidence = max(0, min(size_confidence, 1.0))
            
            # Combined confidence
            total_confidence = (contrast_confidence * 0.4 + 
                              uniformity_confidence * 0.3 + 
                              size_confidence * 0.3)
            
            return float(np.clip(total_confidence, 0, 1))
            
        except Exception as e:
            logger.warning(f"Confidence calculation failed: {e}")
            return 0.5
    
    def _classify_hail_size(self, radius: int) -> str:
        """Classify hail size based on radius."""
        for size_class, (min_r, max_r) in self.hail_size_classes.items():
            if min_r <= radius <= max_r:
                return size_class
        
        if radius < self.min_radius:
            return 'too_small'
        else:
            return 'oversized'
    
    def _merge_overlapping_detections(
        self,
        detections: List[Dict[str, Any]],
        overlap_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """Merge overlapping detections to avoid duplicates."""
        if not detections:
            return []
        
        # Sort by confidence (descending)
        detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)
        
        merged = []
        used = [False] * len(detections)
        
        for i, detection in enumerate(detections):
            if used[i]:
                continue
            
            # Find all overlapping detections
            overlapping = [detection]
            used[i] = True
            
            x1, y1 = detection['center']
            r1 = detection['radius']
            
            for j, other in enumerate(detections[i+1:], i+1):
                if used[j]:
                    continue
                
                x2, y2 = other['center']
                r2 = other['radius']
                
                # Calculate overlap
                distance = np.sqrt((x1 - x2)**2 + (y1 - y2)**2)
                overlap = max(0, min(r1, r2) - distance / 2) / min(r1, r2)
                
                if overlap > overlap_threshold:
                    overlapping.append(other)
                    used[j] = True
            
            # Merge overlapping detections
            if len(overlapping) == 1:
                merged.append(overlapping[0])
            else:
                merged_detection = self._merge_detection_group(overlapping)
                merged.append(merged_detection)
        
        return merged
    
    def _merge_detection_group(self, detections: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge a group of overlapping detections."""
        # Weighted average based on confidence
        weights = np.array([d['confidence'] for d in detections])
        weights = weights / np.sum(weights)
        
        # Merge centers
        centers = np.array([d['center'] for d in detections])
        merged_center = np.average(centers, axis=0, weights=weights).astype(int)
        
        # Merge radii
        radii = np.array([d['radius'] for d in detections])
        merged_radius = int(np.average(radii, weights=weights))
        
        # Use highest confidence
        merged_confidence = max(d['confidence'] for d in detections)
        
        # Combine methods
        methods = [d['method'] for d in detections]
        merged_method = '_'.join(set(methods))
        
        return {
            'center': tuple(merged_center),
            'radius': merged_radius,
            'confidence': merged_confidence,
            'method': merged_method,
            'size_class': self._classify_hail_size(merged_radius),
            'merged_from': len(detections)
        }
    
    def _post_process_detections(
        self,
        detections: List[Dict[str, Any]],
        gray_image: np.ndarray
    ) -> List[Dict[str, Any]]:
        """Post-process detections with additional analysis."""
        processed = []
        
        for detection in detections:
            try:
                # Add additional analysis
                analysis = self._analyze_impact_region(
                    gray_image, 
                    detection['center'], 
                    detection['radius']
                )
                
                # Combine detection with analysis
                enhanced_detection = {**detection, **analysis}
                
                # Filter out low-confidence detections
                if enhanced_detection['confidence'] >= self.detection_threshold:
                    processed.append(enhanced_detection)
                    
            except Exception as e:
                logger.warning(f"Post-processing failed for detection: {e}")
                # Keep original detection if post-processing fails
                if detection['confidence'] >= self.detection_threshold:
                    processed.append(detection)
        
        return processed
    
    def _analyze_impact_region(
        self,
        gray_image: np.ndarray,
        center: Tuple[int, int],
        radius: int
    ) -> Dict[str, Any]:
        """Analyze impact region for additional characteristics."""
        try:
            x, y = center
            
            # Extract circular region
            mask = np.zeros_like(gray_image)
            cv2.circle(mask, (x, y), radius, 255, -1)
            
            # Get impact region pixels
            impact_region = gray_image.copy()
            impact_region[mask == 0] = 0
            impact_pixels = gray_image[mask > 0]
            
            if len(impact_pixels) == 0:
                return {}
            
            # Statistical analysis
            intensity_stats = {
                'mean_intensity': float(np.mean(impact_pixels)),
                'std_intensity': float(np.std(impact_pixels)),
                'min_intensity': float(np.min(impact_pixels)),
                'max_intensity': float(np.max(impact_pixels))
            }
            
            # Texture analysis
            texture_features = self._extract_texture_features(impact_region, mask)
            
            # Gradient analysis (edge characteristics)
            gradient_features = self._analyze_gradients(impact_region, mask)
            
            # Shape analysis
            shape_features = self._analyze_shape_characteristics(mask, center, radius)
            
            return {
                **intensity_stats,
                **texture_features,
                **gradient_features,
                **shape_features
            }
            
        except Exception as e:
            logger.warning(f"Impact region analysis failed: {e}")
            return {}
    
    def _extract_texture_features(
        self,
        impact_region: np.ndarray,
        mask: np.ndarray
    ) -> Dict[str, float]:
        """Extract texture features from impact region."""
        try:
            from skimage.feature import greycomatrix, greycoprops, local_binary_pattern
            
            # Get masked region
            masked_region = impact_region[mask > 0]
            
            if len(masked_region) < 100:  # Minimum pixels for texture analysis
                return {'texture_contrast': 0.0, 'texture_homogeneity': 0.0}
            
            # Reshape for texture analysis
            h, w = impact_region.shape
            region_2d = impact_region.reshape(h, w)
            
            # Gray-Level Co-occurrence Matrix (GLCM)
            glcm = greycomatrix(
                region_2d.astype(np.uint8),
                distances=[1], angles=[0],
                levels=256, symmetric=True, normed=True
            )
            
            contrast = greycoprops(glcm, 'contrast')[0, 0]
            homogeneity = greycoprops(glcm, 'homogeneity')[0, 0]
            
            return {
                'texture_contrast': float(contrast),
                'texture_homogeneity': float(homogeneity)
            }
            
        except Exception as e:
            logger.warning(f"Texture feature extraction failed: {e}")
            return {'texture_contrast': 0.0, 'texture_homogeneity': 0.0}
    
    def _analyze_gradients(
        self,
        impact_region: np.ndarray,
        mask: np.ndarray
    ) -> Dict[str, float]:
        """Analyze gradient characteristics of impact region."""
        try:
            # Calculate gradients
            grad_x = cv2.Sobel(impact_region, cv2.CV_64F, 1, 0, ksize=3)
            grad_y = cv2.Sobel(impact_region, cv2.CV_64F, 0, 1, ksize=3)
            
            # Gradient magnitude
            gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
            
            # Mask gradients to impact region
            masked_gradients = gradient_magnitude[mask > 0]
            
            if len(masked_gradients) == 0:
                return {'gradient_mean': 0.0, 'gradient_std': 0.0}
            
            return {
                'gradient_mean': float(np.mean(masked_gradients)),
                'gradient_std': float(np.std(masked_gradients))
            }
            
        except Exception as e:
            logger.warning(f"Gradient analysis failed: {e}")
            return {'gradient_mean': 0.0, 'gradient_std': 0.0}
    
    def _analyze_shape_characteristics(
        self,
        mask: np.ndarray,
        center: Tuple[int, int],
        radius: int
    ) -> Dict[str, float]:
        """Analyze shape characteristics of the impact."""
        try:
            # Find contours of the mask
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                return {'circularity': 0.0, 'compactness': 0.0}
            
            # Use largest contour
            contour = max(contours, key=cv2.contourArea)
            
            # Calculate shape metrics
            area = cv2.contourArea(contour)
            perimeter = cv2.arcLength(contour, True)
            
            if perimeter == 0:
                return {'circularity': 0.0, 'compactness': 0.0}
            
            # Circularity: 4π * area / perimeter²
            circularity = 4 * np.pi * area / (perimeter ** 2)
            
            # Compactness: area / (π * radius²)
            expected_area = np.pi * radius ** 2
            compactness = area / expected_area if expected_area > 0 else 0
            
            return {
                'circularity': float(circularity),
                'compactness': float(compactness),
                'actual_area': float(area),
                'perimeter': float(perimeter)
            }
            
        except Exception as e:
            logger.warning(f"Shape analysis failed: {e}")
            return {'circularity': 0.0, 'compactness': 0.0}


class HailDamageAnalyzer:
    """
    Comprehensive hail damage analysis system combining detection,
    quantification, and severity assessment.
    """
    
    def __init__(self, config_path: str = None):
        """Initialize hail damage analyzer."""
        self.config = self._load_config(config_path)
        
        # Initialize components
        self.feature_detector = CircularFeatureDetector(
            min_radius=self.config.get('min_radius', 3),
            max_radius=self.config.get('max_radius', 50),
            detection_threshold=self.config.get('detection_threshold', 0.6)
        )
        
        # Severity classification parameters
        self.severity_thresholds = {
            'light': {'count': 5, 'avg_size': 10, 'coverage': 5},
            'moderate': {'count': 15, 'avg_size': 20, 'coverage': 15},
            'severe': {'count': 30, 'avg_size': 30, 'coverage': 30}
        }
        
        logger.info("HailDamageAnalyzer initialized")
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return json.load(f)
        else:
            return {
                'min_radius': 3,
                'max_radius': 50,
                'detection_threshold': 0.6,
                'analysis_resolution': 512
            }
    
    def analyze_hail_damage(
        self,
        image: Union[np.ndarray, str],
        roof_area_sqft: float = None
    ) -> Dict[str, Any]:
        """
        Comprehensive hail damage analysis.
        
        Args:
            image: Input image (numpy array or file path)
            roof_area_sqft: Actual roof area for accurate coverage calculation
            
        Returns:
            Comprehensive analysis results
        """
        try:
            # Load and preprocess image
            if isinstance(image, str):
                image = cv2.imread(image)
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Ensure numpy array
            if not isinstance(image, np.ndarray):
                raise ValueError("Invalid image format")
            
            # Preprocess image
            processed_image = self._preprocess_for_analysis(image)
            
            # Detect hail impacts
            impacts = self.feature_detector.detect_circular_impacts(processed_image)
            
            # Quantify damage
            quantification = self._quantify_damage(impacts, processed_image, roof_area_sqft)
            
            # Assess severity
            severity_assessment = self._assess_severity(impacts, quantification)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(severity_assessment, quantification)
            
            # Compile comprehensive results
            analysis_results = {
                'timestamp': str(pd.Timestamp.now()) if 'pd' in globals() else 'N/A',
                'image_info': {
                    'original_shape': image.shape,
                    'processed_shape': processed_image.shape,
                    'total_pixels': processed_image.size
                },
                'impact_detection': {
                    'total_impacts': len(impacts),
                    'impacts_by_size': self._group_impacts_by_size(impacts),
                    'impacts_by_confidence': self._group_impacts_by_confidence(impacts),
                    'detection_methods_used': list(set(impact['method'] for impact in impacts)),
                    'detailed_impacts': impacts
                },
                'damage_quantification': quantification,
                'severity_assessment': severity_assessment,
                'recommendations': recommendations,
                'analysis_metadata': {
                    'detection_threshold': self.feature_detector.detection_threshold,
                    'min_radius': self.feature_detector.min_radius,
                    'max_radius': self.feature_detector.max_radius,
                    'config_used': self.config
                }
            }
            
            return analysis_results
            
        except Exception as e:
            logger.error(f"Hail damage analysis failed: {e}")
            return {
                'error': str(e),
                'timestamp': str(pd.Timestamp.now()) if 'pd' in globals() else 'N/A',
                'analysis_failed': True
            }
    
    def _preprocess_for_analysis(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for optimal hail damage detection."""
        try:
            # Resize to standard resolution
            target_size = self.config.get('analysis_resolution', 512)
            resized = cv2.resize(image, (target_size, target_size), interpolation=cv2.INTER_LANCZOS4)
            
            # Convert to grayscale for detection
            if len(resized.shape) == 3:
                gray = cv2.cvtColor(resized, cv2.COLOR_RGB2GRAY)
            else:
                gray = resized
            
            # Apply noise reduction
            denoised = cv2.bilateralFilter(gray, 9, 75, 75)
            
            # Enhance contrast
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(denoised)
            
            return enhanced
            
        except Exception as e:
            logger.warning(f"Image preprocessing failed: {e}")
            # Return grayscale version of original
            if len(image.shape) == 3:
                return cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            else:
                return image
    
    def _quantify_damage(
        self,
        impacts: List[Dict[str, Any]],
        image: np.ndarray,
        roof_area_sqft: float = None
    ) -> Dict[str, Any]:
        """Quantify hail damage based on detected impacts."""
        try:
            if not impacts:
                return {
                    'total_impact_area': 0,
                    'coverage_percentage': 0.0,
                    'impact_density': 0.0,
                    'average_impact_size': 0,
                    'size_distribution': {},
                    'damage_concentration': {}
                }
            
            image_area = image.shape[0] * image.shape[1]
            
            # Calculate total impact area
            total_impact_area = sum(np.pi * impact['radius']**2 for impact in impacts)
            
            # Coverage percentage
            coverage_percentage = (total_impact_area / image_area) * 100
            
            # Impact density (impacts per 1000 pixels)
            impact_density = (len(impacts) / image_area) * 1000
            
            # Average impact size
            average_size = np.mean([impact['radius'] for impact in impacts])
            
            # Size distribution
            size_distribution = {}
            for impact in impacts:
                size_class = impact.get('size_class', 'unknown')
                size_distribution[size_class] = size_distribution.get(size_class, 0) + 1
            
            # Damage concentration analysis
            damage_concentration = self._analyze_damage_concentration(impacts, image.shape)
            
            # Real-world scaling if roof area provided
            real_world_metrics = {}
            if roof_area_sqft:
                pixel_to_sqft = roof_area_sqft / image_area
                real_world_metrics = {
                    'total_damaged_area_sqft': total_impact_area * pixel_to_sqft,
                    'impacts_per_sqft': len(impacts) / roof_area_sqft,
                    'average_impact_diameter_inches': average_size * 2 * np.sqrt(pixel_to_sqft) * 12  # Convert to inches
                }
            
            return {
                'total_impacts': len(impacts),
                'total_impact_area': int(total_impact_area),
                'coverage_percentage': float(coverage_percentage),
                'impact_density': float(impact_density),
                'average_impact_size': float(average_size),
                'size_distribution': size_distribution,
                'damage_concentration': damage_concentration,
                'real_world_metrics': real_world_metrics
            }
            
        except Exception as e:
            logger.error(f"Damage quantification failed: {e}")
            return {}
    
    def _analyze_damage_concentration(
        self,
        impacts: List[Dict[str, Any]],
        image_shape: Tuple[int, int]
    ) -> Dict[str, Any]:
        """Analyze concentration and distribution of damage."""
        try:
            if not impacts:
                return {}
            
            # Create density map
            height, width = image_shape
            grid_size = 32  # 32x32 grid
            
            grid_height = height // grid_size
            grid_width = width // grid_size
            
            density_grid = np.zeros((grid_height, grid_width))
            
            for impact in impacts:
                x, y = impact['center']
                grid_x = min(x // grid_size, grid_width - 1)
                grid_y = min(y // grid_size, grid_height - 1)
                density_grid[grid_y, grid_x] += 1
            
            # Calculate concentration metrics
            max_concentration = np.max(density_grid)
            mean_concentration = np.mean(density_grid)
            std_concentration = np.std(density_grid)
            
            # Find hotspots (cells with above-average concentration)
            hotspot_threshold = mean_concentration + std_concentration
            hotspots = np.where(density_grid > hotspot_threshold)
            num_hotspots = len(hotspots[0])
            
            return {
                'max_concentration': int(max_concentration),
                'mean_concentration': float(mean_concentration),
                'concentration_std': float(std_concentration),
                'num_hotspots': num_hotspots,
                'distribution_uniformity': float(1 - (std_concentration / (mean_concentration + 1e-6)))
            }
            
        except Exception as e:
            logger.warning(f"Concentration analysis failed: {e}")
            return {}
    
    def _assess_severity(
        self,
        impacts: List[Dict[str, Any]],
        quantification: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Assess overall severity of hail damage."""
        try:
            if not impacts:
                return {
                    'severity_level': 'none',
                    'severity_score': 0.0,
                    'severity_factors': {}
                }
            
            # Extract key metrics
            impact_count = len(impacts)
            coverage_percentage = quantification.get('coverage_percentage', 0)
            average_size = quantification.get('average_impact_size', 0)
            max_concentration = quantification.get('damage_concentration', {}).get('max_concentration', 0)
            
            # Calculate severity factors
            count_score = min(impact_count / 20, 1.0)  # Normalize to 20 impacts
            coverage_score = min(coverage_percentage / 25, 1.0)  # Normalize to 25% coverage
            size_score = min(average_size / 25, 1.0)  # Normalize to radius 25
            concentration_score = min(max_concentration / 10, 1.0)  # Normalize to 10 impacts per cell
            
            # Weighted severity score
            severity_score = (
                count_score * 0.3 +
                coverage_score * 0.3 +
                size_score * 0.25 +
                concentration_score * 0.15
            )
            
            # Classify severity level
            if severity_score < 0.3:
                severity_level = 'light'
            elif severity_score < 0.6:
                severity_level = 'moderate'
            else:
                severity_level = 'severe'
            
            # Additional factors
            large_impacts = sum(1 for impact in impacts if impact['radius'] > 20)
            high_confidence_impacts = sum(1 for impact in impacts if impact['confidence'] > 0.8)
            
            return {
                'severity_level': severity_level,
                'severity_score': float(severity_score),
                'severity_factors': {
                    'impact_count_score': float(count_score),
                    'coverage_score': float(coverage_score),
                    'size_score': float(size_score),
                    'concentration_score': float(concentration_score),
                    'large_impacts': large_impacts,
                    'high_confidence_impacts': high_confidence_impacts
                },
                'classification_thresholds': {
                    'light': '< 0.3',
                    'moderate': '0.3 - 0.6',
                    'severe': '> 0.6'
                }
            }
            
        except Exception as e:
            logger.error(f"Severity assessment failed: {e}")
            return {
                'severity_level': 'unknown',
                'severity_score': 0.0,
                'error': str(e)
            }
    
    def _generate_recommendations(
        self,
        severity_assessment: Dict[str, Any],
        quantification: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on analysis results."""
        recommendations = []
        
        try:
            severity_level = severity_assessment.get('severity_level', 'unknown')
            impact_count = quantification.get('total_impacts', 0)
            coverage_percentage = quantification.get('coverage_percentage', 0)
            
            # Severity-based recommendations
            if severity_level == 'severe':
                recommendations.extend([
                    "URGENT: Severe hail damage detected requiring immediate professional inspection",
                    "Contact insurance company immediately to file a claim",
                    "Consider temporary protective measures to prevent water infiltration",
                    "Schedule emergency roof repair to prevent further damage"
                ])
            elif severity_level == 'moderate':
                recommendations.extend([
                    "Moderate hail damage detected - professional inspection recommended within 7 days",
                    "Document damage with additional photos for insurance purposes",
                    "Consider filing an insurance claim for damage assessment",
                    "Monitor for leaks or further deterioration"
                ])
            elif severity_level == 'light':
                recommendations.extend([
                    "Light hail damage detected - monitor condition and schedule inspection within 30 days",
                    "Document current damage for future reference",
                    "Consider professional assessment if damage worsens"
                ])
            
            # Count-based recommendations
            if impact_count > 50:
                recommendations.append("High impact count suggests significant storm activity - comprehensive evaluation recommended")
            
            # Coverage-based recommendations
            if coverage_percentage > 20:
                recommendations.append("High damage coverage may qualify for full roof replacement under insurance")
            elif coverage_percentage > 10:
                recommendations.append("Moderate coverage may require partial roof repair or section replacement")
            
            # Size-based recommendations
            large_impacts = sum(1 for impact in quantification.get('detailed_impacts', []) 
                              if isinstance(impact, dict) and impact.get('radius', 0) > 25)
            if large_impacts > 0:
                recommendations.append(f"{large_impacts} large impacts detected - may indicate severe storm conditions")
            
            # General recommendations
            recommendations.extend([
                "Keep all analysis documentation for insurance and repair purposes",
                "Consider professional drone or satellite imagery for comprehensive roof assessment",
                "Regular monitoring recommended to track damage progression"
            ])
            
        except Exception as e:
            logger.warning(f"Recommendation generation failed: {e}")
            recommendations = ["Analysis completed - consult with roofing professional for detailed assessment"]
        
        return recommendations
    
    def _group_impacts_by_size(self, impacts: List[Dict[str, Any]]) -> Dict[str, int]:
        """Group impacts by size classification."""
        size_groups = defaultdict(int)
        for impact in impacts:
            size_class = impact.get('size_class', 'unknown')
            size_groups[size_class] += 1
        return dict(size_groups)
    
    def _group_impacts_by_confidence(self, impacts: List[Dict[str, Any]]) -> Dict[str, int]:
        """Group impacts by confidence level."""
        confidence_groups = {
            'high (>0.8)': 0,
            'medium (0.6-0.8)': 0,
            'low (<0.6)': 0
        }
        
        for impact in impacts:
            confidence = impact.get('confidence', 0)
            if confidence > 0.8:
                confidence_groups['high (>0.8)'] += 1
            elif confidence > 0.6:
                confidence_groups['medium (0.6-0.8)'] += 1
            else:
                confidence_groups['low (<0.6)'] += 1
        
        return confidence_groups
    
    def visualize_detection_results(
        self,
        original_image: np.ndarray,
        impacts: List[Dict[str, Any]],
        save_path: str = None
    ) -> np.ndarray:
        """Visualize detection results on original image."""
        try:
            # Create visualization image
            vis_image = original_image.copy()
            if len(vis_image.shape) == 2:
                vis_image = cv2.cvtColor(vis_image, cv2.COLOR_GRAY2RGB)
            
            # Color coding by confidence
            for impact in impacts:
                center = impact['center']
                radius = impact['radius']
                confidence = impact.get('confidence', 0.5)
                
                # Color based on confidence: red (high) to yellow (low)
                color_intensity = int(255 * confidence)
                color = (color_intensity, 255 - color_intensity//2, 0)  # Red to yellow
                
                # Draw impact circle
                cv2.circle(vis_image, center, radius, color, 2)
                
                # Add confidence text
                text_pos = (center[0] - 20, center[1] - radius - 5)
                cv2.putText(vis_image, f'{confidence:.2f}', text_pos, 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
            
            # Add legend and statistics
            self._add_visualization_legend(vis_image, impacts)
            
            # Save if path provided
            if save_path:
                cv2.imwrite(save_path, cv2.cvtColor(vis_image, cv2.COLOR_RGB2BGR))
                logger.info(f"Visualization saved to {save_path}")
            
            return vis_image
            
        except Exception as e:
            logger.error(f"Visualization failed: {e}")
            return original_image
    
    def _add_visualization_legend(self, image: np.ndarray, impacts: List[Dict[str, Any]]):
        """Add legend and statistics to visualization."""
        try:
            height, width = image.shape[:2]
            
            # Add text background
            cv2.rectangle(image, (10, 10), (300, 100), (0, 0, 0), -1)
            cv2.rectangle(image, (10, 10), (300, 100), (255, 255, 255), 2)
            
            # Add statistics text
            stats_text = [
                f"Total Impacts: {len(impacts)}",
                f"Avg Confidence: {np.mean([i.get('confidence', 0) for i in impacts]):.2f}",
                f"Size Range: {min(i['radius'] for i in impacts)}-{max(i['radius'] for i in impacts)} px",
                "Colors: Red (high conf) -> Yellow (low conf)"
            ]
            
            for i, text in enumerate(stats_text):
                cv2.putText(image, text, (15, 30 + i*15), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            
        except Exception as e:
            logger.warning(f"Legend addition failed: {e}")


def main():
    """Main function for testing hail damage analysis."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Hail Damage Analysis Tool')
    parser.add_argument('--image', type=str, required=True, help='Path to roof image')
    parser.add_argument('--output-dir', type=str, default='./hail_analysis_output', help='Output directory')
    parser.add_argument('--roof-area', type=float, help='Roof area in square feet')
    parser.add_argument('--visualize', action='store_true', help='Save visualization')
    
    args = parser.parse_args()
    
    try:
        # Create output directory
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize analyzer
        analyzer = HailDamageAnalyzer()
        
        # Load and analyze image
        image = cv2.imread(args.image)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Perform analysis
        results = analyzer.analyze_hail_damage(image, args.roof_area)
        
        # Save analysis results
        results_file = output_dir / 'hail_analysis_results.json'
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        # Create visualization if requested
        if args.visualize and 'impact_detection' in results:
            impacts = results['impact_detection']['detailed_impacts']
            vis_image = analyzer.visualize_detection_results(
                image, impacts, 
                str(output_dir / 'detection_visualization.png')
            )
        
        # Print summary
        print("\n" + "="*60)
        print("HAIL DAMAGE ANALYSIS SUMMARY")
        print("="*60)
        
        if 'error' not in results:
            print(f"Total Impacts Detected: {results['impact_detection']['total_impacts']}")
            print(f"Severity Level: {results['severity_assessment']['severity_level']}")
            print(f"Coverage Percentage: {results['damage_quantification']['coverage_percentage']:.2f}%")
            print(f"Average Impact Size: {results['damage_quantification']['average_impact_size']:.1f} pixels")
            
            print(f"\nSize Distribution:")
            for size_class, count in results['impact_detection']['impacts_by_size'].items():
                print(f"  {size_class}: {count} impacts")
            
            print(f"\nTop Recommendations:")
            for i, rec in enumerate(results['recommendations'][:3], 1):
                print(f"  {i}. {rec}")
        else:
            print(f"Analysis failed: {results['error']}")
        
        print(f"\nDetailed results saved to: {results_file}")
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()