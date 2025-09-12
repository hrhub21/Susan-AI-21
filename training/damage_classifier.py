#!/usr/bin/env python3
"""
Advanced Damage Classification Models for Susan AI Roof Analysis
Specialized models for different types of roof damage detection and quantification
Integrates with the main training system and Qwen 2.5 VL fine-tuning
"""

import os
import sys
import json
import yaml
import logging
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Union
import cv2
from PIL import Image
import timm
import albumentations as A
from transformers import (
    CLIPProcessor, CLIPModel,
    Qwen2VLForConditionalGeneration,
    Qwen2VLProcessor
)
from sklearn.metrics import precision_recall_curve, average_precision_score
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import ndimage
from skimage import measure, morphology
from skimage.segmentation import watershed
from scipy.ndimage import maximum_filter
import warnings
warnings.filterwarnings('ignore')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class HailDamageDetector(nn.Module):
    """
    Specialized neural network for hail damage detection and quantification.
    Focuses on circular impact patterns, granule displacement, and size estimation.
    """
    
    def __init__(
        self,
        backbone: str = 'efficientnet_b4',
        num_impact_sizes: int = 5,
        pretrained: bool = True
    ):
        """Initialize the hail damage detector."""
        super(HailDamageDetector, self).__init__()
        
        # Backbone for feature extraction
        self.backbone = timm.create_model(
            backbone,
            pretrained=pretrained,
            features_only=True,
            out_indices=[2, 3, 4]  # Multi-scale features
        )
        
        # Get feature dimensions
        with torch.no_grad():
            dummy_input = torch.randn(1, 3, 512, 512)
            features = self.backbone(dummy_input)
            self.feature_dims = [f.shape[1] for f in features]
        
        # Feature Pyramid Network for multi-scale detection
        self.fpn = FeaturePyramidNetwork(self.feature_dims, 256)
        
        # Hail-specific detection heads
        # 1. Impact detection head (binary classification per pixel)
        self.impact_detector = nn.Sequential(
            nn.Conv2d(256, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 1, 1),
            nn.Sigmoid()
        )
        
        # 2. Impact size classifier
        self.size_classifier = nn.Sequential(
            nn.Conv2d(256, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, num_impact_sizes, 1),
            nn.Softmax(dim=1)
        )
        
        # 3. Granule loss estimator
        self.granule_estimator = nn.Sequential(
            nn.Conv2d(256, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 1, 1),
            nn.Sigmoid()
        )
        
        # 4. Damage severity head
        self.severity_head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(128, 4),  # none, light, moderate, severe
            nn.Softmax(dim=1)
        )
        
        # Impact size definitions (in pixels at 512x512 resolution)
        self.impact_sizes = {
            0: (0, 5),      # No impact
            1: (5, 15),     # Small (< 1 inch)
            2: (15, 30),    # Medium (1-2 inches)
            3: (30, 50),    # Large (2-3 inches)
            4: (50, 100)    # Very large (> 3 inches)
        }
        
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """Forward pass of hail damage detector."""
        # Extract multi-scale features
        backbone_features = self.backbone(x)
        
        # Apply FPN
        fpn_features = self.fpn(backbone_features)
        
        # Use the highest resolution feature map
        features = fpn_features[0]  # Usually 1/4 of input resolution
        
        # Upsample features to match input resolution
        features = F.interpolate(
            features,
            size=(x.shape[2], x.shape[3]),
            mode='bilinear',
            align_corners=False
        )
        
        # Generate predictions
        outputs = {
            'impact_map': self.impact_detector(features),  # (B, 1, H, W)
            'size_map': self.size_classifier(features),    # (B, 5, H, W)
            'granule_map': self.granule_estimator(features),  # (B, 1, H, W)
            'severity_logits': self.severity_head(features)  # (B, 4)
        }
        
        return outputs
    
    def post_process_predictions(
        self,
        outputs: Dict[str, torch.Tensor],
        confidence_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """Post-process predictions to extract hail damage metrics."""
        device = outputs['impact_map'].device
        batch_size = outputs['impact_map'].shape[0]
        
        results = []
        
        for b in range(batch_size):
            # Extract single image predictions
            impact_map = outputs['impact_map'][b, 0].cpu().numpy()
            size_map = outputs['size_map'][b].cpu().numpy()
            granule_map = outputs['granule_map'][b, 0].cpu().numpy()
            severity_logits = outputs['severity_logits'][b].cpu().numpy()
            
            # Threshold impact map
            impact_binary = (impact_map > confidence_threshold).astype(np.uint8)
            
            # Find connected components (individual impacts)
            labeled_impacts, num_impacts = measure.label(impact_binary, return_num=True)
            
            # Analyze each impact
            impacts = []
            for i in range(1, num_impacts + 1):
                impact_mask = (labeled_impacts == i)
                
                if np.sum(impact_mask) < 5:  # Filter very small detections
                    continue
                
                # Get impact properties
                props = measure.regionprops(impact_mask.astype(int))[0]
                
                # Estimate impact size
                size_probs = size_map[:, impact_mask].mean(axis=1)
                estimated_size_class = np.argmax(size_probs)
                
                # Calculate granule loss in impact area
                granule_loss = granule_map[impact_mask].mean()
                
                # Impact diameter estimation
                equivalent_diameter = props.equivalent_diameter
                
                impacts.append({
                    'centroid': props.centroid,
                    'area': props.area,
                    'equivalent_diameter': equivalent_diameter,
                    'size_class': int(estimated_size_class),
                    'size_confidence': float(size_probs[estimated_size_class]),
                    'granule_loss': float(granule_loss),
                    'bbox': props.bbox
                })
            
            # Overall damage metrics
            total_affected_area = np.sum(impact_binary)
            image_area = impact_map.shape[0] * impact_map.shape[1]
            affected_percentage = (total_affected_area / image_area) * 100
            
            # Severity assessment
            severity_class = np.argmax(severity_logits)
            severity_confidence = severity_logits[severity_class]
            
            # Average granule loss across all impacts
            avg_granule_loss = granule_map[impact_binary > 0].mean() if total_affected_area > 0 else 0
            
            result = {
                'num_impacts': len(impacts),
                'impacts': impacts,
                'affected_percentage': float(affected_percentage),
                'avg_granule_loss': float(avg_granule_loss),
                'severity_class': int(severity_class),
                'severity_confidence': float(severity_confidence),
                'impact_density': len(impacts) / image_area * 10000,  # impacts per 10k pixels
                'size_distribution': self._calculate_size_distribution(impacts)
            }
            
            results.append(result)
        
        return results
    
    def _calculate_size_distribution(self, impacts: List[Dict]) -> Dict[str, int]:
        """Calculate distribution of impact sizes."""
        size_dist = {f'size_{i}': 0 for i in range(5)}
        
        for impact in impacts:
            size_class = impact['size_class']
            size_dist[f'size_{size_class}'] += 1
        
        return size_dist


class WindDamageDetector(nn.Module):
    """
    Specialized neural network for wind damage detection.
    Focuses on lifted, missing, or torn shingles, edge damage, and directional patterns.
    """
    
    def __init__(self, backbone: str = 'resnet50', pretrained: bool = True):
        """Initialize the wind damage detector."""
        super(WindDamageDetector, self).__init__()
        
        # Backbone
        self.backbone = timm.create_model(
            backbone,
            pretrained=pretrained,
            features_only=True,
            out_indices=[1, 2, 3, 4]
        )
        
        # Get feature dimensions
        with torch.no_grad():
            dummy_input = torch.randn(1, 3, 512, 512)
            features = self.backbone(dummy_input)
            self.feature_dims = [f.shape[1] for f in features]
        
        # U-Net style decoder for segmentation
        self.decoder = UNetDecoder(self.feature_dims)
        
        # Wind damage specific heads
        # 1. Lifted shingle detector
        self.lifted_detector = nn.Sequential(
            nn.Conv2d(64, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 1, 1),
            nn.Sigmoid()
        )
        
        # 2. Missing shingle detector
        self.missing_detector = nn.Sequential(
            nn.Conv2d(64, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 1, 1),
            nn.Sigmoid()
        )
        
        # 3. Edge damage detector
        self.edge_detector = nn.Sequential(
            nn.Conv2d(64, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 1, 1),
            nn.Sigmoid()
        )
        
        # 4. Wind direction estimator
        self.direction_estimator = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(64, 32),
            nn.ReLU(inplace=True),
            nn.Linear(32, 8),  # 8 wind directions
            nn.Softmax(dim=1)
        )
        
        # Wind directions (degrees)
        self.wind_directions = [0, 45, 90, 135, 180, 225, 270, 315]
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """Forward pass of wind damage detector."""
        # Extract features
        features = self.backbone(x)
        
        # Decode features
        decoded = self.decoder(features)
        
        # Generate predictions
        outputs = {
            'lifted_map': self.lifted_detector(decoded),
            'missing_map': self.missing_detector(decoded),
            'edge_map': self.edge_detector(decoded),
            'direction_logits': self.direction_estimator(decoded)
        }
        
        return outputs
    
    def analyze_wind_patterns(self, outputs: Dict[str, torch.Tensor]) -> Dict[str, Any]:
        """Analyze wind damage patterns and estimate wind direction."""
        results = []
        batch_size = outputs['lifted_map'].shape[0]
        
        for b in range(batch_size):
            lifted_map = outputs['lifted_map'][b, 0].cpu().numpy()
            missing_map = outputs['missing_map'][b, 0].cpu().numpy()
            edge_map = outputs['edge_map'][b, 0].cpu().numpy()
            direction_logits = outputs['direction_logits'][b].cpu().numpy()
            
            # Count different types of damage
            lifted_area = np.sum(lifted_map > 0.5)
            missing_area = np.sum(missing_map > 0.5)
            edge_damage_area = np.sum(edge_map > 0.5)
            
            # Estimate predominant wind direction
            direction_class = np.argmax(direction_logits)
            direction_confidence = direction_logits[direction_class]
            estimated_direction = self.wind_directions[direction_class]
            
            # Calculate damage severity
            total_damage = lifted_area + missing_area + edge_damage_area
            image_area = lifted_map.shape[0] * lifted_map.shape[1]
            damage_percentage = (total_damage / image_area) * 100
            
            result = {
                'lifted_shingle_area': float(lifted_area),
                'missing_shingle_area': float(missing_area),
                'edge_damage_area': float(edge_damage_area),
                'total_damage_percentage': float(damage_percentage),
                'estimated_wind_direction': float(estimated_direction),
                'direction_confidence': float(direction_confidence),
                'damage_type_distribution': {
                    'lifted': float(lifted_area / total_damage * 100) if total_damage > 0 else 0,
                    'missing': float(missing_area / total_damage * 100) if total_damage > 0 else 0,
                    'edge': float(edge_damage_area / total_damage * 100) if total_damage > 0 else 0
                }
            }
            
            results.append(result)
        
        return results


