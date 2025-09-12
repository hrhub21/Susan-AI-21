#!/usr/bin/env python3
"""
Advanced Damage Quantification and Measurement System for Susan AI
Precise measurement, counting, and cost estimation for all types of roof damage
Integrates with specialized damage detection models and training pipeline
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
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Union
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import ndimage, spatial, optimize
from skimage import measure, morphology, filters, segmentation
try:
    from skimage.feature import peak_local_maxima
except ImportError:
    # Fallback for newer scikit-image versions
    from scipy.ndimage import local_maxima
    def peak_local_maxima(image, min_distance=1, **kwargs):
        """Fallback implementation for peak_local_maxima"""
        import numpy as np
        from scipy.ndimage import maximum_filter
        local_max = (maximum_filter(image, size=min_distance*2+1) == image)
        peaks = np.where(local_max)
        return np.column_stack(peaks)
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler
import pandas as pd
from collections import defaultdict
import math
from dataclasses import dataclass
from enum import Enum
import warnings
warnings.filterwarnings('ignore')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class DamageType(Enum):
    """Enumeration of damage types."""
    HAIL = "hail"
    WIND = "wind"
    WEAR = "wear"
    IMPACT = "impact"
    UNKNOWN = "unknown"


class SeverityLevel(Enum):
    """Enumeration of severity levels."""
    NONE = "none"
    LIGHT = "light"
    MODERATE = "moderate"
    SEVERE = "severe"
    EXTREME = "extreme"


@dataclass
class DamageInstance:
    """Data class for individual damage instances."""
    damage_type: DamageType
    center: Tuple[int, int]
    area: float
    perimeter: float
    severity: SeverityLevel
    confidence: float
    bbox: Tuple[int, int, int, int]  # (x, y, width, height)
    properties: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.properties is None:
            self.properties = {}


@dataclass
class RoofMeasurements:
    """Data class for roof measurements and scaling."""
    pixel_to_inch_ratio: float
    pixel_to_sqft_ratio: float
    roof_area_sqft: float
    image_area_pixels: int
    calibration_method: str
    calibration_confidence: float


class GeometricAnalyzer:
    """
    Advanced geometric analysis for damage quantification.
    Handles shape measurement, area calculation, and spatial analysis.
    """
    
    def __init__(self):
        """Initialize geometric analyzer."""
        self.pi = math.pi
        logger.info("GeometricAnalyzer initialized")
    
    def calculate_area(
        self,
        contour: np.ndarray,
        method: str = 'contour'
    ) -> float:
        """Calculate area of damage region."""
        try:
            if method == 'contour':
                return cv2.contourArea(contour)
            elif method == 'pixels':
                # Create mask and count pixels
                mask = np.zeros((contour.max() + 10, contour.max() + 10), dtype=np.uint8)
                cv2.fillPoly(mask, [contour], 255)
                return np.sum(mask > 0)
            elif method == 'shoelace':
                # Shoelace formula for polygon area
                x = contour[:, 0, 0]
                y = contour[:, 0, 1]
                return 0.5 * np.abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
            else:
                return cv2.contourArea(contour)
                
        except Exception as e:
            logger.warning(f"Area calculation failed: {e}")
            return 0.0
    
    def calculate_perimeter(self, contour: np.ndarray) -> float:
        """Calculate perimeter of damage region."""
        try:
            return cv2.arcLength(contour, True)
        except Exception as e:
            logger.warning(f"Perimeter calculation failed: {e}")
            return 0.0
    
    def calculate_circularity(self, area: float, perimeter: float) -> float:
        """Calculate circularity metric (4π*area/perimeter²)."""
        try:
            if perimeter == 0:
                return 0.0
            return (4 * self.pi * area) / (perimeter ** 2)
        except Exception as e:
            logger.warning(f"Circularity calculation failed: {e}")
            return 0.0
    
    def calculate_solidity(self, contour: np.ndarray) -> float:
        """Calculate solidity (contour area / convex hull area)."""
        try:
            area = cv2.contourArea(contour)
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            
            if hull_area == 0:
                return 0.0
            
            return area / hull_area
            
        except Exception as e:
            logger.warning(f"Solidity calculation failed: {e}")
            return 0.0
    
    def calculate_aspect_ratio(self, contour: np.ndarray) -> float:
        """Calculate aspect ratio from bounding rectangle."""
        try:
            _, _, w, h = cv2.boundingRect(contour)
            if h == 0:
                return 0.0
            return w / h
        except Exception as e:
            logger.warning(f"Aspect ratio calculation failed: {e}")
            return 1.0
    
    def calculate_extent(self, contour: np.ndarray) -> float:
        """Calculate extent (contour area / bounding rectangle area)."""
        try:
            area = cv2.contourArea(contour)
            _, _, w, h = cv2.boundingRect(contour)
            rect_area = w * h
            
            if rect_area == 0:
                return 0.0
            
            return area / rect_area
            
        except Exception as e:
            logger.warning(f"Extent calculation failed: {e}")
            return 0.0
    
    def fit_ellipse_to_contour(self, contour: np.ndarray) -> Dict[str, Any]:
        """Fit ellipse to contour and return parameters."""
        try:
            if len(contour) < 5:
                return {}
            
            ellipse = cv2.fitEllipse(contour)
            (center_x, center_y), (major_axis, minor_axis), angle = ellipse
            
            # Calculate eccentricity
            a = max(major_axis, minor_axis) / 2  # Semi-major axis
            b = min(major_axis, minor_axis) / 2  # Semi-minor axis
            
            if a == 0:
                eccentricity = 0
            else:
                eccentricity = np.sqrt(1 - (b**2 / a**2))
            
            return {
                'center': (float(center_x), float(center_y)),
                'major_axis': float(major_axis),
                'minor_axis': float(minor_axis),
                'angle': float(angle),
                'eccentricity': float(eccentricity),
                'area': float(self.pi * a * b)
            }
            
        except Exception as e:
            logger.warning(f"Ellipse fitting failed: {e}")
            return {}
    
    def calculate_distance_metrics(
        self,
        damage_instances: List[DamageInstance]
    ) -> Dict[str, Any]:
        """Calculate spatial distribution metrics."""
        try:
            if len(damage_instances) < 2:
                return {
                    'mean_nearest_neighbor_distance': 0.0,
                    'std_nearest_neighbor_distance': 0.0,
                    'spatial_clustering_index': 0.0
                }
            
            # Extract centers
            centers = np.array([instance.center for instance in damage_instances])
            
            # Calculate pairwise distances
            distances = spatial.distance_matrix(centers, centers)
            
            # Find nearest neighbor distances (excluding self)
            np.fill_diagonal(distances, np.inf)
            nearest_distances = np.min(distances, axis=1)
            
            # Calculate metrics
            mean_nn_distance = np.mean(nearest_distances)
            std_nn_distance = np.std(nearest_distances)
            
            # Spatial clustering index (coefficient of variation)
            clustering_index = std_nn_distance / mean_nn_distance if mean_nn_distance > 0 else 0
            
            return {
                'mean_nearest_neighbor_distance': float(mean_nn_distance),
                'std_nearest_neighbor_distance': float(std_nn_distance),
                'spatial_clustering_index': float(clustering_index),
                'total_instances': len(damage_instances)
            }
            
        except Exception as e:
            logger.warning(f"Distance metrics calculation failed: {e}")
            return {}


class DamageCounter:
    """
    Advanced damage counting system with clustering and validation.
    Handles overlapping instances and provides confidence estimates.
    """
    
    def __init__(
        self,
        min_cluster_size: int = 2,
        max_cluster_distance: float = 50.0,
        overlap_threshold: float = 0.3
    ):
        """Initialize damage counter."""
        self.min_cluster_size = min_cluster_size
        self.max_cluster_distance = max_cluster_distance
        self.overlap_threshold = overlap_threshold
        
        logger.info("DamageCounter initialized")
    
    def count_damage_instances(
        self,
        binary_mask: np.ndarray,
        damage_type: DamageType = DamageType.UNKNOWN,
        min_area: int = 10
    ) -> List[DamageInstance]:
        """Count and characterize individual damage instances."""
        try:
            # Find connected components
            labeled_mask, num_labels = measure.label(binary_mask, return_num=True)
            
            damage_instances = []
            
            for label in range(1, num_labels + 1):
                # Extract single component
                component_mask = (labeled_mask == label).astype(np.uint8)
                
                # Filter by minimum area
                area = np.sum(component_mask)
                if area < min_area:
                    continue
                
                # Find contours
                contours, _ = cv2.findContours(
                    component_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
                )
                
                if not contours:
                    continue
                
                # Use largest contour
                contour = max(contours, key=cv2.contourArea)
                
                # Calculate properties
                instance_properties = self._calculate_instance_properties(contour, component_mask)
                
                # Create damage instance
                damage_instance = DamageInstance(
                    damage_type=damage_type,
                    center=instance_properties['centroid'],
                    area=instance_properties['area'],
                    perimeter=instance_properties['perimeter'],
                    severity=self._assess_instance_severity(instance_properties),
                    confidence=self._calculate_instance_confidence(instance_properties),
                    bbox=instance_properties['bbox'],
                    properties=instance_properties
                )
                
                damage_instances.append(damage_instance)
            
            # Remove overlapping instances
            filtered_instances = self._filter_overlapping_instances(damage_instances)
            
            logger.info(f"Counted {len(filtered_instances)} damage instances")
            return filtered_instances
            
        except Exception as e:
            logger.error(f"Damage counting failed: {e}")
            return []
    
    def _calculate_instance_properties(
        self,
        contour: np.ndarray,
        mask: np.ndarray
    ) -> Dict[str, Any]:
        """Calculate comprehensive properties for damage instance."""
        try:
            analyzer = GeometricAnalyzer()
            
            # Basic measurements
            area = analyzer.calculate_area(contour)
            perimeter = analyzer.calculate_perimeter(contour)
            
            # Shape metrics
            circularity = analyzer.calculate_circularity(area, perimeter)
            solidity = analyzer.calculate_solidity(contour)
            aspect_ratio = analyzer.calculate_aspect_ratio(contour)
            extent = analyzer.calculate_extent(contour)
            
            # Centroid and bounding box
            moments = cv2.moments(contour)
            if moments['m00'] != 0:
                centroid_x = int(moments['m10'] / moments['m00'])
                centroid_y = int(moments['m01'] / moments['m00'])
                centroid = (centroid_x, centroid_y)
            else:
                centroid = (0, 0)
            
            bbox = cv2.boundingRect(contour)
            
            # Ellipse fitting
            ellipse_params = analyzer.fit_ellipse_to_contour(contour)
            
            # Equivalent diameter
            equivalent_diameter = np.sqrt(4 * area / np.pi)
            
            return {
                'area': area,
                'perimeter': perimeter,
                'circularity': circularity,
                'solidity': solidity,
                'aspect_ratio': aspect_ratio,
                'extent': extent,
                'centroid': centroid,
                'bbox': bbox,
                'equivalent_diameter': equivalent_diameter,
                'ellipse_params': ellipse_params
            }
            
        except Exception as e:
            logger.warning(f"Property calculation failed: {e}")
            return {
                'area': 0.0,
                'perimeter': 0.0,
                'circularity': 0.0,
                'centroid': (0, 0),
                'bbox': (0, 0, 0, 0)
            }
    
    def _assess_instance_severity(self, properties: Dict[str, Any]) -> SeverityLevel:
        """Assess severity level based on instance properties."""
        try:
            area = properties.get('area', 0)
            
            # Simple area-based severity classification
            if area < 50:
                return SeverityLevel.LIGHT
            elif area < 200:
                return SeverityLevel.MODERATE
            elif area < 500:
                return SeverityLevel.SEVERE
            else:
                return SeverityLevel.EXTREME
                
        except Exception as e:
            logger.warning(f"Severity assessment failed: {e}")
            return SeverityLevel.LIGHT
    
    def _calculate_instance_confidence(self, properties: Dict[str, Any]) -> float:
        """Calculate confidence score for damage instance."""
        try:
            # Factors that increase confidence
            area = properties.get('area', 0)
            circularity = properties.get('circularity', 0)
            solidity = properties.get('solidity', 0)
            
            # Area confidence (medium sizes are more reliable)
            if 50 <= area <= 500:
                area_confidence = 1.0
            elif area < 50:
                area_confidence = area / 50.0
            else:
                area_confidence = max(0.5, 1.0 - (area - 500) / 1000)
            
            # Shape confidence (more regular shapes are more reliable)
            shape_confidence = (circularity + solidity) / 2
            
            # Combined confidence
            total_confidence = (area_confidence * 0.6 + shape_confidence * 0.4)
            
            return float(np.clip(total_confidence, 0, 1))
            
        except Exception as e:
            logger.warning(f"Confidence calculation failed: {e}")
            return 0.5
    
    def _filter_overlapping_instances(
        self,
        instances: List[DamageInstance]
    ) -> List[DamageInstance]:
        """Filter out overlapping damage instances."""
        try:
            if len(instances) <= 1:
                return instances
            
            # Sort by confidence (descending)
            sorted_instances = sorted(instances, key=lambda x: x.confidence, reverse=True)
            
            filtered_instances = []
            
            for instance in sorted_instances:
                # Check overlap with already accepted instances
                is_overlapping = False
                
                for accepted in filtered_instances:
                    overlap_ratio = self._calculate_overlap_ratio(instance, accepted)
                    if overlap_ratio > self.overlap_threshold:
                        is_overlapping = True
                        break
                
                if not is_overlapping:
                    filtered_instances.append(instance)
            
            return filtered_instances
            
        except Exception as e:
            logger.warning(f"Overlap filtering failed: {e}")
            return instances
    
    def _calculate_overlap_ratio(
        self,
        instance1: DamageInstance,
        instance2: DamageInstance
    ) -> float:
        """Calculate overlap ratio between two damage instances."""
        try:
            # Extract bounding boxes
            x1, y1, w1, h1 = instance1.bbox
            x2, y2, w2, h2 = instance2.bbox
            
            # Calculate intersection
            x_left = max(x1, x2)
            y_top = max(y1, y2)
            x_right = min(x1 + w1, x2 + w2)
            y_bottom = min(y1 + h1, y2 + h2)
            
            if x_right < x_left or y_bottom < y_top:
                return 0.0
            
            intersection_area = (x_right - x_left) * (y_bottom - y_top)
            
            # Calculate union
            area1 = instance1.area
            area2 = instance2.area
            union_area = area1 + area2 - intersection_area
            
            if union_area == 0:
                return 0.0
            
            return intersection_area / union_area
            
        except Exception as e:
            logger.warning(f"Overlap calculation failed: {e}")
            return 0.0
    
    def cluster_damage_instances(
        self,
        instances: List[DamageInstance]
    ) -> Dict[str, Any]:
        """Cluster damage instances to identify hotspots."""
        try:
            if len(instances) < self.min_cluster_size:
                return {
                    'num_clusters': 0,
                    'clusters': [],
                    'noise_points': len(instances)
                }
            
            # Extract centers for clustering
            centers = np.array([instance.center for instance in instances])
            
            # Apply DBSCAN clustering
            clustering = DBSCAN(
                eps=self.max_cluster_distance,
                min_samples=self.min_cluster_size
            ).fit(centers)
            
            labels = clustering.labels_
            
            # Group instances by cluster
            clusters = defaultdict(list)
            noise_points = 0
            
            for i, label in enumerate(labels):
                if label == -1:
                    noise_points += 1
                else:
                    clusters[label].append(instances[i])
            
            # Calculate cluster properties
            cluster_info = []
            for cluster_id, cluster_instances in clusters.items():
                cluster_centers = [inst.center for inst in cluster_instances]
                cluster_center = np.mean(cluster_centers, axis=0)
                
                cluster_area = sum(inst.area for inst in cluster_instances)
                avg_severity = np.mean([
                    list(SeverityLevel).index(inst.severity) 
                    for inst in cluster_instances
                ])
                
                cluster_info.append({
                    'cluster_id': int(cluster_id),
                    'center': tuple(cluster_center.astype(int)),
                    'num_instances': len(cluster_instances),
                    'total_area': cluster_area,
                    'avg_severity': avg_severity,
                    'instances': cluster_instances
                })
            
            return {
                'num_clusters': len(clusters),
                'clusters': cluster_info,
                'noise_points': noise_points,
                'clustering_method': 'DBSCAN'
            }
            
        except Exception as e:
            logger.warning(f"Clustering failed: {e}")
            return {'num_clusters': 0, 'clusters': [], 'noise_points': len(instances)}


class CostEstimator:
    """
    Advanced cost estimation system for roof damage repairs.
    Considers material costs, labor, complexity, and regional variations.
    """
    
    def __init__(self, region: str = 'national_average'):
        """Initialize cost estimator."""
        self.region = region
        
        # Base material costs per square foot (in USD)
        self.material_costs = {
            'asphalt_shingles': {
                'base': 3.50,
                'premium': 5.50,
                'luxury': 8.50
            },
            'metal_roofing': {
                'base': 8.00,
                'premium': 12.00,
                'luxury': 18.00
            },
            'tile_roofing': {
                'base': 6.00,
                'premium': 10.00,
                'luxury': 15.00
            },
            'slate_roofing': {
                'base': 12.00,
                'premium': 18.00,
                'luxury': 25.00
            }
        }
        
        # Labor costs per square foot
        self.labor_costs = {
            'removal': 1.50,
            'installation': 4.00,
            'complex_installation': 6.00,
            'specialty_work': 8.00
        }
        
        # Additional costs
        self.additional_costs = {
            'underlayment': 1.25,
            'flashing': 15.00,  # per linear foot
            'ventilation': 150.00,  # per vent
            'gutters': 8.00,  # per linear foot
            'permits': 0.75,  # per square foot
            'inspection': 300.00,  # flat fee
            'disposal': 0.50  # per square foot
        }
        
        # Regional multipliers
        self.regional_multipliers = {
            'national_average': 1.0,
            'northeast': 1.25,
            'southeast': 0.90,
            'midwest': 0.95,
            'southwest': 1.05,
            'west_coast': 1.40,
            'mountain': 1.15
        }
        
        logger.info(f"CostEstimator initialized for {region}")
    
    def estimate_repair_cost(
        self,
        damage_instances: List[DamageInstance],
        roof_measurements: RoofMeasurements,
        material_type: str = 'asphalt_shingles',
        material_grade: str = 'base'
    ) -> Dict[str, Any]:
        """Comprehensive cost estimation for roof damage repair."""
        try:
            # Calculate total damaged area
            total_damage_area_pixels = sum(inst.area for inst in damage_instances)
            total_damage_area_sqft = total_damage_area_pixels * roof_measurements.pixel_to_sqft_ratio
            
            # Assess damage complexity
            complexity_analysis = self._assess_repair_complexity(damage_instances)
            
            # Calculate base costs
            material_cost = self._calculate_material_cost(
                total_damage_area_sqft, material_type, material_grade
            )
            
            labor_cost = self._calculate_labor_cost(
                total_damage_area_sqft, complexity_analysis
            )
            
            additional_cost = self._calculate_additional_costs(
                total_damage_area_sqft, complexity_analysis, roof_measurements
            )
            
            # Apply regional multiplier
            regional_multiplier = self.regional_multipliers.get(self.region, 1.0)
            
            # Calculate subtotals
            subtotal = material_cost + labor_cost + additional_cost
            regional_adjusted_subtotal = subtotal * regional_multiplier
            
            # Add markup and contingency
            markup_percentage = 0.15  # 15% contractor markup
            contingency_percentage = 0.10  # 10% contingency
            
            markup_amount = regional_adjusted_subtotal * markup_percentage
            contingency_amount = regional_adjusted_subtotal * contingency_percentage
            
            # Calculate final total
            total_cost = regional_adjusted_subtotal + markup_amount + contingency_amount
            
            # Calculate cost per square foot
            cost_per_sqft = total_cost / roof_measurements.roof_area_sqft
            
            # Determine repair vs replacement recommendation
            replacement_threshold = 0.40  # 40% damage threshold
            damage_percentage = (total_damage_area_sqft / roof_measurements.roof_area_sqft) * 100
            
            if damage_percentage > replacement_threshold * 100:
                recommendation = 'full_replacement'
                replacement_cost = self._estimate_full_replacement_cost(
                    roof_measurements, material_type, material_grade
                )
            else:
                recommendation = 'repair'
                replacement_cost = None
            
            # Generate cost breakdown
            cost_breakdown = {
                'material_costs': {
                    'base_cost': material_cost,
                    'material_type': material_type,
                    'material_grade': material_grade
                },
                'labor_costs': {
                    'base_cost': labor_cost,
                    'complexity_multiplier': complexity_analysis['complexity_multiplier']
                },
                'additional_costs': {
                    'total': additional_cost,
                    'details': additional_cost  # Would be breakdown in real implementation
                },
                'regional_adjustment': {
                    'multiplier': regional_multiplier,
                    'region': self.region,
                    'adjusted_amount': regional_adjusted_subtotal - subtotal
                },
                'markup_and_contingency': {
                    'markup_percentage': markup_percentage,
                    'markup_amount': markup_amount,
                    'contingency_percentage': contingency_percentage,
                    'contingency_amount': contingency_amount
                }
            }
            
            return {
                'damage_analysis': {
                    'total_damage_area_sqft': total_damage_area_sqft,
                    'damage_percentage': damage_percentage,
                    'num_damage_instances': len(damage_instances),
                    'complexity_score': complexity_analysis['complexity_score']
                },
                'cost_estimate': {
                    'material_cost': round(material_cost, 2),
                    'labor_cost': round(labor_cost, 2),
                    'additional_cost': round(additional_cost, 2),
                    'subtotal': round(subtotal, 2),
                    'regional_adjusted_subtotal': round(regional_adjusted_subtotal, 2),
                    'markup_amount': round(markup_amount, 2),
                    'contingency_amount': round(contingency_amount, 2),
                    'total_cost': round(total_cost, 2),
                    'cost_per_sqft': round(cost_per_sqft, 2)
                },
                'recommendation': {
                    'type': recommendation,
                    'reason': f"Damage covers {damage_percentage:.1f}% of roof area",
                    'replacement_cost': replacement_cost
                },
                'cost_breakdown': cost_breakdown,
                'confidence': self._calculate_cost_confidence(complexity_analysis, roof_measurements),
                'estimate_date': str(pd.Timestamp.now()) if 'pd' in globals() else 'N/A'
            }
            
        except Exception as e:
            logger.error(f"Cost estimation failed: {e}")
            return {
                'error': str(e),
                'cost_estimate': {'total_cost': 0.0}
            }
    
    def _assess_repair_complexity(self, damage_instances: List[DamageInstance]) -> Dict[str, Any]:
        """Assess complexity of repair work."""
        try:
            if not damage_instances:
                return {
                    'complexity_score': 0.0,
                    'complexity_multiplier': 1.0,
                    'complexity_factors': []
                }
            
            complexity_factors = []
            complexity_score = 0.0
            
            # Number of damage instances
            num_instances = len(damage_instances)
            if num_instances > 20:
                complexity_factors.append('High number of damage instances')
                complexity_score += 0.3
            elif num_instances > 10:
                complexity_factors.append('Moderate number of damage instances')
                complexity_score += 0.15
            
            # Severity distribution
            severe_count = sum(1 for inst in damage_instances 
                              if inst.severity in [SeverityLevel.SEVERE, SeverityLevel.EXTREME])
            severe_ratio = severe_count / num_instances
            
            if severe_ratio > 0.5:
                complexity_factors.append('High proportion of severe damage')
                complexity_score += 0.4
            elif severe_ratio > 0.2:
                complexity_factors.append('Moderate proportion of severe damage')
                complexity_score += 0.2
            
            # Spatial distribution (clustering)
            analyzer = GeometricAnalyzer()
            distance_metrics = analyzer.calculate_distance_metrics(damage_instances)
            clustering_index = distance_metrics.get('spatial_clustering_index', 0)
            
            if clustering_index > 1.5:
                complexity_factors.append('Highly clustered damage pattern')
                complexity_score += 0.2
            elif clustering_index > 1.0:
                complexity_factors.append('Moderately clustered damage pattern')
                complexity_score += 0.1
            
            # Size variation
            areas = [inst.area for inst in damage_instances]
            area_cv = np.std(areas) / np.mean(areas) if areas else 0
            
            if area_cv > 1.0:
                complexity_factors.append('High variation in damage sizes')
                complexity_score += 0.15
            
            # Calculate complexity multiplier
            complexity_multiplier = 1.0 + min(complexity_score, 1.0)
            
            return {
                'complexity_score': complexity_score,
                'complexity_multiplier': complexity_multiplier,
                'complexity_factors': complexity_factors,
                'num_instances': num_instances,
                'severe_ratio': severe_ratio,
                'clustering_index': clustering_index
            }
            
        except Exception as e:
            logger.warning(f"Complexity assessment failed: {e}")
            return {
                'complexity_score': 0.5,
                'complexity_multiplier': 1.5,
                'complexity_factors': ['Unable to assess complexity']
            }
    
    def _calculate_material_cost(
        self,
        area_sqft: float,
        material_type: str,
        material_grade: str
    ) -> float:
        """Calculate material costs."""
        try:
            base_cost_per_sqft = self.material_costs.get(material_type, {}).get(material_grade, 3.50)
            return area_sqft * base_cost_per_sqft
        except Exception as e:
            logger.warning(f"Material cost calculation failed: {e}")
            return area_sqft * 3.50  # Default cost
    
    def _calculate_labor_cost(
        self,
        area_sqft: float,
        complexity_analysis: Dict[str, Any]
    ) -> float:
        """Calculate labor costs with complexity adjustments."""
        try:
            base_labor_cost = area_sqft * self.labor_costs['installation']
            complexity_multiplier = complexity_analysis.get('complexity_multiplier', 1.0)
            
            # Add removal cost for damaged areas
            removal_cost = area_sqft * self.labor_costs['removal']
            
            return (base_labor_cost + removal_cost) * complexity_multiplier
            
        except Exception as e:
            logger.warning(f"Labor cost calculation failed: {e}")
            return area_sqft * 5.50  # Default cost
    
    def _calculate_additional_costs(
        self,
        area_sqft: float,
        complexity_analysis: Dict[str, Any],
        roof_measurements: RoofMeasurements
    ) -> float:
        """Calculate additional costs (permits, disposal, etc.)."""
        try:
            additional_cost = 0.0
            
            # Underlayment
            additional_cost += area_sqft * self.additional_costs['underlayment']
            
            # Permits and inspection
            additional_cost += area_sqft * self.additional_costs['permits']
            additional_cost += self.additional_costs['inspection']
            
            # Disposal
            additional_cost += area_sqft * self.additional_costs['disposal']
            
            # Flashing (estimated based on damage complexity)
            complexity_score = complexity_analysis.get('complexity_score', 0)
            flashing_linear_feet = area_sqft * 0.1 * (1 + complexity_score)
            additional_cost += flashing_linear_feet * self.additional_costs['flashing']
            
            return additional_cost
            
        except Exception as e:
            logger.warning(f"Additional cost calculation failed: {e}")
            return area_sqft * 2.0  # Default additional cost
    
    def _estimate_full_replacement_cost(
        self,
        roof_measurements: RoofMeasurements,
        material_type: str,
        material_grade: str
    ) -> Dict[str, float]:
        """Estimate cost for full roof replacement."""
        try:
            roof_area = roof_measurements.roof_area_sqft
            
            # Material cost
            material_cost_per_sqft = self.material_costs.get(material_type, {}).get(material_grade, 3.50)
            total_material_cost = roof_area * material_cost_per_sqft
            
            # Labor cost (full replacement)
            removal_cost = roof_area * self.labor_costs['removal']
            installation_cost = roof_area * self.labor_costs['installation']
            total_labor_cost = removal_cost + installation_cost
            
            # Additional costs for full replacement
            underlayment_cost = roof_area * self.additional_costs['underlayment']
            flashing_cost = roof_area * 0.2 * self.additional_costs['flashing']  # More flashing for full replacement
            permit_cost = roof_area * self.additional_costs['permits']
            inspection_cost = self.additional_costs['inspection']
            disposal_cost = roof_area * self.additional_costs['disposal']
            
            total_additional = (underlayment_cost + flashing_cost + 
                               permit_cost + inspection_cost + disposal_cost)
            
            # Subtotal
            subtotal = total_material_cost + total_labor_cost + total_additional
            
            # Regional adjustment
            regional_multiplier = self.regional_multipliers.get(self.region, 1.0)
            adjusted_subtotal = subtotal * regional_multiplier
            
            # Markup and contingency
            markup = adjusted_subtotal * 0.15
            contingency = adjusted_subtotal * 0.10
            
            total_replacement_cost = adjusted_subtotal + markup + contingency
            
            return {
                'material_cost': round(total_material_cost, 2),
                'labor_cost': round(total_labor_cost, 2),
                'additional_cost': round(total_additional, 2),
                'subtotal': round(subtotal, 2),
                'regional_adjusted': round(adjusted_subtotal, 2),
                'markup': round(markup, 2),
                'contingency': round(contingency, 2),
                'total_cost': round(total_replacement_cost, 2),
                'cost_per_sqft': round(total_replacement_cost / roof_area, 2)
            }
            
        except Exception as e:
            logger.warning(f"Replacement cost estimation failed: {e}")
            return {'total_cost': 0.0}
    
    def _calculate_cost_confidence(
        self,
        complexity_analysis: Dict[str, Any],
        roof_measurements: RoofMeasurements
    ) -> float:
        """Calculate confidence level of cost estimate."""
        try:
            confidence = 0.8  # Base confidence
            
            # Reduce confidence for high complexity
            complexity_score = complexity_analysis.get('complexity_score', 0)
            confidence -= complexity_score * 0.2
            
            # Reduce confidence for low calibration confidence
            calibration_confidence = roof_measurements.calibration_confidence
            confidence = min(confidence, calibration_confidence)
            
            # Ensure minimum confidence
            confidence = max(confidence, 0.3)
            
            return confidence
            
        except Exception as e:
            logger.warning(f"Confidence calculation failed: {e}")
            return 0.5


class DamageQuantificationSystem:
    """
    Comprehensive damage quantification system integrating all analysis components.
    Provides complete measurement, counting, and cost estimation capabilities.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize damage quantification system."""
        self.config = config or {}
        
        # Initialize components
        self.geometric_analyzer = GeometricAnalyzer()
        self.damage_counter = DamageCounter()
        self.cost_estimator = CostEstimator(
            region=self.config.get('region', 'national_average')
        )
        
        logger.info("DamageQuantificationSystem initialized")
    
    def quantify_roof_damage(
        self,
        damage_mask: np.ndarray,
        roof_measurements: RoofMeasurements,
        damage_type: DamageType = DamageType.UNKNOWN,
        material_type: str = 'asphalt_shingles'
    ) -> Dict[str, Any]:
        """
        Comprehensive roof damage quantification analysis.
        
        Args:
            damage_mask: Binary mask of damaged areas
            roof_measurements: Roof measurement information
            damage_type: Type of damage being analyzed
            material_type: Roofing material type
            
        Returns:
            Comprehensive quantification results
        """
        try:
            # Count and characterize damage instances
            damage_instances = self.damage_counter.count_damage_instances(
                damage_mask, damage_type
            )
            
            # Calculate geometric metrics
            total_damage_area = sum(inst.area for inst in damage_instances)
            total_roof_area_pixels = roof_measurements.image_area_pixels
            damage_percentage = (total_damage_area / total_roof_area_pixels) * 100
            
            # Spatial analysis
            distance_metrics = self.geometric_analyzer.calculate_distance_metrics(damage_instances)
            
            # Clustering analysis
            clustering_results = self.damage_counter.cluster_damage_instances(damage_instances)
            
            # Cost estimation
            cost_analysis = self.cost_estimator.estimate_repair_cost(
                damage_instances, roof_measurements, material_type
            )
            
            # Severity distribution
            severity_distribution = self._analyze_severity_distribution(damage_instances)
            
            # Size distribution
            size_distribution = self._analyze_size_distribution(damage_instances)
            
            # Generate recommendations
            recommendations = self._generate_quantification_recommendations(
                damage_instances, damage_percentage, cost_analysis
            )
            
            # Compile comprehensive results
            quantification_results = {
                'analysis_summary': {
                    'damage_type': damage_type.value,
                    'total_instances': len(damage_instances),
                    'total_damage_area_pixels': int(total_damage_area),
                    'total_damage_area_sqft': total_damage_area * roof_measurements.pixel_to_sqft_ratio,
                    'damage_percentage': round(damage_percentage, 2),
                    'analysis_timestamp': str(pd.Timestamp.now()) if 'pd' in globals() else 'N/A'
                },
                'damage_instances': [
                    {
                        'id': i,
                        'damage_type': inst.damage_type.value,
                        'center': inst.center,
                        'area': inst.area,
                        'perimeter': inst.perimeter,
                        'severity': inst.severity.value,
                        'confidence': inst.confidence,
                        'bbox': inst.bbox,
                        'properties': inst.properties
                    }
                    for i, inst in enumerate(damage_instances)
                ],
                'spatial_analysis': {
                    'distance_metrics': distance_metrics,
                    'clustering_results': clustering_results,
                    'damage_density': len(damage_instances) / total_roof_area_pixels * 10000  # per 10k pixels
                },
                'severity_analysis': severity_distribution,
                'size_analysis': size_distribution,
                'cost_analysis': cost_analysis,
                'roof_measurements': {
                    'pixel_to_inch_ratio': roof_measurements.pixel_to_inch_ratio,
                    'pixel_to_sqft_ratio': roof_measurements.pixel_to_sqft_ratio,
                    'roof_area_sqft': roof_measurements.roof_area_sqft,
                    'calibration_method': roof_measurements.calibration_method,
                    'calibration_confidence': roof_measurements.calibration_confidence
                },
                'recommendations': recommendations,
                'quality_metrics': {
                    'detection_confidence': np.mean([inst.confidence for inst in damage_instances]) if damage_instances else 0.0,
                    'measurement_accuracy': roof_measurements.calibration_confidence,
                    'analysis_completeness': 1.0 if len(damage_instances) > 0 else 0.0
                }
            }
            
            return quantification_results
            
        except Exception as e:
            logger.error(f"Damage quantification failed: {e}")
            return {
                'error': str(e),
                'analysis_summary': {
                    'total_instances': 0,
                    'damage_percentage': 0.0
                }
            }
    
    def _analyze_severity_distribution(self, instances: List[DamageInstance]) -> Dict[str, Any]:
        """Analyze distribution of damage severity levels."""
        try:
            if not instances:
                return {level.value: 0 for level in SeverityLevel}
            
            # Count instances by severity
            severity_counts = {level.value: 0 for level in SeverityLevel}
            for instance in instances:
                severity_counts[instance.severity.value] += 1
            
            # Calculate percentages
            total = len(instances)
            severity_percentages = {
                level: (count / total) * 100 for level, count in severity_counts.items()
            }
            
            # Find predominant severity
            predominant_severity = max(severity_counts, key=severity_counts.get)
            
            # Calculate average severity score
            severity_scores = {
                SeverityLevel.NONE.value: 0,
                SeverityLevel.LIGHT.value: 1,
                SeverityLevel.MODERATE.value: 2,
                SeverityLevel.SEVERE.value: 3,
                SeverityLevel.EXTREME.value: 4
            }
            
            total_score = sum(severity_scores[inst.severity.value] for inst in instances)
            avg_severity_score = total_score / total if total > 0 else 0
            
            return {
                'severity_counts': severity_counts,
                'severity_percentages': severity_percentages,
                'predominant_severity': predominant_severity,
                'average_severity_score': avg_severity_score,
                'severity_range': f"{min(severity_scores[inst.severity.value] for inst in instances)}-{max(severity_scores[inst.severity.value] for inst in instances)}"
            }
            
        except Exception as e:
            logger.warning(f"Severity analysis failed: {e}")
            return {level.value: 0 for level in SeverityLevel}
    
    def _analyze_size_distribution(self, instances: List[DamageInstance]) -> Dict[str, Any]:
        """Analyze distribution of damage instance sizes."""
        try:
            if not instances:
                return {
                    'size_statistics': {},
                    'size_categories': {},
                    'size_distribution': []
                }
            
            areas = [inst.area for inst in instances]
            
            # Basic statistics
            size_statistics = {
                'min_area': float(np.min(areas)),
                'max_area': float(np.max(areas)),
                'mean_area': float(np.mean(areas)),
                'median_area': float(np.median(areas)),
                'std_area': float(np.std(areas)),
                'total_area': float(np.sum(areas))
            }
            
            # Size categories
            size_categories = {
                'small (< 50px²)': sum(1 for area in areas if area < 50),
                'medium (50-200px²)': sum(1 for area in areas if 50 <= area <= 200),
                'large (200-500px²)': sum(1 for area in areas if 200 < area <= 500),
                'very_large (> 500px²)': sum(1 for area in areas if area > 500)
            }
            
            # Size distribution (histogram data)
            hist, bins = np.histogram(areas, bins=10)
            size_distribution = [
                {
                    'bin_start': float(bins[i]),
                    'bin_end': float(bins[i+1]),
                    'count': int(hist[i])
                }
                for i in range(len(hist))
            ]
            
            return {
                'size_statistics': size_statistics,
                'size_categories': size_categories,
                'size_distribution': size_distribution
            }
            
        except Exception as e:
            logger.warning(f"Size analysis failed: {e}")
            return {}
    
    def _generate_quantification_recommendations(
        self,
        instances: List[DamageInstance],
        damage_percentage: float,
        cost_analysis: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on quantification results."""
        recommendations = []
        
        try:
            num_instances = len(instances)
            total_cost = cost_analysis.get('cost_estimate', {}).get('total_cost', 0)
            
            # Damage extent recommendations
            if damage_percentage > 40:
                recommendations.append("Extensive damage detected (>40% coverage) - full roof replacement strongly recommended")
            elif damage_percentage > 20:
                recommendations.append("Significant damage detected (>20% coverage) - major repairs or replacement needed")
            elif damage_percentage > 5:
                recommendations.append("Moderate damage detected (>5% coverage) - professional repair required")
            else:
                recommendations.append("Limited damage detected - targeted repairs may be sufficient")
            
            # Instance count recommendations
            if num_instances > 50:
                recommendations.append("High number of damage instances suggests widespread impact - comprehensive assessment needed")
            elif num_instances > 20:
                recommendations.append("Multiple damage instances detected - systematic repair approach recommended")
            
            # Cost-based recommendations
            if total_cost > 15000:
                recommendations.append("High repair costs estimated - consider insurance claim and multiple contractor quotes")
            elif total_cost > 5000:
                recommendations.append("Significant repair costs - insurance assessment recommended")
            
            # Severity-based recommendations
            severe_instances = sum(1 for inst in instances 
                                 if inst.severity in [SeverityLevel.SEVERE, SeverityLevel.EXTREME])
            if severe_instances > 0:
                recommendations.append(f"{severe_instances} severe damage instances require immediate attention")
            
            # General recommendations
            recommendations.extend([
                "Document all damage with photos for insurance purposes",
                "Obtain multiple quotes from licensed roofing contractors",
                "Monitor weather forecasts and protect damaged areas if storms are expected",
                "Keep all analysis documentation for warranty and insurance records"
            ])
            
        except Exception as e:
            logger.warning(f"Recommendation generation failed: {e}")
            recommendations = ["Professional roofing assessment recommended"]
        
        return recommendations
    
    def create_quantification_report(
        self,
        quantification_results: Dict[str, Any],
        save_path: str = None
    ) -> str:
        """Create a comprehensive quantification report."""
        try:
            report_lines = []
            
            # Header
            report_lines.append("=" * 80)
            report_lines.append("ROOF DAMAGE QUANTIFICATION REPORT")
            report_lines.append("=" * 80)
            report_lines.append("")
            
            # Analysis Summary
            summary = quantification_results.get('analysis_summary', {})
            report_lines.append("ANALYSIS SUMMARY")
            report_lines.append("-" * 40)
            report_lines.append(f"Damage Type: {summary.get('damage_type', 'Unknown')}")
            report_lines.append(f"Total Damage Instances: {summary.get('total_instances', 0)}")
            report_lines.append(f"Total Damage Area: {summary.get('total_damage_area_sqft', 0):.2f} sq ft")
            report_lines.append(f"Damage Coverage: {summary.get('damage_percentage', 0):.2f}%")
            report_lines.append(f"Analysis Date: {summary.get('analysis_timestamp', 'N/A')}")
            report_lines.append("")
            
            # Cost Analysis
            cost_analysis = quantification_results.get('cost_analysis', {})
            cost_estimate = cost_analysis.get('cost_estimate', {})
            
            report_lines.append("COST ANALYSIS")
            report_lines.append("-" * 40)
            report_lines.append(f"Material Cost: ${cost_estimate.get('material_cost', 0):,.2f}")
            report_lines.append(f"Labor Cost: ${cost_estimate.get('labor_cost', 0):,.2f}")
            report_lines.append(f"Additional Cost: ${cost_estimate.get('additional_cost', 0):,.2f}")
            report_lines.append(f"Total Estimated Cost: ${cost_estimate.get('total_cost', 0):,.2f}")
            report_lines.append(f"Cost per Sq Ft: ${cost_estimate.get('cost_per_sqft', 0):.2f}")
            report_lines.append("")
            
            # Recommendations
            recommendations = quantification_results.get('recommendations', [])
            if recommendations:
                report_lines.append("RECOMMENDATIONS")
                report_lines.append("-" * 40)
                for i, rec in enumerate(recommendations, 1):
                    report_lines.append(f"{i}. {rec}")
                report_lines.append("")
            
            # Severity Analysis
            severity_analysis = quantification_results.get('severity_analysis', {})
            severity_counts = severity_analysis.get('severity_counts', {})
            
            if severity_counts:
                report_lines.append("SEVERITY DISTRIBUTION")
                report_lines.append("-" * 40)
                for severity, count in severity_counts.items():
                    if count > 0:
                        report_lines.append(f"{severity.title()}: {count} instances")
                report_lines.append("")
            
            # Create final report
            report_text = "\n".join(report_lines)
            
            # Save report if path provided
            if save_path:
                with open(save_path, 'w') as f:
                    f.write(report_text)
                logger.info(f"Quantification report saved to {save_path}")
            
            return report_text
            
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            return "Report generation failed"


