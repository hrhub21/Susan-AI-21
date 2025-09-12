#!/usr/bin/env python3
"""
Comprehensive Roof Damage Training System for Susan AI
Advanced fine-tuning system for Qwen 2.5 VL with specialized roof damage recognition
Integrates with Susan AI's existing infrastructure and training modules
"""

import os
import sys
import json
import yaml
import logging
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torch.cuda.amp import autocast, GradScaler
import torch.nn.functional as F
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Union
from datetime import datetime, timedelta
import wandb
from tqdm import tqdm
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_recall_curve
from sklearn.utils.class_weight import compute_class_weight
import cv2
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2
import transformers
from transformers import (
    Qwen2VLForConditionalGeneration,
    Qwen2VLProcessor,
    AutoTokenizer,
    AutoModelForImageClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
    get_linear_schedule_with_warmup
)
from transformers.modeling_outputs import BaseModelOutput
import timm
from accelerate import Accelerator
from datasets import Dataset as HFDataset
import warnings
warnings.filterwarnings('ignore')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RoofDamageDataset(Dataset):
    """
    Custom PyTorch dataset for roof damage training data.
    Optimized for multi-label classification with damage quantification.
    """
    
    def __init__(
        self,
        data_path: str,
        split: str = 'train',
        transforms: Optional[A.Compose] = None,
        image_size: Tuple[int, int] = (512, 512),
        normalize: bool = True,
        augment_probability: float = 0.5
    ):
        """Initialize the roof damage dataset."""
        self.data_path = Path(data_path)
        self.split = split
        self.transforms = transforms
        self.image_size = image_size
        self.normalize = normalize
        self.augment_probability = augment_probability
        
        # Load data
        self.data = self._load_data()
        
        # Class mappings
        self.damage_classes = ['no_damage', 'hail', 'wind', 'wear', 'impact']
        self.severity_classes = ['none', 'light', 'moderate', 'severe']
        
        self.class_to_idx = {cls: idx for idx, cls in enumerate(self.damage_classes)}
        self.severity_to_idx = {sev: idx for idx, sev in enumerate(self.severity_classes)}
        
        logger.info(f"Loaded {len(self.data)} samples for {split} split")
    
    def _load_data(self) -> List[Dict[str, Any]]:
        """Load processed training data."""
        try:
            data_file = self.data_path / f"{self.split}_final.json"
            
            if not data_file.exists():
                # Fallback to processed data
                data_file = self.data_path / f"{self.split}_processed.json"
            
            if not data_file.exists():
                raise FileNotFoundError(f"Data file not found: {data_file}")
            
            with open(data_file, 'r') as f:
                data = json.load(f)
            
            # Filter out samples without valid image files
            valid_data = []
            for sample in data:
                image_path = Path(sample['image_file'])
                if image_path.exists():
                    valid_data.append(sample)
                else:
                    logger.warning(f"Image file not found: {image_path}")
            
            return valid_data
            
        except Exception as e:
            logger.error(f"Error loading data: {e}")
            return []
    
    def __len__(self) -> int:
        """Return dataset size."""
        return len(self.data)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        """Get a single sample."""
        try:
            sample = self.data[idx]
            
            # Load image
            image_path = Path(sample['image_file'])
            image = np.load(image_path)
            
            # Ensure image is in correct format (H, W, C)
            if len(image.shape) == 3 and image.shape[-1] == 3:
                # Convert to uint8 if normalized
                if image.dtype == np.float32 and image.max() <= 1.0:
                    image = (image * 255).astype(np.uint8)
            else:
                logger.warning(f"Unexpected image shape: {image.shape}")
                # Handle grayscale or other formats
                if len(image.shape) == 2:
                    image = np.stack([image] * 3, axis=-1)
            
            # Apply transforms
            if self.transforms:
                augmented = self.transforms(image=image)
                image = augmented['image']
            else:
                # Default preprocessing
                image = cv2.resize(image, self.image_size)
                image = image.astype(np.float32)
                if self.normalize:
                    image = image / 255.0
                # Convert to tensor (C, H, W)
                image = torch.tensor(image).permute(2, 0, 1)
            
            # Process labels
            labels = sample['labels']
            
            # Primary damage classification
            damage_class = labels['primary_damage']
            damage_idx = self.class_to_idx.get(damage_class, 0)
            
            # Severity classification
            severity = labels['severity']
            severity_idx = self.severity_to_idx.get(severity, 0)
            
            # Confidence score
            confidence = float(labels.get('confidence', 0.5))
            
            # Quantification metrics
            quantification = labels.get('quantification', {})
            affected_percentage = float(quantification.get('affected_percentage', 0.0))
            damage_count = int(quantification.get('damage_count', 0))
            
            # Multi-hot encoding for features
            damage_features = labels.get('damage_features', [])
            feature_vector = self._encode_features(damage_features)
            
            # Metadata encoding
            metadata = labels.get('metadata', {})
            weather_related = float(metadata.get('weather_related', False))
            age_related = float(metadata.get('age_related', False))
            impact_related = float(metadata.get('impact_related', False))
            
            return {
                'image': image.float(),
                'damage_class': torch.tensor(damage_idx, dtype=torch.long),
                'severity': torch.tensor(severity_idx, dtype=torch.long),
                'confidence': torch.tensor(confidence, dtype=torch.float),
                'affected_percentage': torch.tensor(affected_percentage, dtype=torch.float),
                'damage_count': torch.tensor(damage_count, dtype=torch.float),
                'features': torch.tensor(feature_vector, dtype=torch.float),
                'metadata': torch.tensor([weather_related, age_related, impact_related], dtype=torch.float),
                'sample_id': sample.get('sample_id', idx)
            }
            
        except Exception as e:
            logger.error(f"Error loading sample {idx}: {e}")
            # Return a dummy sample
            return self._get_dummy_sample()
    
    def _encode_features(self, features: List[str]) -> List[float]:
        """Encode damage features as binary vector."""
        all_features = [
            'circular_impacts', 'granule_loss', 'exposed_mat',  # Hail
            'edge_lifting', 'tab_separation', 'complete_loss',  # Wind
            'curling', 'cracking', 'blistering',  # Wear
            'dents', 'holes', 'punctures',  # Impact
            'intact_granules', 'proper_alignment', 'no_visible_damage'  # No damage
        ]
        
        feature_vector = [1.0 if feature in features else 0.0 for feature in all_features]
        return feature_vector
    
    def _get_dummy_sample(self) -> Dict[str, torch.Tensor]:
        """Return a dummy sample for error cases."""
        dummy_image = torch.zeros(3, self.image_size[1], self.image_size[0])
        
        return {
            'image': dummy_image.float(),
            'damage_class': torch.tensor(0, dtype=torch.long),
            'severity': torch.tensor(0, dtype=torch.long),
            'confidence': torch.tensor(0.0, dtype=torch.float),
            'affected_percentage': torch.tensor(0.0, dtype=torch.float),
            'damage_count': torch.tensor(0.0, dtype=torch.float),
            'features': torch.tensor([0.0] * 15, dtype=torch.float),
            'metadata': torch.tensor([0.0, 0.0, 0.0], dtype=torch.float),
            'sample_id': -1
        }
    
    def get_class_weights(self) -> torch.Tensor:
        """Calculate class weights for balanced training."""
        try:
            labels = [sample['labels']['primary_damage'] for sample in self.data]
            unique_labels = list(set(labels))
            
            # Map string labels to indices
            label_indices = [self.class_to_idx[label] for label in labels]
            
            # Calculate weights
            weights = compute_class_weight(
                'balanced',
                classes=np.array(range(len(self.damage_classes))),
                y=np.array(label_indices)
            )
            
            return torch.tensor(weights, dtype=torch.float)
            
        except Exception as e:
            logger.warning(f"Error calculating class weights: {e}")
            return torch.ones(len(self.damage_classes))