class WearDamageDetector(nn.Module):
    """
    Specialized neural network for wear and aging damage detection.
    Focuses on granule loss, curling, cracking, and general deterioration.
    """
    
    def __init__(self, backbone: str = 'densenet121', pretrained: bool = True):
        """Initialize the wear damage detector."""
        super(WearDamageDetector, self).__init__()
        
        # Backbone
        self.backbone = timm.create_model(
            backbone,
            pretrained=pretrained,
            num_classes=0,
            global_pool='',
            features_only=True
        )
        
        # Get feature dimensions
        with torch.no_grad():
            dummy_input = torch.randn(1, 3, 512, 512)
            features = self.backbone(dummy_input)
            self.feature_dim = features[-1].shape[1]
        
        # Wear-specific analysis heads
        # 1. Granule loss detector
        self.granule_loss_head = nn.Sequential(
            nn.Conv2d(self.feature_dim, 256, 3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 1, 1),
            nn.Sigmoid()
        )
        
        # 2. Curling detector
        self.curling_head = nn.Sequential(
            nn.Conv2d(self.feature_dim, 256, 3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 1, 1),
            nn.Sigmoid()
        )
        
        # 3. Cracking detector
        self.cracking_head = nn.Sequential(
            nn.Conv2d(self.feature_dim, 256, 3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 1, 1),
            nn.Sigmoid()
        )
        
        # 4. Age estimation head
        self.age_estimator = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(self.feature_dim, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, 1),
            nn.ReLU()  # Age in years
        )
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """Forward pass of wear damage detector."""
        # Extract features
        features = self.backbone(x)[-1]  # Use highest level features
        
        # Upsample features to input resolution
        features = F.interpolate(
            features,
            size=(x.shape[2], x.shape[3]),
            mode='bilinear',
            align_corners=False
        )
        
        # Generate predictions
        outputs = {
            'granule_loss_map': self.granule_loss_head(features),
            'curling_map': self.curling_head(features),
            'cracking_map': self.cracking_head(features),
            'estimated_age': self.age_estimator(features)
        }
        
        return outputs
    
    def assess_wear_condition(self, outputs: Dict[str, torch.Tensor]) -> Dict[str, Any]:
        """Assess overall wear condition of the roof."""
        results = []
        batch_size = outputs['granule_loss_map'].shape[0]
        
        for b in range(batch_size):
            granule_map = outputs['granule_loss_map'][b, 0].cpu().numpy()
            curling_map = outputs['curling_map'][b, 0].cpu().numpy()
            cracking_map = outputs['cracking_map'][b, 0].cpu().numpy()
            estimated_age = outputs['estimated_age'][b].cpu().numpy()
            
            # Calculate wear metrics
            avg_granule_loss = np.mean(granule_map)
            curling_percentage = np.sum(curling_map > 0.5) / granule_map.size * 100
            cracking_percentage = np.sum(cracking_map > 0.5) / granule_map.size * 100
            
            # Overall wear score (0-100)
            wear_score = (avg_granule_loss * 40 + 
                         curling_percentage * 0.3 + 
                         cracking_percentage * 0.3)
            
            # Determine wear category
            if wear_score < 20:
                wear_category = 'minimal'
            elif wear_score < 40:
                wear_category = 'light'
            elif wear_score < 70:
                wear_category = 'moderate'
            else:
                wear_category = 'severe'
            
            result = {
                'avg_granule_loss': float(avg_granule_loss),
                'curling_percentage': float(curling_percentage),
                'cracking_percentage': float(cracking_percentage),
                'estimated_age_years': float(estimated_age[0]),
                'overall_wear_score': float(wear_score),
                'wear_category': wear_category,
                'replacement_recommendation': wear_score > 70
            }
            
            results.append(result)
        
        return results