def main():
    """Main function for testing damage quantification system."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Roof Damage Quantification System')
    parser.add_argument('--mask', type=str, required=True, help='Path to damage mask image')
    parser.add_argument('--roof-area', type=float, default=1500, help='Roof area in square feet')
    parser.add_argument('--output-dir', type=str, default='./quantification_output', help='Output directory')
    parser.add_argument('--material', type=str, default='asphalt_shingles', help='Roofing material type')
    
    args = parser.parse_args()
    
    try:
        # Create output directory
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load damage mask
        mask = cv2.imread(args.mask, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            raise ValueError(f"Could not load mask from {args.mask}")
        
        # Create roof measurements (simplified for demo)
        roof_measurements = RoofMeasurements(
            pixel_to_inch_ratio=0.1,  # Example value
            pixel_to_sqft_ratio=args.roof_area / (mask.shape[0] * mask.shape[1]),
            roof_area_sqft=args.roof_area,
            image_area_pixels=mask.shape[0] * mask.shape[1],
            calibration_method='manual',
            calibration_confidence=0.8
        )
        
        # Initialize quantification system
        quantification_system = DamageQuantificationSystem()
        
        # Perform quantification
        results = quantification_system.quantify_roof_damage(
            mask, roof_measurements, DamageType.HAIL, args.material
        )
        
        # Save results
        results_file = output_dir / 'quantification_results.json'
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        # Generate report
        report_file = output_dir / 'quantification_report.txt'
        report_text = quantification_system.create_quantification_report(results, str(report_file))
        
        # Print summary
        print("\n" + "="*60)
        print("DAMAGE QUANTIFICATION SUMMARY")
        print("="*60)
        
        summary = results.get('analysis_summary', {})
        cost = results.get('cost_analysis', {}).get('cost_estimate', {})
        
        print(f"Damage Instances: {summary.get('total_instances', 0)}")
        print(f"Damage Coverage: {summary.get('damage_percentage', 0):.2f}%")
        print(f"Estimated Cost: ${cost.get('total_cost', 0):,.2f}")
        print(f"Cost per Sq Ft: ${cost.get('cost_per_sqft', 0):.2f}")
        
        print(f"\nDetailed results saved to: {results_file}")
        print(f"Report saved to: {report_file}")
        
    except Exception as e:
        logger.error(f"Quantification test failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()