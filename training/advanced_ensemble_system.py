#!/usr/bin/env python3
"""
Advanced Ensemble Learning System for Susan AI
Week 1-2 Implementation: Multiple Model Voting System

This ensemble system combines multiple specialized models to achieve both
high specificity (low false positives) and high sensitivity (low false negatives).
Each model in the ensemble specializes in different aspects of roof damage detection.
"""

import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import numpy as np
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass
import json
from datetime import datetime
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class EnsembleConfig:
    """Configuration for ensemble learning system."""
    conservative_weight: float = 0.4    # High specificity model weight
    balanced_weight: float = 0.3        # Balanced model weight  
    sensitive_weight: float = 0.3       # High sensitivity model weight
    confidence_threshold: float = 0.7   # Final decision threshold
    uncertainty_threshold: float = 0.1  # Disagreement threshold for human review

class ConservativeClassifier(nn.Module):
    """
    Conservative classifier optimized for high specificity (low false positives).
    This model inherits from our emergency binary classifier design.
    """
    
    def __init__(self, dropout_rate=0.5):
        super(ConservativeClassifier, self).__init__()
        
        # Deeper, more conservative architecture
        self.feature_extractor = nn.Sequential(
            # Block 1 - Conservative feature extraction
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Dropout2d(0.25),
            
            # Block 2 - Deeper processing
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Dropout2d(0.25),
            
            # Block 3 - High-level features
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Dropout2d(0.25),
            
            nn.AdaptiveAvgPool2d((4, 4))
        )
        
        # Conservative classifier head with high dropout
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(dropout_rate),
            nn.Linear(128 * 4 * 4, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(256, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(64, 2)
        )
        
        # Initialize for conservative predictions
        self._init_conservative_weights()
    
    def _init_conservative_weights(self):
        """Initialize weights to be conservative (bias toward negative class)."""
        for m in self.modules():
            if isinstance(m, nn.Linear) and m == self.classifier[-1]:
                # Bias final layer toward predicting no damage
                with torch.no_grad():
                    m.bias[0] = -0.5  # Bias toward class 0 (no damage)
                    m.bias[1] = 0.5   # Bias against class 1 (damage)
    
    def forward(self, x):
        features = self.feature_extractor(x)
        logits = self.classifier(features)
        return logits

class BalancedClassifier(nn.Module):
    """
    Balanced classifier optimized for overall accuracy.
    Uses standard architecture without conservative bias.
    """
    
    def __init__(self, dropout_rate=0.3):
        super(BalancedClassifier, self).__init__()
        
        self.feature_extractor = nn.Sequential(
            # Standard ResNet-like blocks
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
            
            # Residual-style blocks
            self._make_layer(64, 64, 2),
            self._make_layer(64, 128, 2, stride=2),
            self._make_layer(128, 256, 2, stride=2),
            
            nn.AdaptiveAvgPool2d((1, 1))
        )
        
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(dropout_rate),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(128, 2)
        )
    
    def _make_layer(self, in_channels, out_channels, blocks, stride=1):
        """Create a residual layer."""
        layers = []
        
        # First block with potential stride
        layers.extend([
            nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=stride, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True)
        ])
        
        # Additional blocks
        for _ in range(blocks - 1):
            layers.extend([
                nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1),
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True),
                nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1),
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True)
            ])
        
        return nn.Sequential(*layers)
    
    def forward(self, x):
        features = self.feature_extractor(x)
        logits = self.classifier(features)
        return logits

class SensitiveClassifier(nn.Module):
    """
    Sensitive classifier optimized for high sensitivity (low false negatives).
    Uses attention mechanisms to capture subtle damage patterns.
    """
    
    def __init__(self, dropout_rate=0.2):
        super(SensitiveClassifier, self).__init__()
        
        self.feature_extractor = nn.Sequential(
            # Fine-grained feature extraction
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            
            nn.AdaptiveAvgPool2d((8, 8))
        )
        
        # Attention mechanism for subtle damage detection
        self.attention = nn.Sequential(
            nn.Conv2d(256, 128, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 1, kernel_size=1),
            nn.Sigmoid()
        )
        
        # Sensitive classifier head
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(dropout_rate),  # Lower dropout for sensitivity
            nn.Linear(256 * 8 * 8, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(512, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 2)
        )
        
        # Initialize for sensitive predictions
        self._init_sensitive_weights()
    
    def _init_sensitive_weights(self):
        """Initialize weights to be sensitive (bias toward positive class)."""
        for m in self.modules():
            if isinstance(m, nn.Linear) and m == self.classifier[-1]:
                # Bias final layer toward predicting damage
                with torch.no_grad():
                    m.bias[0] = 0.5   # Bias against class 0 (no damage)
                    m.bias[1] = -0.5  # Bias toward class 1 (damage)
    
    def forward(self, x):
        features = self.feature_extractor(x)
        
        # Apply attention
        attention_weights = self.attention(features)
        attended_features = features * attention_weights
        
        # Classify
        logits = self.classifier(attended_features)
        return logits