class DamageQuantificationModel(nn.Module):
    """
    Advanced model for quantifying roof damage across all damage types.
    Provides precise measurements, counts, and cost estimations.
    """
    
    def __init__(self, backbone: str = 'efficientnet_v2_s', pretrained: bool = True):
        """Initialize the damage quantification model."""
        super(DamageQuantificationModel, self).__init__()
        
        # Backbone
        self.backbone = timm.create_model(
            backbone,
            pretrained=pretrained,
            features_only=True,
            out_indices=[2, 3, 4]
        )
        
        # Get feature dimensions
        with torch.no_grad():
            dummy_input = torch.randn(1, 3, 512, 512)
            features = self.backbone(dummy_input)
            self.feature_dims = [f.shape[1] for f in features]
        
        # Feature fusion
        self.feature_fusion = nn.Sequential(
            nn.Conv2d(sum(self.feature_dims), 512, 3, padding=1),
            nn.BatchNorm2d(512),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 256, 3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True)
        )
        
        # Quantification heads
        # 1. Area measurement head
        self.area_head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 1),
            nn.Sigmoid()  # Percentage of affected area
        )
        
        # 2. Count estimation head
        self.count_head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 1),
            nn.ReLU()  # Number of damage instances
        )
        
        # 3. Severity scoring head
        self.severity_head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 1),
            nn.Sigmoid()  # Severity score 0-1
        )
        
        # 4. Cost estimation head
        self.cost_head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
            nn.ReLU()  # Relative cost factor
        )
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """Forward pass of quantification model."""
        # Extract multi-scale features
        features = self.backbone(x)
        
        # Resize all features to same size
        target_size = features[0].shape[2:4]
        resized_features = []
        
        for feat in features:
            if feat.shape[2:4] != target_size:
                feat = F.interpolate(feat, size=target_size, mode='bilinear', align_corners=False)
            resized_features.append(feat)
        
        # Concatenate features
        fused_features = torch.cat(resized_features, dim=1)
        
        # Apply fusion layer
        fused_features = self.feature_fusion(fused_features)
        
        # Generate quantification predictions
        outputs = {
            'affected_area': self.area_head(fused_features) * 100,  # Convert to percentage
            'damage_count': self.count_head(fused_features),
            'severity_score': self.severity_head(fused_features),
            'cost_factor': self.cost_head(fused_features)
        }
        
        return outputs
    
    def estimate_repair_cost(
        self,
        outputs: Dict[str, torch.Tensor],
        roof_area_sqft: float,
        material_costs: Dict[str, float] = None
    ) -> Dict[str, Any]:
        """Estimate repair costs based on quantification outputs."""
        if material_costs is None:
            # Default material costs per square foot
            material_costs = {
                'shingle_replacement': 5.0,
                'labor_per_sqft': 3.0,
                'underlayment': 1.5,
                'flashing': 15.0,
                'permits_inspection': 0.5
            }
        
        results = []
        batch_size = outputs['affected_area'].shape[0]
        
        for b in range(batch_size):
            affected_percentage = outputs['affected_area'][b].item()
            damage_count = outputs['damage_count'][b].item()
            severity_score = outputs['severity_score'][b].item()
            cost_factor = outputs['cost_factor'][b].item()
            
            # Calculate affected area in square feet
            affected_area_sqft = (affected_percentage / 100) * roof_area_sqft
            
            # Base repair costs
            base_material_cost = affected_area_sqft * material_costs['shingle_replacement']
            base_labor_cost = affected_area_sqft * material_costs['labor_per_sqft']
            
            # Apply severity multipliers
            severity_multiplier = 1.0 + (severity_score * 2.0)  # 1.0 to 3.0 range
            
            # Apply damage count factor (more individual damages = more labor intensive)
            count_multiplier = 1.0 + min(damage_count / 100, 1.0)  # Cap at 2.0
            
            # Calculate final costs
            material_cost = base_material_cost * severity_multiplier
            labor_cost = base_labor_cost * severity_multiplier * count_multiplier
            
            # Additional costs based on damage extent
            if affected_percentage > 30:
                # Significant damage may require additional materials
                additional_cost = affected_area_sqft * material_costs['underlayment']
            else:
                additional_cost = 0
            
            # Permits and inspection
            permit_cost = roof_area_sqft * material_costs['permits_inspection']
            
            # Total cost
            total_cost = material_cost + labor_cost + additional_cost + permit_cost
            
            # Apply general cost factor from model
            total_cost *= (1.0 + cost_factor)
            
            result = {
                'affected_area_sqft': float(affected_area_sqft),
                'material_cost': float(material_cost),
                'labor_cost': float(labor_cost),
                'additional_cost': float(additional_cost),
                'permit_cost': float(permit_cost),
                'total_estimated_cost': float(total_cost),
                'cost_per_sqft': float(total_cost / roof_area_sqft),
                'severity_multiplier': float(severity_multiplier),
                'damage_complexity': float(count_multiplier)
            }
            
            results.append(result)
        
        return results


