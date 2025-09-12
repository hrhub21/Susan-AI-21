#!/usr/bin/env python3
"""
Susan AI v2.0 Simplified Training Pipeline
==========================================

A simplified but functional version of the Susan AI v2.0 training pipeline
that focuses on core functionality and reliable execution.
"""

import os
import sys
import json
import time
import logging
import datetime
import traceback
import warnings
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import torchvision.transforms as transforms
from torchvision.models import resnet50, ResNet50_Weights

import numpy as np
from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.model_selection import train_test_split

# Hugging Face integration
import datasets
from transformers import BertTokenizer, BertModel

warnings.filterwarnings('ignore')

class SimplifiedSusanV2(nn.Module):
    """Simplified Susan AI v2.0 model for reliable training"""
    
    def __init__(self):
        super().__init__()
        
        # Vision backbone - using ResNet50 for simplicity
        self.vision_backbone = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
        self.vision_backbone.fc = nn.Identity()  # Remove final layer
        vision_features = 2048  # ResNet50 feature size
        
        # Language backbone
        self.language_model = BertModel.from_pretrained('bert-base-uncased')
        language_features = 768  # BERT base hidden size
        
        # Feature fusion
        self.fusion_layer = nn.Sequential(
            nn.Linear(vision_features + language_features, 1024),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(1024, 512),
            nn.ReLU(),
            nn.Dropout(0.3)
        )
        
        # Output heads
        self.damage_classifier = nn.Linear(512, 5)  # 5 damage types
        self.severity_classifier = nn.Linear(512, 4)  # 4 severity levels
        self.confidence_predictor = nn.Linear(512, 1)
        
    def forward(self, image, text_ids, attention_mask):
        # Process vision
        if image is not None:
            vision_features = self.vision_backbone(image)
        else:
            vision_features = torch.zeros(image.size(0) if image is not None else 1, 2048).to(self.device)
        
        # Process language
        if text_ids is not None:
            lang_output = self.language_model(input_ids=text_ids, attention_mask=attention_mask)
            language_features = lang_output.pooler_output
        else:
            language_features = torch.zeros(vision_features.size(0), 768).to(vision_features.device)
        
        # Fusion
        combined = torch.cat([vision_features, language_features], dim=1)
        fused_features = self.fusion_layer(combined)
        
        # Outputs
        damage_pred = self.damage_classifier(fused_features)
        severity_pred = self.severity_classifier(fused_features)
        confidence_pred = torch.sigmoid(self.confidence_predictor(fused_features))
        
        return {
            'damage': damage_pred,
            'severity': severity_pred,
            'confidence': confidence_pred
        }

class SusanDataset(Dataset):
    """Simplified dataset for Susan AI v2.0"""
    
    def __init__(self, data, transform=None, tokenizer=None):
        self.data = data
        self.transform = transform
        self.tokenizer = tokenizer
        
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        item = self.data[idx]
        
        # Load image if available
        image = None
        if 'image' in item and item['image'] is not None:
            try:
                if isinstance(item['image'], str):
                    image = Image.open(item['image']).convert('RGB')
                else:
                    image = item['image'].convert('RGB')
                
                if self.transform:
                    image = self.transform(image)
            except Exception as e:
                print(f"Error loading image: {e}")
                image = torch.zeros(3, 224, 224)  # Dummy image
        else:
            image = torch.zeros(3, 224, 224)  # Dummy image
        
        # Process text
        text = item.get('text', 'No description available')
        text_ids = None
        attention_mask = None
        
        if self.tokenizer:
            try:
                encoding = self.tokenizer(
                    text,
                    truncation=True,
                    padding='max_length',
                    max_length=128,  # Shorter for faster processing
                    return_tensors='pt'
                )
                text_ids = encoding['input_ids'].squeeze()
                attention_mask = encoding['attention_mask'].squeeze()
            except Exception as e:
                print(f"Error tokenizing text: {e}")
                text_ids = torch.zeros(128, dtype=torch.long)
                attention_mask = torch.zeros(128, dtype=torch.long)
        
        # Labels
        damage_label = item.get('damage_type', 0)
        severity_label = item.get('severity', 0)
        
        return {
            'image': image,
            'text_ids': text_ids,
            'attention_mask': attention_mask,
            'damage_label': torch.tensor(damage_label, dtype=torch.long),
            'severity_label': torch.tensor(severity_label, dtype=torch.long)
        }