class MultiTaskRoofDamageModel(nn.Module):
    """
    Multi-task learning model for comprehensive roof damage analysis.
    Combines damage classification, severity assessment, and quantification.
    """
    
    def __init__(
        self,
        backbone: str = 'efficientnet_b3',
        num_damage_classes: int = 5,
        num_severity_classes: int = 4,
        num_features: int = 15,
        dropout_rate: float = 0.2,
        pretrained: bool = True
    ):
        """Initialize the multi-task model."""
        super(MultiTaskRoofDamageModel, self).__init__()
        
        # Backbone network
        self.backbone = timm.create_model(
            backbone,
            pretrained=pretrained,
            num_classes=0,  # Remove final classification layer
            global_pool='avg'
        )
        
        # Get backbone feature dimension
        with torch.no_grad():
            dummy_input = torch.randn(1, 3, 512, 512)
            backbone_features = self.backbone(dummy_input)
            self.feature_dim = backbone_features.shape[1]
        
        # Shared feature processing
        self.feature_processor = nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(self.feature_dim, 512),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(512),
            nn.Dropout(dropout_rate),
        )
        
        # Task-specific heads
        # 1. Damage classification head
        self.damage_classifier = nn.Sequential(
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(256, num_damage_classes)
        )
        
        # 2. Severity classification head
        self.severity_classifier = nn.Sequential(
            nn.Linear(512, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(128, num_severity_classes)
        )
        
        # 3. Quantification regression heads
        self.percentage_regressor = nn.Sequential(
            nn.Linear(512, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(128, 1),
            nn.Sigmoid()  # Output 0-1 range
        )
        
        self.count_regressor = nn.Sequential(
            nn.Linear(512, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(128, 1),
            nn.ReLU()  # Non-negative output
        )
        
        # 4. Feature detection head (multi-label)
        self.feature_detector = nn.Sequential(
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(256, num_features),
            nn.Sigmoid()  # Multi-label output
        )
        
        # 5. Confidence estimation head
        self.confidence_estimator = nn.Sequential(
            nn.Linear(512, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        """Initialize model weights."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight)
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0)
            elif isinstance(module, nn.BatchNorm1d):
                nn.init.constant_(module.weight, 1)
                nn.init.constant_(module.bias, 0)
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """Forward pass of the multi-task model."""
        # Extract features using backbone
        features = self.backbone(x)
        
        # Process features
        processed_features = self.feature_processor(features)
        
        # Task-specific predictions
        outputs = {
            'damage_logits': self.damage_classifier(processed_features),
            'severity_logits': self.severity_classifier(processed_features),
            'affected_percentage': self.percentage_regressor(processed_features).squeeze(-1),
            'damage_count': self.count_regressor(processed_features).squeeze(-1),
            'feature_probs': self.feature_detector(processed_features),
            'confidence': self.confidence_estimator(processed_features).squeeze(-1),
            'features': processed_features  # For attention/interpretability
        }
        
        return outputs


class RoofDamageTrainer:
    """
    Comprehensive trainer for roof damage analysis models.
    Integrates with Susan AI's existing Qwen VL infrastructure.
    """
    
    def __init__(self, config_path: str = None):
        """Initialize the trainer."""
        self.base_dir = Path(__file__).parent
        self.config_path = config_path or self.base_dir / "training_config.yaml"
        
        # Load configuration
        self.config = self._load_config()
        
        # Setup directories
        self.setup_directories()
        
        # Initialize device and mixed precision
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.use_amp = self.config.get('training', {}).get('mixed_precision', True) and torch.cuda.is_available()
        self.scaler = GradScaler() if self.use_amp else None
        
        # Initialize accelerator for distributed training
        self.accelerator = Accelerator(mixed_precision='fp16' if self.use_amp else None)
        
        # Training state
        self.model = None
        self.train_loader = None
        self.val_loader = None
        self.test_loader = None
        self.optimizer = None
        self.scheduler = None
        self.best_val_loss = float('inf')
        self.current_epoch = 0
        
        # Metrics tracking
        self.train_metrics = []
        self.val_metrics = []
        
        # Initialize Weights & Biases if configured
        if self.config.get('logging', {}).get('use_wandb', False):
            self._init_wandb()
        
        logger.info(f"Trainer initialized on device: {self.device}")
    
    def _load_config(self) -> Dict[str, Any]:
        """Load training configuration."""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    config = yaml.safe_load(f)
                logger.info(f"Loaded configuration from {self.config_path}")
                return config
            else:
                logger.warning("Config file not found, using defaults")
                return self._get_default_config()
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default training configuration."""
        return {
            'model': {
                'backbone': 'efficientnet_b3',
                'dropout_rate': 0.2,
                'pretrained': True
            },
            'training': {
                'batch_size': 16,
                'num_epochs': 100,
                'learning_rate': 1e-4,
                'weight_decay': 1e-5,
                'mixed_precision': True,
                'gradient_clipping': 1.0,
                'early_stopping_patience': 10
            },
            'data': {
                'image_size': [512, 512],
                'augmentation_probability': 0.7,
                'num_workers': 4,
                'pin_memory': True
            },
            'optimizer': {
                'type': 'adamw',
                'beta1': 0.9,
                'beta2': 0.999,
                'eps': 1e-8
            },
            'scheduler': {
                'type': 'cosine',
                'warmup_steps': 1000,
                'min_lr': 1e-6
            },
            'loss_weights': {
                'damage_classification': 1.0,
                'severity_classification': 0.8,
                'percentage_regression': 0.6,
                'count_regression': 0.4,
                'feature_detection': 0.5,
                'confidence_estimation': 0.3
            },
            'logging': {
                'use_wandb': False,
                'log_interval': 10,
                'save_interval': 5
            }
        }
    
    def setup_directories(self):
        """Setup training directories."""
        self.checkpoints_dir = self.base_dir / "checkpoints"
        self.logs_dir = self.base_dir / "logs"
        self.results_dir = self.base_dir / "results"
        
        for directory in [self.checkpoints_dir, self.logs_dir, self.results_dir]:
            directory.mkdir(parents=True, exist_ok=True)
    
    def _init_wandb(self):
        """Initialize Weights & Biases logging."""
        try:
            wandb.init(
                project="susan-ai-roof-damage",
                config=self.config,
                name=f"roof-damage-training-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                tags=["roof-damage", "multi-task", "qwen-integration"]
            )
            logger.info("Weights & Biases initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize W&B: {e}")
    
    def create_data_transforms(self) -> Tuple[A.Compose, A.Compose]:
        """Create training and validation transforms."""
        image_size = tuple(self.config['data']['image_size'])
        
        # Training transforms with augmentation
        train_transforms = A.Compose([
            A.Resize(height=image_size[1], width=image_size[0]),
            A.HorizontalFlip(p=0.5),
            A.RandomRotate90(p=0.3),
            A.ShiftScaleRotate(
                shift_limit=0.1,
                scale_limit=0.2,
                rotate_limit=15,
                p=0.5
            ),
            A.RandomBrightnessContrast(
                brightness_limit=0.2,
                contrast_limit=0.2,
                p=0.5
            ),
            A.HueSaturationValue(
                hue_shift_limit=10,
                sat_shift_limit=20,
                val_shift_limit=20,
                p=0.3
            ),
            A.GaussianBlur(blur_limit=3, p=0.2),
            A.GaussNoise(var_limit=0.01, p=0.2),
            A.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
            ToTensorV2()
        ])
        
        # Validation transforms (no augmentation)
        val_transforms = A.Compose([
            A.Resize(height=image_size[1], width=image_size[0]),
            A.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
            ToTensorV2()
        ])
        
        return train_transforms, val_transforms
    
    def create_datasets_and_loaders(self, data_dir: str):
        """Create datasets and data loaders."""
        try:
            data_path = Path(data_dir)
            train_transforms, val_transforms = self.create_data_transforms()
            
            # Create datasets
            train_dataset = RoofDamageDataset(
                data_path=data_path / "processed",
                split='train',
                transforms=train_transforms,
                image_size=tuple(self.config['data']['image_size'])
            )
            
            val_dataset = RoofDamageDataset(
                data_path=data_path / "processed",
                split='validation',
                transforms=val_transforms,
                image_size=tuple(self.config['data']['image_size'])
            )
            
            test_dataset = RoofDamageDataset(
                data_path=data_path / "processed",
                split='test',
                transforms=val_transforms,
                image_size=tuple(self.config['data']['image_size'])
            )
            
            # Get class weights for balanced training
            class_weights = train_dataset.get_class_weights()
            logger.info(f"Class weights: {class_weights}")
            
            # Create weighted sampler for training
            sample_weights = []
            for sample in train_dataset.data:
                damage_class = sample['labels']['primary_damage']
                class_idx = train_dataset.class_to_idx[damage_class]
                sample_weights.append(class_weights[class_idx].item())
            
            sampler = WeightedRandomSampler(
                weights=sample_weights,
                num_samples=len(sample_weights),
                replacement=True
            )
            
            # Create data loaders
            batch_size = self.config['training']['batch_size']
            num_workers = self.config['data']['num_workers']
            pin_memory = self.config['data']['pin_memory']
            
            self.train_loader = DataLoader(
                train_dataset,
                batch_size=batch_size,
                sampler=sampler,
                num_workers=num_workers,
                pin_memory=pin_memory,
                drop_last=True
            )
            
            self.val_loader = DataLoader(
                val_dataset,
                batch_size=batch_size,
                shuffle=False,
                num_workers=num_workers,
                pin_memory=pin_memory
            )
            
            self.test_loader = DataLoader(
                test_dataset,
                batch_size=batch_size,
                shuffle=False,
                num_workers=num_workers,
                pin_memory=pin_memory
            )
            
            logger.info(f"Created datasets: Train={len(train_dataset)}, Val={len(val_dataset)}, Test={len(test_dataset)}")
            
            return class_weights
            
        except Exception as e:
            logger.error(f"Error creating datasets: {e}")
            return None
    
    def create_model(self, num_damage_classes: int = 5, num_severity_classes: int = 4) -> MultiTaskRoofDamageModel:
        """Create the multi-task roof damage model."""
        model = MultiTaskRoofDamageModel(
            backbone=self.config['model']['backbone'],
            num_damage_classes=num_damage_classes,
            num_severity_classes=num_severity_classes,
            num_features=15,  # Number of damage features
            dropout_rate=self.config['model']['dropout_rate'],
            pretrained=self.config['model']['pretrained']
        )
        
        return model
    
    def create_optimizer_and_scheduler(self, model: nn.Module, num_training_steps: int):
        """Create optimizer and learning rate scheduler."""
        # Optimizer
        optimizer_config = self.config['optimizer']
        
        if optimizer_config['type'].lower() == 'adamw':
            self.optimizer = optim.AdamW(
                model.parameters(),
                lr=self.config['training']['learning_rate'],
                weight_decay=self.config['training']['weight_decay'],
                betas=(optimizer_config['beta1'], optimizer_config['beta2']),
                eps=optimizer_config['eps']
            )
        else:
            self.optimizer = optim.Adam(
                model.parameters(),
                lr=self.config['training']['learning_rate'],
                weight_decay=self.config['training']['weight_decay']
            )
        
        # Scheduler
        scheduler_config = self.config['scheduler']
        
        if scheduler_config['type'].lower() == 'cosine':
            self.scheduler = get_linear_schedule_with_warmup(
                self.optimizer,
                num_warmup_steps=scheduler_config['warmup_steps'],
                num_training_steps=num_training_steps
            )
        else:
            self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
                self.optimizer,
                mode='min',
                patience=5,
                factor=0.5,
                min_lr=scheduler_config['min_lr']
            )
        
        logger.info(f"Created optimizer: {type(self.optimizer).__name__}")
        logger.info(f"Created scheduler: {type(self.scheduler).__name__}")
    
    def compute_loss(
        self,
        outputs: Dict[str, torch.Tensor],
        targets: Dict[str, torch.Tensor],
        class_weights: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
        """Compute multi-task loss."""
        device = outputs['damage_logits'].device
        losses = {}
        loss_weights = self.config['loss_weights']
        
        # 1. Damage classification loss
        damage_criterion = nn.CrossEntropyLoss(weight=class_weights.to(device) if class_weights is not None else None)
        losses['damage_classification'] = damage_criterion(outputs['damage_logits'], targets['damage_class'])
        
        # 2. Severity classification loss
        severity_criterion = nn.CrossEntropyLoss()
        losses['severity_classification'] = severity_criterion(outputs['severity_logits'], targets['severity'])
        
        # 3. Affected percentage regression loss
        percentage_criterion = nn.MSELoss()
        losses['percentage_regression'] = percentage_criterion(
            outputs['affected_percentage'],
            targets['affected_percentage'] / 100.0  # Normalize to 0-1
        )
        
        # 4. Damage count regression loss
        count_criterion = nn.SmoothL1Loss()
        # Normalize damage count to reasonable range
        normalized_count = torch.clamp(targets['damage_count'] / 100.0, 0, 1)
        losses['count_regression'] = count_criterion(outputs['damage_count'], normalized_count)
        
        # 5. Feature detection loss (multi-label)
        feature_criterion = nn.BCELoss()
        losses['feature_detection'] = feature_criterion(outputs['feature_probs'], targets['features'])
        
        # 6. Confidence estimation loss
        confidence_criterion = nn.MSELoss()
        losses['confidence_estimation'] = confidence_criterion(outputs['confidence'], targets['confidence'])
        
        # Compute weighted total loss
        total_loss = sum(
            loss_weights[task] * loss_value
            for task, loss_value in losses.items()
            if task in loss_weights
        )
        
        losses['total'] = total_loss
        
        return total_loss, losses
    
    def compute_metrics(
        self,
        outputs: Dict[str, torch.Tensor],
        targets: Dict[str, torch.Tensor]
    ) -> Dict[str, float]:
        """Compute evaluation metrics."""
        metrics = {}
        
        with torch.no_grad():
            # Damage classification accuracy
            damage_preds = torch.argmax(outputs['damage_logits'], dim=1)
            damage_acc = (damage_preds == targets['damage_class']).float().mean().item()
            metrics['damage_accuracy'] = damage_acc
            
            # Severity classification accuracy
            severity_preds = torch.argmax(outputs['severity_logits'], dim=1)
            severity_acc = (severity_preds == targets['severity']).float().mean().item()
            metrics['severity_accuracy'] = severity_acc
            
            # Percentage regression metrics
            percentage_mae = torch.abs(
                outputs['affected_percentage'] - targets['affected_percentage'] / 100.0
            ).mean().item()
            metrics['percentage_mae'] = percentage_mae * 100  # Convert back to percentage
            
            # Count regression metrics
            normalized_count = torch.clamp(targets['damage_count'] / 100.0, 0, 1)
            count_mae = torch.abs(outputs['damage_count'] - normalized_count).mean().item()
            metrics['count_mae'] = count_mae * 100
            
            # Feature detection metrics (F1 score)
            feature_preds = (outputs['feature_probs'] > 0.5).float()
            feature_f1 = f1_score(
                targets['features'].cpu().numpy(),
                feature_preds.cpu().numpy(),
                average='macro',
                zero_division=0
            )
            metrics['feature_f1'] = feature_f1
            
            # Confidence correlation
            confidence_corr = torch.corrcoef(
                torch.stack([outputs['confidence'], targets['confidence']])
            )[0, 1].item()
            metrics['confidence_correlation'] = confidence_corr if not torch.isnan(torch.tensor(confidence_corr)) else 0.0
        
        return metrics
    
    def train_epoch(self, epoch: int, class_weights: Optional[torch.Tensor] = None) -> Dict[str, float]:
        """Train for one epoch."""
        self.model.train()
        
        total_losses = {}
        total_metrics = {}
        num_batches = len(self.train_loader)
        
        progress_bar = tqdm(self.train_loader, desc=f"Epoch {epoch+1}")
        
        for batch_idx, batch in enumerate(progress_bar):
            # Move batch to device
            batch = {k: v.to(self.device) if isinstance(v, torch.Tensor) else v for k, v in batch.items()}
            
            # Forward pass with mixed precision
            if self.use_amp:
                with autocast():
                    outputs = self.model(batch['image'])
                    loss, losses = self.compute_loss(outputs, batch, class_weights)
            else:
                outputs = self.model(batch['image'])
                loss, losses = self.compute_loss(outputs, batch, class_weights)
            
            # Backward pass
            self.optimizer.zero_grad()
            
            if self.use_amp:
                self.scaler.scale(loss).backward()
                
                # Gradient clipping
                if self.config['training'].get('gradient_clipping', 0) > 0:
                    self.scaler.unscale_(self.optimizer)
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(),
                        self.config['training']['gradient_clipping']
                    )
                
                self.scaler.step(self.optimizer)
                self.scaler.update()
            else:
                loss.backward()
                
                # Gradient clipping
                if self.config['training'].get('gradient_clipping', 0) > 0:
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(),
                        self.config['training']['gradient_clipping']
                    )
                
                self.optimizer.step()
            
            # Update scheduler
            if hasattr(self.scheduler, 'step') and 'linear' in str(type(self.scheduler)).lower():
                self.scheduler.step()
            
            # Compute metrics
            metrics = self.compute_metrics(outputs, batch)
            
            # Accumulate losses and metrics
            for key, value in losses.items():
                if key not in total_losses:
                    total_losses[key] = 0
                total_losses[key] += value.item()
            
            for key, value in metrics.items():
                if key not in total_metrics:
                    total_metrics[key] = 0
                total_metrics[key] += value
            
            # Update progress bar
            progress_bar.set_postfix({
                'Loss': f"{loss.item():.4f}",
                'Damage Acc': f"{metrics['damage_accuracy']:.3f}",
                'Severity Acc': f"{metrics['severity_accuracy']:.3f}"
            })
            
            # Log to wandb
            if self.config.get('logging', {}).get('use_wandb', False) and batch_idx % self.config['logging']['log_interval'] == 0:
                log_dict = {f"train/{key}": value.item() for key, value in losses.items()}
                log_dict.update({f"train/{key}": value for key, value in metrics.items()})
                log_dict['learning_rate'] = self.optimizer.param_groups[0]['lr']
                wandb.log(log_dict)
        
        # Average losses and metrics
        avg_losses = {key: value / num_batches for key, value in total_losses.items()}
        avg_metrics = {key: value / num_batches for key, value in total_metrics.items()}
        
        # Combine into single dict
        epoch_results = {}
        epoch_results.update(avg_losses)
        epoch_results.update(avg_metrics)
        
        return epoch_results
    
    def validate_epoch(self, epoch: int, class_weights: Optional[torch.Tensor] = None) -> Dict[str, float]:
        """Validate for one epoch."""
        self.model.eval()
        
        total_losses = {}
        total_metrics = {}
        num_batches = len(self.val_loader)
        
        all_damage_preds = []
        all_damage_targets = []
        
        with torch.no_grad():
            progress_bar = tqdm(self.val_loader, desc=f"Validation {epoch+1}")
            
            for batch in progress_bar:
                # Move batch to device
                batch = {k: v.to(self.device) if isinstance(v, torch.Tensor) else v for k, v in batch.items()}
                
                # Forward pass
                outputs = self.model(batch['image'])
                loss, losses = self.compute_loss(outputs, batch, class_weights)
                
                # Compute metrics
                metrics = self.compute_metrics(outputs, batch)
                
                # Accumulate losses and metrics
                for key, value in losses.items():
                    if key not in total_losses:
                        total_losses[key] = 0
                    total_losses[key] += value.item()
                
                for key, value in metrics.items():
                    if key not in total_metrics:
                        total_metrics[key] = 0
                    total_metrics[key] += value
                
                # Collect predictions for confusion matrix
                damage_preds = torch.argmax(outputs['damage_logits'], dim=1)
                all_damage_preds.extend(damage_preds.cpu().numpy())
                all_damage_targets.extend(batch['damage_class'].cpu().numpy())
                
                # Update progress bar
                progress_bar.set_postfix({
                    'Loss': f"{loss.item():.4f}",
                    'Damage Acc': f"{metrics['damage_accuracy']:.3f}",
                    'Severity Acc': f"{metrics['severity_accuracy']:.3f}"
                })
        
        # Average losses and metrics
        avg_losses = {key: value / num_batches for key, value in total_losses.items()}
        avg_metrics = {key: value / num_batches for key, value in total_metrics.items()}
        
        # Generate classification report
        if len(set(all_damage_targets)) > 1:  # Only if we have multiple classes
            damage_classes = ['no_damage', 'hail', 'wind', 'wear', 'impact']
            classification_rep = classification_report(
                all_damage_targets,
                all_damage_preds,
                target_names=damage_classes,
                labels=range(len(damage_classes)),
                output_dict=True,
                zero_division=0
            )
            
            # Add macro averages to metrics
            avg_metrics['macro_precision'] = classification_rep['macro avg']['precision']
            avg_metrics['macro_recall'] = classification_rep['macro avg']['recall']
            avg_metrics['macro_f1'] = classification_rep['macro avg']['f1-score']
        
        # Combine into single dict
        epoch_results = {}
        epoch_results.update({f"val_{key}": value for key, value in avg_losses.items()})
        epoch_results.update({f"val_{key}": value for key, value in avg_metrics.items()})
        
        return epoch_results
    
    def save_checkpoint(self, epoch: int, metrics: Dict[str, float], is_best: bool = False):
        """Save model checkpoint."""
        checkpoint = {
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'scheduler_state_dict': self.scheduler.state_dict(),
            'metrics': metrics,
            'config': self.config,
            'best_val_loss': self.best_val_loss
        }
        
        # Save regular checkpoint
        checkpoint_path = self.checkpoints_dir / f"checkpoint_epoch_{epoch:03d}.pt"
        torch.save(checkpoint, checkpoint_path)
        
        # Save best model
        if is_best:
            best_path = self.checkpoints_dir / "best_model.pt"
            torch.save(checkpoint, best_path)
            logger.info(f"Saved best model with validation loss: {metrics.get('val_total', 0):.4f}")
        
        # Keep only last N checkpoints
        self._cleanup_checkpoints()
    
    def _cleanup_checkpoints(self, keep_last: int = 5):
        """Remove old checkpoints, keeping only the most recent ones."""
        checkpoints = list(self.checkpoints_dir.glob("checkpoint_epoch_*.pt"))
        if len(checkpoints) > keep_last:
            # Sort by modification time and remove oldest
            checkpoints.sort(key=lambda x: x.stat().st_mtime)
            for checkpoint in checkpoints[:-keep_last]:
                checkpoint.unlink()
    
    def train(self, data_dir: str, resume_from: Optional[str] = None):
        """Main training loop."""
        try:
            logger.info("Starting roof damage training...")
            
            # Create datasets and loaders
            class_weights = self.create_datasets_and_loaders(data_dir)
            if class_weights is None:
                logger.error("Failed to create datasets")
                return
            
            # Create model
            self.model = self.create_model()
            self.model = self.model.to(self.device)
            
            # Calculate total training steps
            num_epochs = self.config['training']['num_epochs']
            num_training_steps = len(self.train_loader) * num_epochs
            
            # Create optimizer and scheduler
            self.create_optimizer_and_scheduler(self.model, num_training_steps)
            
            # Resume from checkpoint if specified
            start_epoch = 0
            if resume_from:
                start_epoch = self._load_checkpoint(resume_from)
            
            # Training loop
            patience = self.config['training']['early_stopping_patience']
            patience_counter = 0
            
            for epoch in range(start_epoch, num_epochs):
                self.current_epoch = epoch
                
                logger.info(f"\nEpoch {epoch+1}/{num_epochs}")
                logger.info(f"Learning Rate: {self.optimizer.param_groups[0]['lr']:.2e}")
                
                # Training
                train_metrics = self.train_epoch(epoch, class_weights)
                self.train_metrics.append(train_metrics)
                
                # Validation
                val_metrics = self.validate_epoch(epoch, class_weights)
                self.val_metrics.append(val_metrics)
                
                # Combine metrics
                all_metrics = {**train_metrics, **val_metrics}
                
                # Update scheduler
                if hasattr(self.scheduler, 'step') and 'plateau' in str(type(self.scheduler)).lower():
                    self.scheduler.step(val_metrics['val_total'])
                
                # Log to wandb
                if self.config.get('logging', {}).get('use_wandb', False):
                    wandb.log(all_metrics, step=epoch)
                
                # Check for improvement
                current_val_loss = val_metrics['val_total']
                is_best = current_val_loss < self.best_val_loss
                
                if is_best:
                    self.best_val_loss = current_val_loss
                    patience_counter = 0
                else:
                    patience_counter += 1
                
                # Save checkpoint
                if epoch % self.config['logging']['save_interval'] == 0 or is_best:
                    self.save_checkpoint(epoch, all_metrics, is_best)
                
                # Early stopping
                if patience_counter >= patience:
                    logger.info(f"Early stopping triggered after {patience} epochs without improvement")
                    break
                
                # Log epoch summary
                logger.info(f"Epoch {epoch+1} Summary:")
                logger.info(f"  Train Loss: {train_metrics['total']:.4f}")
                logger.info(f"  Val Loss: {val_metrics['val_total']:.4f}")
                logger.info(f"  Damage Acc: {val_metrics['val_damage_accuracy']:.3f}")
                logger.info(f"  Severity Acc: {val_metrics['val_severity_accuracy']:.3f}")
            
            logger.info("Training completed!")
            
            # Final evaluation
            self.evaluate()
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            raise
    
    def _load_checkpoint(self, checkpoint_path: str) -> int:
        """Load checkpoint and return start epoch."""
        try:
            checkpoint = torch.load(checkpoint_path, map_location=self.device)
            
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
            
            if 'scheduler_state_dict' in checkpoint and self.scheduler:
                self.scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
            
            if 'best_val_loss' in checkpoint:
                self.best_val_loss = checkpoint['best_val_loss']
            
            start_epoch = checkpoint['epoch'] + 1
            logger.info(f"Resumed training from epoch {start_epoch}")
            
            return start_epoch
            
        except Exception as e:
            logger.error(f"Error loading checkpoint: {e}")
            return 0
    
    def evaluate(self, checkpoint_path: Optional[str] = None):
        """Evaluate model on test set."""
        try:
            logger.info("Evaluating model on test set...")
            
            # Load best checkpoint if specified
            if checkpoint_path:
                self._load_checkpoint(checkpoint_path)
            elif (self.checkpoints_dir / "best_model.pt").exists():
                self._load_checkpoint(str(self.checkpoints_dir / "best_model.pt"))
            
            if self.test_loader is None:
                logger.warning("Test loader not available")
                return
            
            self.model.eval()
            
            all_predictions = {
                'damage_preds': [],
                'damage_targets': [],
                'severity_preds': [],
                'severity_targets': [],
                'percentage_preds': [],
                'percentage_targets': [],
                'feature_preds': [],
                'feature_targets': []
            }
            
            total_losses = {}
            total_metrics = {}
            num_batches = len(self.test_loader)
            
            with torch.no_grad():
                for batch in tqdm(self.test_loader, desc="Evaluating"):
                    # Move batch to device
                    batch = {k: v.to(self.device) if isinstance(v, torch.Tensor) else v for k, v in batch.items()}
                    
                    # Forward pass
                    outputs = self.model(batch['image'])
                    loss, losses = self.compute_loss(outputs, batch)
                    
                    # Compute metrics
                    metrics = self.compute_metrics(outputs, batch)
                    
                    # Accumulate losses and metrics
                    for key, value in losses.items():
                        if key not in total_losses:
                            total_losses[key] = 0
                        total_losses[key] += value.item()
                    
                    for key, value in metrics.items():
                        if key not in total_metrics:
                            total_metrics[key] = 0
                        total_metrics[key] += value
                    
                    # Collect predictions
                    damage_preds = torch.argmax(outputs['damage_logits'], dim=1)
                    severity_preds = torch.argmax(outputs['severity_logits'], dim=1)
                    feature_preds = (outputs['feature_probs'] > 0.5).float()
                    
                    all_predictions['damage_preds'].extend(damage_preds.cpu().numpy())
                    all_predictions['damage_targets'].extend(batch['damage_class'].cpu().numpy())
                    all_predictions['severity_preds'].extend(severity_preds.cpu().numpy())
                    all_predictions['severity_targets'].extend(batch['severity'].cpu().numpy())
                    all_predictions['percentage_preds'].extend((outputs['affected_percentage'] * 100).cpu().numpy())
                    all_predictions['percentage_targets'].extend(batch['affected_percentage'].cpu().numpy())
                    all_predictions['feature_preds'].extend(feature_preds.cpu().numpy())
                    all_predictions['feature_targets'].extend(batch['features'].cpu().numpy())
            
            # Average losses and metrics
            avg_losses = {key: value / num_batches for key, value in total_losses.items()}
            avg_metrics = {key: value / num_batches for key, value in total_metrics.items()}
            
            # Generate detailed evaluation report
            evaluation_report = self._generate_evaluation_report(all_predictions, avg_losses, avg_metrics)
            
            # Save evaluation results
            results_file = self.results_dir / f"evaluation_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(results_file, 'w') as f:
                json.dump(evaluation_report, f, indent=2)
            
            logger.info(f"Evaluation completed. Results saved to {results_file}")
            
            # Print summary
            logger.info("Evaluation Summary:")
            logger.info(f"  Test Loss: {avg_losses['total']:.4f}")
            logger.info(f"  Damage Accuracy: {avg_metrics['damage_accuracy']:.3f}")
            logger.info(f"  Severity Accuracy: {avg_metrics['severity_accuracy']:.3f}")
            logger.info(f"  Percentage MAE: {avg_metrics['percentage_mae']:.2f}%")
            
            return evaluation_report
            
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return None
    
    def _generate_evaluation_report(
        self,
        predictions: Dict[str, List],
        losses: Dict[str, float],
        metrics: Dict[str, float]
    ) -> Dict[str, Any]:
        """Generate comprehensive evaluation report."""
        report = {
            'timestamp': datetime.now().isoformat(),
            'model_config': self.config['model'],
            'losses': losses,
            'metrics': metrics,
            'detailed_analysis': {}
        }
        
        # Damage classification analysis
        damage_classes = ['no_damage', 'hail', 'wind', 'wear', 'impact']
        
        if len(set(predictions['damage_targets'])) > 1:
            damage_report = classification_report(
                predictions['damage_targets'],
                predictions['damage_preds'],
                target_names=damage_classes,
                output_dict=True,
                zero_division=0
            )
            report['detailed_analysis']['damage_classification'] = damage_report
            
            # Confusion matrix
            cm = confusion_matrix(predictions['damage_targets'], predictions['damage_preds'])
            report['detailed_analysis']['damage_confusion_matrix'] = cm.tolist()
        
        # Severity classification analysis
        severity_classes = ['none', 'light', 'moderate', 'severe']
        
        if len(set(predictions['severity_targets'])) > 1:
            severity_report = classification_report(
                predictions['severity_targets'],
                predictions['severity_preds'],
                target_names=severity_classes,
                output_dict=True,
                zero_division=0
            )
            report['detailed_analysis']['severity_classification'] = severity_report
        
        # Regression analysis
        percentage_preds = np.array(predictions['percentage_preds'])
        percentage_targets = np.array(predictions['percentage_targets'])
        
        if len(percentage_targets) > 0:
            percentage_corr = np.corrcoef(percentage_preds, percentage_targets)[0, 1]
            percentage_rmse = np.sqrt(np.mean((percentage_preds - percentage_targets) ** 2))
            
            report['detailed_analysis']['percentage_regression'] = {
                'correlation': float(percentage_corr) if not np.isnan(percentage_corr) else 0.0,
                'rmse': float(percentage_rmse),
                'mae': float(np.mean(np.abs(percentage_preds - percentage_targets)))
            }
        
        # Feature detection analysis
        feature_preds = np.array(predictions['feature_preds'])
        feature_targets = np.array(predictions['feature_targets'])
        
        if feature_preds.size > 0:
            feature_f1_per_class = []
            for i in range(feature_preds.shape[1]):
                f1 = f1_score(feature_targets[:, i], feature_preds[:, i], zero_division=0)
                feature_f1_per_class.append(float(f1))
            
            report['detailed_analysis']['feature_detection'] = {
                'f1_per_feature': feature_f1_per_class,
                'macro_f1': float(np.mean(feature_f1_per_class))
            }
        
        return report


def main():
    """Main training function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Roof Damage Model Training')
    parser.add_argument('--config', type=str, help='Path to configuration file')
    parser.add_argument('--data-dir', type=str, required=True, help='Path to dataset directory')
    parser.add_argument('--resume', type=str, help='Path to checkpoint to resume from')
    parser.add_argument('--evaluate-only', action='store_true', help='Only run evaluation')
    parser.add_argument('--checkpoint', type=str, help='Checkpoint for evaluation')
    
    args = parser.parse_args()
    
    try:
        # Initialize trainer
        trainer = RoofDamageTrainer(args.config)
        
        if args.evaluate_only:
            # Run evaluation only
            trainer.create_datasets_and_loaders(args.data_dir)
            trainer.model = trainer.create_model().to(trainer.device)
            trainer.evaluate(args.checkpoint)
        else:
            # Run training
            trainer.train(args.data_dir, args.resume)
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()