class FeaturePyramidNetwork(nn.Module):
    """Feature Pyramid Network for multi-scale feature fusion."""
    
    def __init__(self, feature_dims: List[int], out_channels: int = 256):
        """Initialize FPN."""
        super(FeaturePyramidNetwork, self).__init__()
        
        self.lateral_convs = nn.ModuleList([
            nn.Conv2d(dim, out_channels, 1) for dim in feature_dims
        ])
        
        self.fpn_convs = nn.ModuleList([
            nn.Conv2d(out_channels, out_channels, 3, padding=1) 
            for _ in feature_dims
        ])
    
    def forward(self, features: List[torch.Tensor]) -> List[torch.Tensor]:
        """Forward pass of FPN."""
        # Apply lateral convolutions
        lateral_features = [
            conv(feat) for conv, feat in zip(self.lateral_convs, features)
        ]
        
        # Top-down pathway
        for i in range(len(lateral_features) - 2, -1, -1):
            lateral_features[i] = lateral_features[i] + F.interpolate(
                lateral_features[i + 1],
                size=lateral_features[i].shape[2:4],
                mode='nearest'
            )
        
        # Apply FPN convolutions
        fpn_features = [
            conv(feat) for conv, feat in zip(self.fpn_convs, lateral_features)
        ]
        
        return fpn_features