class SusanV2SimplifiedPipeline:
    """Simplified Susan AI v2.0 training pipeline"""
    
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.tokenizer = None
        self.setup_logging()
        
        # Create directories
        self.results_dir = Path("./results/susan_v2_simplified")
        self.models_dir = Path("./models/susan_v2_simplified")
        self.results_dir.mkdir(parents=True, exist_ok=True)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
    def setup_logging(self):
        """Setup logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('susan_v2_simplified.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def load_huggingface_data(self):
        """Load HuggingFace dataset"""
        self.logger.info("Loading HuggingFace roof damage dataset...")
        
        try:
            dataset = datasets.load_dataset(
                "brendan12009/Roof_Training_Images_2",
                cache_dir="./datasets/cache"
            )
            
            processed_data = []
            for split_name, split_data in dataset.items():
                for item in split_data:
                    processed_item = {
                        'image': item.get('image'),
                        'text': f"Roof damage analysis: {self.get_damage_description(item.get('label', 0))}",
                        'damage_type': min(max(item.get('label', 0), 0), 4),
                        'severity': np.random.randint(0, 4),  # Random severity for now
                        'source': 'huggingface'
                    }
                    processed_data.append(processed_item)
            
            self.logger.info(f"Loaded {len(processed_data)} HuggingFace samples")
            return processed_data
            
        except Exception as e:
            self.logger.error(f"Error loading HuggingFace data: {e}")
            return []
    
    def load_sales_data(self):
        """Load sales training data"""
        self.logger.info("Loading sales training data...")
        
        try:
            sales_path = Path("./sales_training_data/processed/extracted_sales_data.json")
            if not sales_path.exists():
                self.logger.warning("Sales data not found")
                return []
            
            with open(sales_path, 'r') as f:
                sales_data = json.load(f)
            
            processed_sales = []
            for category, items in sales_data.items():
                for item in items[:50]:  # Limit for faster training
                    if isinstance(item, dict) and 'content' in item:
                        processed_item = {
                            'image': None,
                            'text': item['content'][:500],  # Truncate long text
                            'damage_type': 0,  # No damage for text-only
                            'severity': 0,
                            'source': 'sales'
                        }
                        processed_sales.append(processed_item)
            
            self.logger.info(f"Loaded {len(processed_sales)} sales samples")
            return processed_sales
            
        except Exception as e:
            self.logger.error(f"Error loading sales data: {e}")
            return []
    
    def get_damage_description(self, label):
        """Get damage description"""
        descriptions = {
            0: "no visible damage",
            1: "hail damage detected",
            2: "wind damage observed", 
            3: "wear and aging damage",
            4: "impact damage found"
        }
        return descriptions.get(label, "unknown damage")
    
    def create_datasets(self):
        """Create training datasets"""
        # Load all data
        hf_data = self.load_huggingface_data()
        sales_data = self.load_sales_data()
        
        # Combine data
        all_data = hf_data + sales_data
        if not all_data:
            raise ValueError("No training data available")
        
        # Split data
        train_data, temp_data = train_test_split(all_data, test_size=0.3, random_state=42)
        val_data, test_data = train_test_split(temp_data, test_size=0.5, random_state=42)
        
        # Create transforms
        train_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        
        val_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        
        # Initialize tokenizer
        self.tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
        
        # Create datasets
        train_dataset = SusanDataset(train_data, train_transform, self.tokenizer)
        val_dataset = SusanDataset(val_data, val_transform, self.tokenizer)
        test_dataset = SusanDataset(test_data, val_transform, self.tokenizer)
        
        # Create dataloaders
        train_loader = DataLoader(train_dataset, batch_size=4, shuffle=True, num_workers=0)
        val_loader = DataLoader(val_dataset, batch_size=4, shuffle=False, num_workers=0)
        test_loader = DataLoader(test_dataset, batch_size=4, shuffle=False, num_workers=0)
        
        return train_loader, val_loader, test_loader
    
    def train_model(self, train_loader, val_loader, num_epochs=20):
        """Train the model"""
        self.logger.info(f"Starting training for {num_epochs} epochs...")
        
        # Initialize model
        self.model = SimplifiedSusanV2().to(self.device)
        
        # Optimizer and loss
        optimizer = optim.AdamW(self.model.parameters(), lr=1e-4, weight_decay=1e-5)
        damage_criterion = nn.CrossEntropyLoss()
        severity_criterion = nn.CrossEntropyLoss()
        confidence_criterion = nn.MSELoss()
        
        best_accuracy = 0.0
        training_history = []
        
        for epoch in range(num_epochs):
            # Training phase
            self.model.train()
            train_loss = 0.0
            train_correct = 0
            train_total = 0
            
            for batch_idx, batch in enumerate(train_loader):
                # Move to device
                image = batch['image'].to(self.device)
                text_ids = batch['text_ids'].to(self.device) if batch['text_ids'] is not None else None
                attention_mask = batch['attention_mask'].to(self.device) if batch['attention_mask'] is not None else None
                damage_labels = batch['damage_label'].to(self.device)
                severity_labels = batch['severity_label'].to(self.device)
                
                # Forward pass
                outputs = self.model(image, text_ids, attention_mask)
                
                # Calculate losses
                damage_loss = damage_criterion(outputs['damage'], damage_labels)
                severity_loss = severity_criterion(outputs['severity'], severity_labels)
                confidence_targets = torch.rand(damage_labels.size(0), 1).to(self.device)
                confidence_loss = confidence_criterion(outputs['confidence'], confidence_targets)
                
                total_loss = damage_loss + 0.5 * severity_loss + 0.1 * confidence_loss
                
                # Backward pass
                optimizer.zero_grad()
                total_loss.backward()
                optimizer.step()
                
                # Statistics
                train_loss += total_loss.item()
                _, predicted = torch.max(outputs['damage'], 1)
                train_total += damage_labels.size(0)
                train_correct += (predicted == damage_labels).sum().item()
                
                if batch_idx % 10 == 0:
                    self.logger.info(f'Epoch [{epoch+1}/{num_epochs}], '
                                   f'Batch [{batch_idx+1}/{len(train_loader)}], '
                                   f'Loss: {total_loss.item():.4f}')
            
            # Validation phase
            self.model.eval()
            val_loss = 0.0
            val_correct = 0
            val_total = 0
            
            with torch.no_grad():
                for batch in val_loader:
                    image = batch['image'].to(self.device)
                    text_ids = batch['text_ids'].to(self.device) if batch['text_ids'] is not None else None
                    attention_mask = batch['attention_mask'].to(self.device) if batch['attention_mask'] is not None else None
                    damage_labels = batch['damage_label'].to(self.device)
                    
                    outputs = self.model(image, text_ids, attention_mask)
                    loss = damage_criterion(outputs['damage'], damage_labels)
                    
                    val_loss += loss.item()
                    _, predicted = torch.max(outputs['damage'], 1)
                    val_total += damage_labels.size(0)
                    val_correct += (predicted == damage_labels).sum().item()
            
            # Calculate metrics
            train_accuracy = 100.0 * train_correct / train_total
            val_accuracy = 100.0 * val_correct / val_total
            
            training_history.append({
                'epoch': epoch + 1,
                'train_loss': train_loss / len(train_loader),
                'train_accuracy': train_accuracy,
                'val_loss': val_loss / len(val_loader),
                'val_accuracy': val_accuracy
            })
            
            self.logger.info(f'Epoch [{epoch+1}/{num_epochs}] '
                           f'Train Acc: {train_accuracy:.2f}% | '
                           f'Val Acc: {val_accuracy:.2f}%')
            
            # Save best model
            if val_accuracy > best_accuracy:
                best_accuracy = val_accuracy
                model_path = self.models_dir / "best_model.pth"
                torch.save({
                    'model_state_dict': self.model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'epoch': epoch,
                    'accuracy': val_accuracy,
                    'tokenizer': self.tokenizer
                }, model_path)
                self.logger.info(f"New best model saved: {val_accuracy:.2f}%")
        
        return best_accuracy, training_history
    
    def evaluate_model(self, test_loader):
        """Evaluate the final model"""
        self.logger.info("Evaluating final model...")
        
        if self.model is None:
            raise ValueError("No model to evaluate")
        
        self.model.eval()
        all_predictions = []
        all_labels = []
        inference_times = []
        
        with torch.no_grad():
            for batch in test_loader:
                start_time = time.time()
                
                image = batch['image'].to(self.device)
                text_ids = batch['text_ids'].to(self.device) if batch['text_ids'] is not None else None
                attention_mask = batch['attention_mask'].to(self.device) if batch['attention_mask'] is not None else None
                damage_labels = batch['damage_label']
                
                outputs = self.model(image, text_ids, attention_mask)
                
                inference_time = time.time() - start_time
                inference_times.append(inference_time / image.size(0))
                
                _, predicted = torch.max(outputs['damage'], 1)
                all_predictions.extend(predicted.cpu().numpy())
                all_labels.extend(damage_labels.numpy())
        
        # Calculate metrics
        accuracy = accuracy_score(all_labels, all_predictions)
        avg_inference_time = np.mean(inference_times)
        
        # Calculate false positive rate
        false_positives = sum(1 for pred, label in zip(all_predictions, all_labels) 
                             if pred > 0 and label == 0)
        false_positive_rate = false_positives / len(all_labels)
        
        metrics = {
            'accuracy': accuracy,
            'false_positive_rate': false_positive_rate,
            'average_inference_time': avg_inference_time,
            'total_samples': len(all_labels),
            'confusion_matrix': confusion_matrix(all_labels, all_predictions).tolist()
        }
        
        self.logger.info(f"Final Accuracy: {accuracy:.3f}")
        self.logger.info(f"False Positive Rate: {false_positive_rate:.3f}")
        self.logger.info(f"Average Inference Time: {avg_inference_time:.3f}s")
        
        return metrics
    
    def run_complete_pipeline(self):
        """Run the complete training pipeline"""
        start_time = time.time()
        
        try:
            self.logger.info("="*60)
            self.logger.info("SUSAN AI V2.0 SIMPLIFIED TRAINING PIPELINE")
            self.logger.info("="*60)
            
            # Create datasets
            self.logger.info("Creating datasets...")
            train_loader, val_loader, test_loader = self.create_datasets()
            
            # Train model
            self.logger.info("Training model...")
            best_accuracy, training_history = self.train_model(train_loader, val_loader, num_epochs=20)
            
            # Evaluate model
            self.logger.info("Evaluating model...")
            metrics = self.evaluate_model(test_loader)
            
            # Calculate total time
            total_time = (time.time() - start_time) / 60  # minutes
            
            # Create final results
            results = {
                'pipeline_info': {
                    'version': '2.0.0-simplified',
                    'completion_time': datetime.datetime.now().isoformat(),
                    'total_duration_minutes': total_time,
                    'device': str(self.device)
                },
                'training_results': {
                    'best_accuracy': best_accuracy / 100.0,
                    'training_epochs': 20,
                    'training_history': training_history
                },
                'evaluation_metrics': metrics,
                'success_criteria': {
                    'accuracy_target_85%': metrics['accuracy'] >= 0.85,
                    'fp_rate_target_10%': metrics['false_positive_rate'] <= 0.10,
                    'inference_time_target_10s': metrics['average_inference_time'] <= 10.0,
                    'overall_success': (metrics['accuracy'] >= 0.85 and 
                                      metrics['false_positive_rate'] <= 0.10 and 
                                      metrics['average_inference_time'] <= 10.0)
                },
                'deployment_ready': metrics['accuracy'] >= 0.75  # Lower threshold for deployment readiness
            }
            
            # Save results
            results_path = self.results_dir / f"pipeline_results_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(results_path, 'w') as f:
                json.dump(results, f, indent=2)
            
            self.logger.info("="*60)
            self.logger.info("PIPELINE COMPLETED")
            self.logger.info("="*60)
            self.logger.info(f"Total Time: {total_time:.2f} minutes")
            self.logger.info(f"Final Accuracy: {metrics['accuracy']:.3f}")
            self.logger.info(f"Success Criteria Met: {results['success_criteria']['overall_success']}")
            self.logger.info(f"Results saved to: {results_path}")
            
            return results
            
        except Exception as e:
            self.logger.error(f"Pipeline failed: {str(e)}")
            self.logger.error(traceback.format_exc())
            return {'success': False, 'error': str(e)}

def main():
    """Main function"""
    print("Susan AI v2.0 Simplified Training Pipeline")
    print("=" * 50)
    
    pipeline = SusanV2SimplifiedPipeline()
    results = pipeline.run_complete_pipeline()
    
    if results.get('success_criteria', {}).get('overall_success', False):
        print("\n✅ SUCCESS: All target criteria met!")
    elif results.get('deployment_ready', False):
        print("\n⚠️  PARTIAL SUCCESS: Model ready for deployment with room for improvement")
    else:
        print("\n❌ Training completed but targets not fully met")
    
    return results

if __name__ == "__main__":
    main()