class AdvancedEnsembleClassifier:
    """
    Advanced ensemble system that combines multiple specialized classifiers
    with intelligent voting and uncertainty quantification.
    """
    
    def __init__(self, config: EnsembleConfig = None, device: str = 'cpu'):
        self.config = config or EnsembleConfig()
        self.device = device
        
        # Initialize component models
        self.conservative_model = ConservativeClassifier().to(device)
        self.balanced_model = BalancedClassifier().to(device)
        self.sensitive_model = SensitiveClassifier().to(device)
        
        # Model weights for ensemble voting
        self.model_weights = torch.tensor([
            self.config.conservative_weight,
            self.config.balanced_weight,
            self.config.sensitive_weight
        ]).to(device)
        
        # Training components
        self.optimizers = {
            'conservative': optim.AdamW(self.conservative_model.parameters(), lr=1e-4, weight_decay=1e-4),
            'balanced': optim.AdamW(self.balanced_model.parameters(), lr=1e-3, weight_decay=1e-4),
            'sensitive': optim.AdamW(self.sensitive_model.parameters(), lr=1e-3, weight_decay=1e-4)
        }
        
        # Specialized loss functions for each model
        self.loss_functions = {
            'conservative': self._conservative_loss,
            'balanced': nn.CrossEntropyLoss(),
            'sensitive': self._sensitive_loss
        }
        
        logger.info("Advanced Ensemble Classifier initialized")
        logger.info(f"Model weights: Conservative={self.config.conservative_weight}, "
                   f"Balanced={self.config.balanced_weight}, Sensitive={self.config.sensitive_weight}")
    
    def _conservative_loss(self, predictions, targets):
        """Loss function that heavily penalizes false positives."""
        ce_loss = nn.CrossEntropyLoss(reduction='none')
        base_loss = ce_loss(predictions, targets)
        
        # Get predicted classes
        predicted_classes = torch.argmax(predictions, dim=1)
        
        # Heavy penalty for false positives (predicting damage=1 when actual=0)
        false_positive_penalty = 5.0
        false_positive_mask = (predicted_classes == 1) & (targets == 0)
        
        # Apply penalties
        penalized_loss = base_loss.clone()
        penalized_loss[false_positive_mask] *= false_positive_penalty
        
        return penalized_loss.mean()
    
    def _sensitive_loss(self, predictions, targets):
        """Loss function that heavily penalizes false negatives."""
        ce_loss = nn.CrossEntropyLoss(reduction='none')
        base_loss = ce_loss(predictions, targets)
        
        # Get predicted classes
        predicted_classes = torch.argmax(predictions, dim=1)
        
        # Heavy penalty for false negatives (predicting no damage=0 when actual=1)
        false_negative_penalty = 3.0
        false_negative_mask = (predicted_classes == 0) & (targets == 1)
        
        # Apply penalties
        penalized_loss = base_loss.clone()
        penalized_loss[false_negative_mask] *= false_negative_penalty
        
        return penalized_loss.mean()
    
    def predict_ensemble(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Make ensemble predictions with uncertainty quantification.
        
        Args:
            x: Input tensor [batch_size, 3, height, width]
            
        Returns:
            Dictionary containing predictions, confidence, and uncertainty metrics
        """
        self.conservative_model.eval()
        self.balanced_model.eval()
        self.sensitive_model.eval()
        
        with torch.no_grad():
            # Get predictions from all models
            conservative_logits = self.conservative_model(x)
            balanced_logits = self.balanced_model(x)
            sensitive_logits = self.sensitive_model(x)
            
            # Convert to probabilities
            conservative_probs = F.softmax(conservative_logits, dim=1)
            balanced_probs = F.softmax(balanced_logits, dim=1)
            sensitive_probs = F.softmax(sensitive_logits, dim=1)
            
            # Weighted ensemble voting
            ensemble_probs = (
                self.model_weights[0] * conservative_probs +
                self.model_weights[1] * balanced_probs +
                self.model_weights[2] * sensitive_probs
            )
            
            # Final predictions
            ensemble_predictions = torch.argmax(ensemble_probs, dim=1)
            ensemble_confidence = torch.max(ensemble_probs, dim=1)[0]
            
            # Uncertainty quantification (variance across models)
            all_probs = torch.stack([conservative_probs, balanced_probs, sensitive_probs], dim=0)
            prob_variance = torch.var(all_probs, dim=0)
            uncertainty = torch.mean(prob_variance, dim=1)  # Average variance across classes
            
            # Agreement score (how much models agree)
            model_predictions = torch.stack([
                torch.argmax(conservative_probs, dim=1),
                torch.argmax(balanced_probs, dim=1),
                torch.argmax(sensitive_probs, dim=1)
            ], dim=0)
            
            agreement_score = torch.mean(
                (model_predictions == ensemble_predictions.unsqueeze(0)).float(),
                dim=0
            )
            
            return {
                'predictions': ensemble_predictions,
                'probabilities': ensemble_probs,
                'confidence': ensemble_confidence,
                'uncertainty': uncertainty,
                'agreement': agreement_score,
                'individual_predictions': {
                    'conservative': torch.argmax(conservative_probs, dim=1),
                    'balanced': torch.argmax(balanced_probs, dim=1),
                    'sensitive': torch.argmax(sensitive_probs, dim=1)
                },
                'individual_probabilities': {
                    'conservative': conservative_probs,
                    'balanced': balanced_probs,
                    'sensitive': sensitive_probs
                }
            }
    
    def should_request_human_review(self, predictions: Dict[str, torch.Tensor]) -> torch.Tensor:
        """
        Determine which predictions should be sent for human review.
        
        Args:
            predictions: Output from predict_ensemble
            
        Returns:
            Boolean tensor indicating which samples need human review
        """
        # Low confidence predictions
        low_confidence = predictions['confidence'] < self.config.confidence_threshold
        
        # High uncertainty (models disagree significantly)
        high_uncertainty = predictions['uncertainty'] > self.config.uncertainty_threshold
        
        # Low agreement between models
        low_agreement = predictions['agreement'] < 0.7
        
        # Any of these conditions triggers human review
        human_review_needed = low_confidence | high_uncertainty | low_agreement
        
        return human_review_needed
    
    def train_ensemble(self, train_loader, val_loader, num_epochs: int = 20):
        """
        Train the ensemble system with specialized objectives for each model.
        
        Args:
            train_loader: Training data loader
            val_loader: Validation data loader
            num_epochs: Number of training epochs
        """
        logger.info(f"Starting ensemble training for {num_epochs} epochs")
        
        # Training history
        history = {
            'train_loss': {'conservative': [], 'balanced': [], 'sensitive': []},
            'val_accuracy': {'conservative': [], 'balanced': [], 'sensitive': [], 'ensemble': []},
            'val_specificity': {'conservative': [], 'balanced': [], 'sensitive': [], 'ensemble': []},
            'val_sensitivity': {'conservative': [], 'balanced': [], 'sensitive': [], 'ensemble': []}
        }
        
        for epoch in range(num_epochs):
            epoch_start = datetime.now()
            
            # Train each model with its specialized objective
            train_losses = self._train_epoch(train_loader)
            
            # Validate ensemble performance
            val_metrics = self._validate_epoch(val_loader)
            
            # Update history
            for model_name in ['conservative', 'balanced', 'sensitive']:
                history['train_loss'][model_name].append(train_losses[model_name])
                history['val_accuracy'][model_name].append(val_metrics[f'{model_name}_accuracy'])
                history['val_specificity'][model_name].append(val_metrics[f'{model_name}_specificity'])
                history['val_sensitivity'][model_name].append(val_metrics[f'{model_name}_sensitivity'])
            
            # Ensemble metrics
            history['val_accuracy']['ensemble'].append(val_metrics['ensemble_accuracy'])
            history['val_specificity']['ensemble'].append(val_metrics['ensemble_specificity'])
            history['val_sensitivity']['ensemble'].append(val_metrics['ensemble_sensitivity'])
            
            epoch_time = (datetime.now() - epoch_start).total_seconds()
            
            logger.info(f"Epoch {epoch+1}/{num_epochs} - {epoch_time:.1f}s")
            logger.info(f"Ensemble Accuracy: {val_metrics['ensemble_accuracy']:.3f}, "
                       f"Specificity: {val_metrics['ensemble_specificity']:.3f}, "
                       f"Sensitivity: {val_metrics['ensemble_sensitivity']:.3f}")
            
            # Early stopping if ensemble performance is excellent
            if (val_metrics['ensemble_accuracy'] > 0.85 and 
                val_metrics['ensemble_specificity'] > 0.90 and 
                val_metrics['ensemble_sensitivity'] > 0.75):
                logger.info("🎉 Excellent ensemble performance achieved! Early stopping.")
                break
        
        logger.info("Ensemble training completed")
        return history
    
    def _train_epoch(self, train_loader) -> Dict[str, float]:
        """Train all models for one epoch."""
        self.conservative_model.train()
        self.balanced_model.train()
        self.sensitive_model.train()
        
        total_losses = {'conservative': 0.0, 'balanced': 0.0, 'sensitive': 0.0}
        num_batches = len(train_loader)
        
        for batch_idx, (data, targets) in enumerate(train_loader):
            data, targets = data.to(self.device), targets.to(self.device)
            
            # Train conservative model
            self.optimizers['conservative'].zero_grad()
            conservative_outputs = self.conservative_model(data)
            conservative_loss = self.loss_functions['conservative'](conservative_outputs, targets)
            conservative_loss.backward()
            self.optimizers['conservative'].step()
            total_losses['conservative'] += conservative_loss.item()
            
            # Train balanced model
            self.optimizers['balanced'].zero_grad()
            balanced_outputs = self.balanced_model(data)
            balanced_loss = self.loss_functions['balanced'](balanced_outputs, targets)
            balanced_loss.backward()
            self.optimizers['balanced'].step()
            total_losses['balanced'] += balanced_loss.item()
            
            # Train sensitive model
            self.optimizers['sensitive'].zero_grad()
            sensitive_outputs = self.sensitive_model(data)
            sensitive_loss = self.loss_functions['sensitive'](sensitive_outputs, targets)
            sensitive_loss.backward()
            self.optimizers['sensitive'].step()
            total_losses['sensitive'] += sensitive_loss.item()
        
        # Average losses
        return {name: loss / num_batches for name, loss in total_losses.items()}
    
    def _validate_epoch(self, val_loader) -> Dict[str, float]:
        """Validate ensemble performance."""
        self.conservative_model.eval()
        self.balanced_model.eval()
        self.sensitive_model.eval()
        
        all_targets = []
        all_predictions = {'conservative': [], 'balanced': [], 'sensitive': [], 'ensemble': []}
        
        with torch.no_grad():
            for data, targets in val_loader:
                data, targets = data.to(self.device), targets.to(self.device)
                
                # Get ensemble predictions
                ensemble_results = self.predict_ensemble(data)
                
                # Store predictions
                all_targets.extend(targets.cpu().numpy())
                all_predictions['conservative'].extend(
                    ensemble_results['individual_predictions']['conservative'].cpu().numpy()
                )
                all_predictions['balanced'].extend(
                    ensemble_results['individual_predictions']['balanced'].cpu().numpy()
                )
                all_predictions['sensitive'].extend(
                    ensemble_results['individual_predictions']['sensitive'].cpu().numpy()
                )
                all_predictions['ensemble'].extend(
                    ensemble_results['predictions'].cpu().numpy()
                )
        
        # Calculate metrics for all models
        metrics = {}
        
        for model_name, predictions in all_predictions.items():
            accuracy = accuracy_score(all_targets, predictions)
            
            # Calculate confusion matrix for specificity/sensitivity
            cm = confusion_matrix(all_targets, predictions)
            if cm.shape == (2, 2):
                tn, fp, fn, tp = cm.ravel()
                specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
                sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            else:
                specificity = sensitivity = 0.0
            
            metrics.update({
                f'{model_name}_accuracy': accuracy,
                f'{model_name}_specificity': specificity,
                f'{model_name}_sensitivity': sensitivity
            })
        
        return metrics
    
    def save_ensemble(self, save_path: str):
        """Save the complete ensemble system."""
        save_path = Path(save_path)
        save_path.mkdir(parents=True, exist_ok=True)
        
        # Save models
        torch.save(self.conservative_model.state_dict(), save_path / "conservative_model.pt")
        torch.save(self.balanced_model.state_dict(), save_path / "balanced_model.pt") 
        torch.save(self.sensitive_model.state_dict(), save_path / "sensitive_model.pt")
        
        # Save configuration
        config_dict = {
            'conservative_weight': self.config.conservative_weight,
            'balanced_weight': self.config.balanced_weight,
            'sensitive_weight': self.config.sensitive_weight,
            'confidence_threshold': self.config.confidence_threshold,
            'uncertainty_threshold': self.config.uncertainty_threshold
        }
        
        with open(save_path / "ensemble_config.json", 'w') as f:
            json.dump(config_dict, f, indent=2)
        
        logger.info(f"Ensemble system saved to {save_path}")
    
    def load_ensemble(self, load_path: str):
        """Load a saved ensemble system."""
        load_path = Path(load_path)
        
        # Load models
        self.conservative_model.load_state_dict(torch.load(load_path / "conservative_model.pt"))
        self.balanced_model.load_state_dict(torch.load(load_path / "balanced_model.pt"))
        self.sensitive_model.load_state_dict(torch.load(load_path / "sensitive_model.pt"))
        
        # Load configuration
        with open(load_path / "ensemble_config.json", 'r') as f:
            config_dict = json.load(f)
        
        self.config = EnsembleConfig(**config_dict)
        self.model_weights = torch.tensor([
            self.config.conservative_weight,
            self.config.balanced_weight,
            self.config.sensitive_weight
        ]).to(self.device)
        
        logger.info(f"Ensemble system loaded from {load_path}")


def demo_ensemble_system():
    """Demonstrate the advanced ensemble system with dummy data."""
    logger.info("🤖 Demonstrating Advanced Ensemble Learning System")
    
    # Create ensemble with balanced configuration
    config = EnsembleConfig(
        conservative_weight=0.4,  # High weight for conservative model (prevents false positives)
        balanced_weight=0.3,      # Standard weight for balanced model
        sensitive_weight=0.3,     # Standard weight for sensitive model  
        confidence_threshold=0.7,
        uncertainty_threshold=0.1
    )
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    ensemble = AdvancedEnsembleClassifier(config, device)
    
    # Create dummy data for demonstration
    batch_size = 16
    dummy_images = torch.randn(batch_size, 3, 224, 224).to(device)
    
    logger.info("🔍 Making ensemble predictions on dummy data...")
    
    # Make predictions
    results = ensemble.predict_ensemble(dummy_images)
    
    # Analyze results
    logger.info("\n📊 ENSEMBLE PREDICTION RESULTS:")
    logger.info(f"Batch size: {batch_size}")
    
    # Individual model agreement
    conservative_preds = results['individual_predictions']['conservative']
    balanced_preds = results['individual_predictions']['balanced']
    sensitive_preds = results['individual_predictions']['sensitive']
    ensemble_preds = results['predictions']
    
    logger.info(f"Conservative model predictions: {conservative_preds.cpu().numpy()}")
    logger.info(f"Balanced model predictions: {balanced_preds.cpu().numpy()}")
    logger.info(f"Sensitive model predictions: {sensitive_preds.cpu().numpy()}")
    logger.info(f"Ensemble predictions: {ensemble_preds.cpu().numpy()}")
    
    # Confidence and uncertainty analysis
    avg_confidence = torch.mean(results['confidence']).item()
    avg_uncertainty = torch.mean(results['uncertainty']).item()
    avg_agreement = torch.mean(results['agreement']).item()
    
    logger.info(f"\n🎯 ENSEMBLE ANALYSIS:")
    logger.info(f"Average confidence: {avg_confidence:.3f}")
    logger.info(f"Average uncertainty: {avg_uncertainty:.3f}")
    logger.info(f"Average model agreement: {avg_agreement:.3f}")
    
    # Human review recommendations
    human_review_needed = ensemble.should_request_human_review(results)
    num_human_reviews = torch.sum(human_review_needed).item()
    
    logger.info(f"Samples requiring human review: {num_human_reviews}/{batch_size} ({100*num_human_reviews/batch_size:.1f}%)")
    
    logger.info("\n✅ Advanced Ensemble System Demo Complete!")
    
    return ensemble


if __name__ == "__main__":
    # Run ensemble demonstration
    ensemble = demo_ensemble_system()
    
    logger.info("\n🎯 ENSEMBLE SYSTEM READY FOR SUSAN AI INTEGRATION")
    logger.info("Next steps:")
    logger.info("1. Integrate with actual roof damage dataset")
    logger.info("2. Train ensemble on balanced damaged/undamaged samples")
    logger.info("3. Deploy in Susan AI production pipeline")
    logger.info("4. Monitor ensemble performance and model agreement")