class UNetDecoder(nn.Module):
    """U-Net style decoder for segmentation tasks."""
    
    def __init__(self, feature_dims: List[int]):
        """Initialize U-Net decoder."""
        super(UNetDecoder, self).__init__()
        
        self.up_blocks = nn.ModuleList()
        
        # Build upsampling blocks
        for i in range(len(feature_dims) - 1, 0, -1):
            in_channels = feature_dims[i] + feature_dims[i-1]
            out_channels = feature_dims[i-1] // 2
            
            self.up_blocks.append(nn.Sequential(
                nn.ConvTranspose2d(feature_dims[i], feature_dims[i], 2, stride=2),
                nn.Conv2d(in_channels, out_channels, 3, padding=1),
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True),
                nn.Conv2d(out_channels, out_channels, 3, padding=1),
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True)
            ))
        
        # Final output layer
        self.final_conv = nn.Conv2d(feature_dims[0] // 2, 64, 3, padding=1)
    
    def forward(self, features: List[torch.Tensor]) -> torch.Tensor:
        """Forward pass of U-Net decoder."""
        x = features[-1]  # Start with deepest features
        
        for i, up_block in enumerate(self.up_blocks):
            # Upsample
            x = F.interpolate(x, scale_factor=2, mode='bilinear', align_corners=False)
            
            # Concatenate with skip connection
            skip = features[len(features) - 2 - i]
            x = torch.cat([x, skip], dim=1)
            
            # Apply up block
            x = up_block(x)
        
        return self.final_conv(x)


class EnsembleDamageClassifier:
    """
    Ensemble classifier combining all specialized damage detection models.
    Provides comprehensive roof damage analysis with confidence scoring.
    """
    
    def __init__(self, device: torch.device = None):
        """Initialize the ensemble classifier."""
        self.device = device or torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Initialize specialized models
        self.hail_detector = HailDamageDetector()
        self.wind_detector = WindDamageDetector()
        self.wear_detector = WearDamageDetector()
        self.quantification_model = DamageQuantificationModel()
        
        # Move models to device
        self.hail_detector = self.hail_detector.to(self.device)
        self.wind_detector = self.wind_detector.to(self.device)
        self.wear_detector = self.wear_detector.to(self.device)
        self.quantification_model = self.quantification_model.to(self.device)
        
        # Set models to evaluation mode
        self.hail_detector.eval()
        self.wind_detector.eval()
        self.wear_detector.eval()
        self.quantification_model.eval()
        
        logger.info("Ensemble damage classifier initialized")
    
    def load_model_weights(self, weights_path: str):
        """Load pre-trained weights for all models."""
        try:
            weights = torch.load(weights_path, map_location=self.device)
            
            if 'hail_detector' in weights:
                self.hail_detector.load_state_dict(weights['hail_detector'])
            if 'wind_detector' in weights:
                self.wind_detector.load_state_dict(weights['wind_detector'])
            if 'wear_detector' in weights:
                self.wear_detector.load_state_dict(weights['wear_detector'])
            if 'quantification_model' in weights:
                self.quantification_model.load_state_dict(weights['quantification_model'])
            
            logger.info(f"Loaded model weights from {weights_path}")
            
        except Exception as e:
            logger.error(f"Error loading weights: {e}")
    
    def analyze_damage(
        self,
        image: torch.Tensor,
        roof_area_sqft: float = 1500,
        confidence_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """Comprehensive damage analysis using all specialized models."""
        
        with torch.no_grad():
            # Ensure image is on correct device and in batch format
            if image.dim() == 3:
                image = image.unsqueeze(0)
            image = image.to(self.device)
            
            # Run all specialized detectors
            hail_outputs = self.hail_detector(image)
            wind_outputs = self.wind_detector(image)
            wear_outputs = self.wear_detector(image)
            quant_outputs = self.quantification_model(image)
            
            # Post-process results
            hail_results = self.hail_detector.post_process_predictions(
                hail_outputs, confidence_threshold
            )[0]
            
            wind_results = self.wind_detector.analyze_wind_patterns(wind_outputs)[0]
            wear_results = self.wear_detector.assess_wear_condition(wear_outputs)[0]
            
            cost_results = self.quantification_model.estimate_repair_cost(
                quant_outputs, roof_area_sqft
            )[0]
            
            # Determine primary damage type
            damage_scores = {
                'hail': hail_results['num_impacts'] * hail_results['severity_confidence'],
                'wind': (wind_results['total_damage_percentage'] / 100) * wind_results['direction_confidence'],
                'wear': wear_results['overall_wear_score'] / 100
            }
            
            primary_damage = max(damage_scores.keys(), key=lambda k: damage_scores[k])
            primary_confidence = damage_scores[primary_damage]
            
            # Determine overall severity
            severity_indicators = [
                hail_results['severity_class'] / 3,  # Normalize to 0-1
                min(wind_results['total_damage_percentage'] / 50, 1.0),  # Cap at 50%
                wear_results['overall_wear_score'] / 100
            ]
            
            overall_severity = max(severity_indicators)
            
            if overall_severity < 0.25:
                severity_level = 'light'
            elif overall_severity < 0.5:
                severity_level = 'moderate'
            else:
                severity_level = 'severe'
            
            # Compile comprehensive results
            comprehensive_results = {
                'analysis_timestamp': torch.cuda.current_stream().query() if torch.cuda.is_available() else 0,
                'primary_damage_type': primary_damage,
                'primary_confidence': float(primary_confidence),
                'overall_severity': severity_level,
                'overall_severity_score': float(overall_severity),
                
                # Individual model results
                'hail_analysis': hail_results,
                'wind_analysis': wind_results,
                'wear_analysis': wear_results,
                'cost_analysis': cost_results,
                
                # Quantification summary
                'quantification_summary': {
                    'affected_area_percentage': float(quant_outputs['affected_area'][0].item()),
                    'damage_count': int(quant_outputs['damage_count'][0].item()),
                    'severity_score': float(quant_outputs['severity_score'][0].item()),
                    'estimated_cost': cost_results['total_estimated_cost']
                },
                
                # Recommendations
                'recommendations': self._generate_recommendations(
                    primary_damage, overall_severity, hail_results, wind_results, wear_results
                )
            }
            
            return comprehensive_results
    
    def _generate_recommendations(
        self,
        primary_damage: str,
        severity: float,
        hail_results: Dict,
        wind_results: Dict,
        wear_results: Dict
    ) -> List[str]:
        """Generate repair and insurance recommendations."""
        recommendations = []
        
        # Severity-based recommendations
        if severity > 0.7:
            recommendations.append("URGENT: Significant damage detected requiring immediate attention")
            recommendations.append("Contact insurance adjuster for comprehensive evaluation")
            recommendations.append("Consider temporary protective measures to prevent water intrusion")
        elif severity > 0.4:
            recommendations.append("Moderate damage detected - schedule professional inspection within 30 days")
            recommendations.append("Document damage with additional photos for insurance purposes")
        else:
            recommendations.append("Minor damage detected - monitor for changes and schedule routine maintenance")
        
        # Damage-type specific recommendations
        if primary_damage == 'hail':
            if hail_results['num_impacts'] > 10:
                recommendations.append("Multiple hail impacts detected - likely insurance claim eligible")
            if hail_results['avg_granule_loss'] > 0.3:
                recommendations.append("Significant granule loss may reduce shingle lifespan")
        
        elif primary_damage == 'wind':
            recommendations.append("Wind damage pattern suggests recent storm activity")
            if wind_results['missing_shingle_area'] > 0:
                recommendations.append("Missing shingles create immediate water intrusion risk")
            
        elif primary_damage == 'wear':
            if wear_results['estimated_age_years'] > 15:
                recommendations.append("Roof approaching end of typical lifespan - consider replacement planning")
            if wear_results['replacement_recommendation']:
                recommendations.append("Wear analysis suggests full roof replacement may be more cost-effective")
        
        return recommendations
    
    def batch_analyze(
        self,
        image_paths: List[str],
        roof_areas: List[float] = None,
        batch_size: int = 4
    ) -> List[Dict[str, Any]]:
        """Analyze multiple images in batches."""
        if roof_areas is None:
            roof_areas = [1500] * len(image_paths)  # Default roof area
        
        results = []
        
        for i in range(0, len(image_paths), batch_size):
            batch_paths = image_paths[i:i + batch_size]
            batch_areas = roof_areas[i:i + batch_size]
            
            # Load and preprocess images
            batch_images = []
            for path in batch_paths:
                try:
                    image = Image.open(path).convert('RGB')
                    image = transforms.Compose([
                        transforms.Resize((512, 512)),
                        transforms.ToTensor(),
                        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                    ])(image)
                    batch_images.append(image)
                except Exception as e:
                    logger.error(f"Error loading image {path}: {e}")
                    continue
            
            if not batch_images:
                continue
            
            # Stack images into batch
            batch_tensor = torch.stack(batch_images).to(self.device)
            
            # Analyze each image in batch
            for j, (image, area) in enumerate(zip(batch_tensor, batch_areas)):
                try:
                    result = self.analyze_damage(image.unsqueeze(0), area)
                    result['image_path'] = batch_paths[j]
                    results.append(result)
                except Exception as e:
                    logger.error(f"Error analyzing {batch_paths[j]}: {e}")
        
        return results


def main():
    """Main function for testing damage classifiers."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Damage Classifiers')
    parser.add_argument('--image', type=str, required=True, help='Path to test image')
    parser.add_argument('--weights', type=str, help='Path to model weights')
    parser.add_argument('--output', type=str, help='Output JSON file for results')
    
    args = parser.parse_args()
    
    try:
        # Initialize ensemble classifier
        classifier = EnsembleDamageClassifier()
        
        # Load weights if provided
        if args.weights:
            classifier.load_model_weights(args.weights)
        
        # Load and preprocess image
        image = Image.open(args.image).convert('RGB')
        transform = transforms.Compose([
            transforms.Resize((512, 512)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        image_tensor = transform(image)
        
        # Analyze damage
        results = classifier.analyze_damage(image_tensor)
        
        # Print results
        print("\n" + "="*50)
        print("ROOF DAMAGE ANALYSIS RESULTS")
        print("="*50)
        print(f"Primary Damage Type: {results['primary_damage_type']}")
        print(f"Overall Severity: {results['overall_severity']}")
        print(f"Estimated Cost: ${results['cost_analysis']['total_estimated_cost']:.2f}")
        print("\nRecommendations:")
        for rec in results['recommendations']:
            print(f"  - {rec}")
        
        # Save detailed results if output path provided
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            print(f"\nDetailed results saved to {args.output}")
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()