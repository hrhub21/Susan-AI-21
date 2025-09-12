#!/usr/bin/env python3
"""
Roof Damage Training Dataset Downloader
Downloads and processes roof damage datasets from HuggingFace Hub
Integrates with Susan AI's comprehensive roofing analysis system
"""

import os
import sys
import json
import yaml
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
import requests
from tqdm import tqdm
import pandas as pd
from datasets import load_dataset, Dataset
from PIL import Image
import numpy as np
import cv2
from transformers import AutoTokenizer, AutoProcessor
import torch
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import shutil
import hashlib
from datetime import datetime
import zipfile
import tarfile

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RoofDamageDatasetDownloader:
    """
    Advanced dataset downloader and processor for roof damage training data.
    Specifically designed to work with the brendan12009/Roof_Training_Images_2 dataset
    and integrate with Susan AI's existing infrastructure.
    """
    
    def __init__(self, config_path: str = None):
        """Initialize the dataset downloader with configuration."""
        self.base_dir = Path(__file__).parent
        self.config_path = config_path or self.base_dir / "training_config.yaml"
        self.load_config()
        
        # Setup directories
        self.datasets_dir = self.base_dir / "datasets"
        self.processed_dir = self.datasets_dir / "processed"
        self.raw_dir = self.datasets_dir / "raw"
        self.cache_dir = self.datasets_dir / "cache"
        
        # Create directories
        for dir_path in [self.datasets_dir, self.processed_dir, self.raw_dir, self.cache_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # Dataset configuration
        self.dataset_name = "brendan12009/Roof_Training_Images_2"
        self.hf_token = os.getenv('HUGGINGFACE_TOKEN', None)
        
        # Damage categories mapping
        self.damage_categories = {
            'hail': {
                'subcategories': ['light_hail', 'moderate_hail', 'severe_hail'],
                'severity_levels': ['light', 'moderate', 'severe'],
                'features': ['circular_impacts', 'granule_loss', 'exposed_mat']
            },
            'wind': {
                'subcategories': ['lifted_shingles', 'missing_shingles', 'torn_shingles'],
                'severity_levels': ['light', 'moderate', 'severe'],
                'features': ['edge_lifting', 'tab_separation', 'complete_loss']
            },
            'wear': {
                'subcategories': ['normal_wear', 'accelerated_wear', 'end_of_life'],
                'severity_levels': ['light', 'moderate', 'severe'],
                'features': ['granule_loss', 'curling', 'cracking']
            },
            'impact': {
                'subcategories': ['small_impact', 'large_impact', 'penetrating_impact'],
                'severity_levels': ['light', 'moderate', 'severe'],
                'features': ['dents', 'cracks', 'holes']
            },
            'no_damage': {
                'subcategories': ['pristine', 'slight_aging', 'normal_condition'],
                'severity_levels': ['none'],
                'features': ['intact_granules', 'proper_alignment', 'no_visible_damage']
            }
        }
        
        # Image processing configuration
        self.image_config = {
            'target_size': (512, 512),
            'max_size': (1024, 1024),
            'quality': 95,
            'formats': ['jpg', 'jpeg', 'png', 'webp'],
            'color_space': 'RGB'
        }
        
        logger.info("RoofDamageDatasetDownloader initialized successfully")
    
    def load_config(self):
        """Load configuration from YAML file."""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    self.config = yaml.safe_load(f)
                logger.info(f"Loaded configuration from {self.config_path}")
            else:
                # Default configuration
                self.config = self.create_default_config()
                logger.info("Using default configuration")
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            self.config = self.create_default_config()
    
    def create_default_config(self) -> Dict[str, Any]:
        """Create default configuration for the dataset downloader."""
        return {
            'dataset': {
                'name': 'brendan12009/Roof_Training_Images_2',
                'splits': ['train', 'validation', 'test'],
                'validation_split': 0.2,
                'test_split': 0.1,
                'random_seed': 42
            },
            'processing': {
                'image_size': [512, 512],
                'batch_size': 32,
                'num_workers': 4,
                'augmentation': True,
                'normalize': True
            },
            'augmentation': {
                'rotation_range': 15,
                'zoom_range': 0.1,
                'brightness_range': 0.2,
                'contrast_range': 0.2,
                'horizontal_flip': True,
                'vertical_flip': False
            },
            'quality_control': {
                'min_image_size': [224, 224],
                'max_file_size_mb': 50,
                'allowed_formats': ['jpg', 'jpeg', 'png', 'webp'],
                'corruption_check': True
            }
        }
    
    def download_dataset(self, use_cache: bool = True) -> bool:
        """
        Download the roof damage dataset from HuggingFace Hub.
        
        Args:
            use_cache: Whether to use cached version if available
            
        Returns:
            bool: Success status
        """
        try:
            logger.info(f"Downloading dataset: {self.dataset_name}")
            
            # Check if cached version exists
            cache_file = self.cache_dir / f"{self.dataset_name.replace('/', '_')}_metadata.json"
            if use_cache and cache_file.exists():
                logger.info("Using cached dataset metadata")
                # Still need to load the actual dataset
                dataset = load_dataset(
                    self.dataset_name,
                    token=self.hf_token,
                    cache_dir=str(self.cache_dir)
                )
                self.dataset = dataset
                return True
            
            # Download dataset
            dataset = load_dataset(
                self.dataset_name,
                token=self.hf_token,
                cache_dir=str(self.cache_dir)
            )
            
            logger.info(f"Dataset downloaded successfully. Available splits: {list(dataset.keys())}")
            
            # Save metadata
            metadata = {
                'dataset_name': self.dataset_name,
                'download_date': datetime.now().isoformat(),
                'splits': list(dataset.keys()),
                'total_samples': sum(len(split) for split in dataset.values()),
                'features': list(dataset[list(dataset.keys())[0]].features.keys()) if dataset else []
            }
            
            with open(cache_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Store dataset reference
            self.dataset = dataset
            logger.info(f"Dataset metadata saved to {cache_file}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error downloading dataset: {e}")
            return False
    
    def analyze_dataset_structure(self) -> Dict[str, Any]:
        """
        Analyze the structure and content of the downloaded dataset.
        
        Returns:
            Dict containing analysis results
        """
        try:
            if not hasattr(self, 'dataset'):
                logger.error("Dataset not loaded. Please download first.")
                return {}
            
            analysis = {
                'dataset_info': {},
                'label_distribution': {},
                'image_analysis': {},
                'quality_metrics': {}
            }
            
            logger.info("Analyzing dataset structure...")
            
            # Analyze each split
            for split_name, split_data in self.dataset.items():
                logger.info(f"Analyzing {split_name} split...")
                
                # Basic info
                analysis['dataset_info'][split_name] = {
                    'num_samples': len(split_data),
                    'features': list(split_data.features.keys()),
                    'feature_types': {k: str(v) for k, v in split_data.features.items()}
                }
                
                # Label distribution
                if 'label' in split_data.features:
                    labels = split_data['label']
                    unique_labels, counts = np.unique(labels, return_counts=True)
                    analysis['label_distribution'][split_name] = dict(zip(unique_labels.tolist(), counts.tolist()))
                
                # Sample image analysis (first 100 samples)
                sample_size = min(100, len(split_data))
                image_sizes = []
                file_sizes = []
                
                for i in tqdm(range(sample_size), desc=f"Analyzing {split_name} images"):
                    try:
                        sample = split_data[i]
                        if 'image' in sample:
                            img = sample['image']
                            if isinstance(img, Image.Image):
                                image_sizes.append(img.size)
                                # Estimate file size (rough approximation)
                                file_sizes.append(len(img.tobytes()))
                    except Exception as e:
                        logger.warning(f"Error analyzing sample {i}: {e}")
                
                if image_sizes:
                    analysis['image_analysis'][split_name] = {
                        'avg_width': np.mean([s[0] for s in image_sizes]),
                        'avg_height': np.mean([s[1] for s in image_sizes]),
                        'min_width': min([s[0] for s in image_sizes]),
                        'max_width': max([s[0] for s in image_sizes]),
                        'min_height': min([s[1] for s in image_sizes]),
                        'max_height': max([s[1] for s in image_sizes]),
                        'avg_file_size_bytes': np.mean(file_sizes) if file_sizes else 0
                    }
            
            # Save analysis results
            analysis_file = self.processed_dir / 'dataset_analysis.json'
            with open(analysis_file, 'w') as f:
                json.dump(analysis, f, indent=2)
            
            logger.info(f"Dataset analysis completed and saved to {analysis_file}")
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing dataset: {e}")
            return {}
    
    def create_damage_labels(self, sample: Dict[str, Any], label_names: List[str] = None) -> Dict[str, Any]:
        """
        Create comprehensive damage labels from sample data.
        
        Args:
            sample: Dataset sample
            label_names: List of label names for index mapping
            
        Returns:
            Enhanced labels dictionary
        """
        labels = {
            'primary_damage': 'no_damage',
            'severity': 'none',
            'confidence': 0.0,
            'damage_features': [],
            'quantification': {
                'affected_percentage': 0.0,
                'damage_count': 0,
                'repair_priority': 'low'
            },
            'metadata': {
                'weather_related': False,
                'age_related': False,
                'impact_related': False
            }
        }
        
        # Extract damage information from existing labels
        if 'label' in sample:
            original_label = sample['label']
            
            # For HuggingFace datasets, label is usually an index
            if isinstance(original_label, int) and label_names:
                if 0 <= original_label < len(label_names):
                    label_name = label_names[original_label]
                    labels.update(self._map_string_label(label_name))
            elif isinstance(original_label, str):
                labels.update(self._map_string_label(original_label))
            elif isinstance(original_label, (int, float)):
                labels.update(self._map_numeric_label(original_label))
        
        # Extract additional information from text descriptions if available
        if 'description' in sample or 'text' in sample:
            text = sample.get('description', sample.get('text', ''))
            if text:
                labels.update(self._extract_from_description(text))
        
        return labels
    
    def _map_string_label(self, label: str) -> Dict[str, Any]:
        """Map string labels to our categorization system."""
        label_lower = label.lower()
        
        # Handle the specific dataset labels - check undamaged first!
        if 'undamaged' in label_lower:
            return {'primary_damage': 'no_damage', 'severity': 'none', 'confidence': 0.9}
        elif 'damaged' in label_lower and 'roof' in label_lower:
            # For the binary dataset, we don't know the specific damage type
            # So we map to a generic 'hail' damage with moderate confidence
            return {'primary_damage': 'hail', 'severity': 'moderate', 'confidence': 0.7}
        elif 'no damage' in label_lower:
            return {'primary_damage': 'no_damage', 'severity': 'none', 'confidence': 0.9}
        
        # Hail damage patterns
        elif any(term in label_lower for term in ['hail', 'impact', 'dent']):
            if any(term in label_lower for term in ['severe', 'heavy', 'large']):
                return {'primary_damage': 'hail', 'severity': 'severe', 'confidence': 0.9}
            elif any(term in label_lower for term in ['moderate', 'medium']):
                return {'primary_damage': 'hail', 'severity': 'moderate', 'confidence': 0.8}
            else:
                return {'primary_damage': 'hail', 'severity': 'light', 'confidence': 0.7}
        
        # Wind damage patterns
        elif any(term in label_lower for term in ['wind', 'lifted', 'missing', 'torn']):
            if any(term in label_lower for term in ['severe', 'extensive', 'major']):
                return {'primary_damage': 'wind', 'severity': 'severe', 'confidence': 0.9}
            elif any(term in label_lower for term in ['moderate', 'partial']):
                return {'primary_damage': 'wind', 'severity': 'moderate', 'confidence': 0.8}
            else:
                return {'primary_damage': 'wind', 'severity': 'light', 'confidence': 0.7}
        
        # Wear patterns
        elif any(term in label_lower for term in ['wear', 'aging', 'granule', 'curl']):
            return {'primary_damage': 'wear', 'severity': 'moderate', 'confidence': 0.6}
        
        # No damage
        elif any(term in label_lower for term in ['good', 'intact', 'pristine']):
            return {'primary_damage': 'no_damage', 'severity': 'none', 'confidence': 0.9}
        
        return {'primary_damage': 'no_damage', 'severity': 'none', 'confidence': 0.5}
    
    def _map_numeric_label(self, label: float) -> Dict[str, Any]:
        """Map numeric labels to our categorization system."""
        # Assuming numeric labels represent damage severity (0-1 scale)
        if label >= 0.8:
            return {'primary_damage': 'hail', 'severity': 'severe', 'confidence': float(label)}
        elif label >= 0.6:
            return {'primary_damage': 'hail', 'severity': 'moderate', 'confidence': float(label)}
        elif label >= 0.3:
            return {'primary_damage': 'hail', 'severity': 'light', 'confidence': float(label)}
        else:
            return {'primary_damage': 'no_damage', 'severity': 'none', 'confidence': 1.0 - float(label)}
    
    def _extract_from_description(self, text: str) -> Dict[str, Any]:
        """Extract damage information from text descriptions."""
        text_lower = text.lower()
        
        updates = {}
        
        # Weather correlation
        if any(term in text_lower for term in ['storm', 'hurricane', 'tornado', 'severe weather']):
            updates['metadata'] = {'weather_related': True}
        
        # Quantification hints
        if 'percentage' in text_lower or '%' in text_lower:
            # Try to extract percentage
            import re
            percent_match = re.search(r'(\d+(?:\.\d+)?)\s*%', text_lower)
            if percent_match:
                updates['quantification'] = {'affected_percentage': float(percent_match.group(1))}
        
        return updates
    
    def preprocess_images(self, batch_size: int = 32) -> bool:
        """
        Preprocess all images in the dataset for training.
        
        Args:
            batch_size: Number of images to process in each batch
            
        Returns:
            bool: Success status
        """
        try:
            if not hasattr(self, 'dataset'):
                logger.error("Dataset not loaded. Please download first.")
                return False
            
            logger.info("Starting image preprocessing...")
            
            processed_data = {}
            
            for split_name, split_data in self.dataset.items():
                logger.info(f"Processing {split_name} split...")
                
                processed_samples = []
                total_samples = len(split_data)
                
                for i in tqdm(range(0, total_samples, batch_size), desc=f"Processing {split_name}"):
                    batch_end = min(i + batch_size, total_samples)
                    batch_samples = []
                    
                    for j in range(i, batch_end):
                        try:
                            sample = split_data[j]
                            processed_sample = self._preprocess_sample(sample)
                            
                            if processed_sample:
                                batch_samples.append(processed_sample)
                                
                        except Exception as e:
                            logger.warning(f"Error processing sample {j}: {e}")
                    
                    processed_samples.extend(batch_samples)
                
                processed_data[split_name] = processed_samples
                logger.info(f"Processed {len(processed_samples)} samples in {split_name} split")
            
            # Save processed data
            self._save_processed_data(processed_data)
            
            logger.info("Image preprocessing completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error preprocessing images: {e}")
            return False
    
    def _preprocess_sample(self, sample: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Preprocess a single sample.
        
        Args:
            sample: Raw sample from dataset
            
        Returns:
            Processed sample or None if failed
        """
        try:
            if 'image' not in sample:
                return None
            
            # Get image
            image = sample['image']
            if not isinstance(image, Image.Image):
                return None
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Quality check
            if not self._quality_check(image):
                return None
            
            # Resize image
            processing_config = self.config.get('processing', self.config.get('data', {}))
            target_size = tuple(processing_config.get('image_size', [512, 512]))
            image = image.resize(target_size, Image.Resampling.LANCZOS)
            
            # Create enhanced labels - pass label names for proper mapping
            label_names = getattr(self.dataset['train'].features['label'], 'names', None) if hasattr(self, 'dataset') else None
            labels = self.create_damage_labels(sample, label_names)
            
            # Convert image to array
            image_array = np.array(image)
            
            # Normalize if specified
            if processing_config.get('normalize', True):
                image_array = image_array.astype(np.float32) / 255.0
            
            processed_sample = {
                'image': image_array,
                'labels': labels,
                'original_size': sample['image'].size if 'image' in sample else None,
                'preprocessed_size': target_size,
                'sample_id': sample.get('id', hash(str(sample)))
            }
            
            return processed_sample
            
        except Exception as e:
            logger.warning(f"Error preprocessing sample: {e}")
            return None
    
    def _quality_check(self, image: Image.Image) -> bool:
        """
        Perform quality checks on an image.
        
        Args:
            image: PIL Image
            
        Returns:
            bool: Whether image passes quality checks
        """
        try:
            # Get quality control settings from dataset config or fallback
            quality_config = self.config.get('quality_control', self.config.get('dataset', {}))
            
            # Size check
            min_size = tuple(quality_config.get('min_image_size', [224, 224]))
            if image.size[0] < min_size[0] or image.size[1] < min_size[1]:
                return False
            
            # File size check (approximate)
            max_size_bytes = quality_config.get('max_file_size_mb', 50) * 1024 * 1024
            estimated_size = len(image.tobytes())
            if estimated_size > max_size_bytes:
                return False
            
            # Corruption check
            if quality_config.get('corruption_check', True):
                try:
                    # Create a copy for verification to avoid corrupting the original
                    img_copy = image.copy()
                    img_copy.verify()
                except Exception:
                    return False
            
            return True
            
        except Exception:
            return False
    
    def _save_processed_data(self, processed_data: Dict[str, List[Dict[str, Any]]]):
        """Save processed data to disk."""
        try:
            for split_name, data in processed_data.items():
                output_file = self.processed_dir / f"{split_name}_processed.json"
                
                # Convert numpy arrays to lists for JSON serialization
                serializable_data = []
                for sample in data:
                    serializable_sample = {
                        'labels': sample['labels'],
                        'original_size': sample['original_size'],
                        'preprocessed_size': sample['preprocessed_size'],
                        'sample_id': sample['sample_id']
                    }
                    
                    # Save image array separately
                    image_file = self.processed_dir / f"{split_name}_{sample['sample_id']}.npy"
                    np.save(image_file, sample['image'])
                    serializable_sample['image_file'] = str(image_file)
                    
                    serializable_data.append(serializable_sample)
                
                with open(output_file, 'w') as f:
                    json.dump(serializable_data, f, indent=2)
                
                logger.info(f"Saved processed {split_name} data to {output_file}")
                
        except Exception as e:
            logger.error(f"Error saving processed data: {e}")
    
    def create_training_splits(self, validation_split: float = None, test_split: float = None) -> bool:
        """
        Create train/validation/test splits from processed data.
        
        Args:
            validation_split: Proportion for validation set
            test_split: Proportion for test set
            
        Returns:
            bool: Success status
        """
        try:
            dataset_config = self.config.get('dataset', {})
            validation_split = validation_split or dataset_config.get('validation_split', 0.2)
            test_split = test_split or dataset_config.get('test_split', 0.1)
            
            logger.info("Creating training splits...")
            
            # Load all processed data
            all_data = []
            for split_file in self.processed_dir.glob("*_processed.json"):
                with open(split_file, 'r') as f:
                    split_data = json.load(f)
                    all_data.extend(split_data)
            
            if not all_data:
                logger.error("No processed data found")
                return False
            
            # Extract labels for stratified splitting
            labels = [sample['labels']['primary_damage'] for sample in all_data]
            
            # First split: separate test set
            train_val_data, test_data, train_val_labels, test_labels = train_test_split(
                all_data, labels,
                test_size=test_split,
                stratify=labels,
                random_state=dataset_config.get('random_seed', 42)
            )
            
            # Second split: separate validation set
            train_data, val_data, _, _ = train_test_split(
                train_val_data, train_val_labels,
                test_size=validation_split / (1 - test_split),
                stratify=train_val_labels,
                random_state=dataset_config.get('random_seed', 42)
            )
            
            # Save splits
            splits = {
                'train': train_data,
                'validation': val_data,
                'test': test_data
            }
            
            for split_name, data in splits.items():
                output_file = self.processed_dir / f"{split_name}_final.json"
                with open(output_file, 'w') as f:
                    json.dump(data, f, indent=2)
                
                logger.info(f"Created {split_name} split with {len(data)} samples")
            
            # Create split summary
            summary = {
                'total_samples': len(all_data),
                'train_samples': len(train_data),
                'validation_samples': len(val_data),
                'test_samples': len(test_data),
                'splits_created': datetime.now().isoformat(),
                'label_distribution': {
                    split_name: {label: sum(1 for s in data if s['labels']['primary_damage'] == label) 
                                for label in set(s['labels']['primary_damage'] for s in data)}
                    for split_name, data in splits.items()
                }
            }
            
            summary_file = self.processed_dir / 'splits_summary.json'
            with open(summary_file, 'w') as f:
                json.dump(summary, f, indent=2)
            
            logger.info(f"Training splits created successfully. Summary saved to {summary_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating training splits: {e}")
            return False
    
    def validate_dataset(self) -> Dict[str, Any]:
        """
        Validate the processed dataset for training readiness.
        
        Returns:
            Validation report
        """
        try:
            logger.info("Validating processed dataset...")
            
            validation_report = {
                'status': 'unknown',
                'splits_found': [],
                'total_samples': 0,
                'label_balance': {},
                'quality_issues': [],
                'recommendations': []
            }
            
            # Check for required splits
            required_splits = ['train_final.json', 'validation_final.json', 'test_final.json']
            
            for split_file in required_splits:
                split_path = self.processed_dir / split_file
                if split_path.exists():
                    validation_report['splits_found'].append(split_file)
                    
                    # Load and analyze split
                    with open(split_path, 'r') as f:
                        data = json.load(f)
                        validation_report['total_samples'] += len(data)
                        
                        # Analyze label distribution
                        split_name = split_file.replace('_final.json', '')
                        labels = [sample['labels']['primary_damage'] for sample in data]
                        validation_report['label_balance'][split_name] = dict(zip(*np.unique(labels, return_counts=True)))
            
            # Determine status
            if len(validation_report['splits_found']) == 3:
                validation_report['status'] = 'ready'
            elif len(validation_report['splits_found']) > 0:
                validation_report['status'] = 'partial'
                validation_report['quality_issues'].append(f"Missing splits: {set(required_splits) - set(validation_report['splits_found'])}")
            else:
                validation_report['status'] = 'not_ready'
                validation_report['quality_issues'].append("No processed splits found")
            
            # Check label balance
            if validation_report['label_balance']:
                for split_name, labels in validation_report['label_balance'].items():
                    total = sum(labels.values())
                    for label, count in labels.items():
                        percentage = (count / total) * 100
                        if percentage < 5:  # Less than 5% representation
                            validation_report['quality_issues'].append(
                                f"Low representation of '{label}' in {split_name}: {percentage:.1f}%"
                            )
            
            # Generate recommendations
            if validation_report['quality_issues']:
                validation_report['recommendations'].append("Consider data augmentation for underrepresented classes")
                validation_report['recommendations'].append("Review data collection strategy for balanced representation")
            
            if validation_report['total_samples'] < 1000:
                validation_report['recommendations'].append("Consider collecting more training data for better model performance")
            
            # Save validation report
            report_file = self.processed_dir / 'validation_report.json'
            with open(report_file, 'w') as f:
                json.dump(validation_report, f, indent=2)
            
            logger.info(f"Dataset validation completed. Status: {validation_report['status']}")
            logger.info(f"Validation report saved to {report_file}")
            
            return validation_report
            
        except Exception as e:
            logger.error(f"Error validating dataset: {e}")
            return {'status': 'error', 'error': str(e)}
    
    def export_for_training(self, output_format: str = 'pytorch') -> bool:
        """
        Export processed data in format suitable for training.
        
        Args:
            output_format: Export format ('pytorch', 'tensorflow', 'numpy')
            
        Returns:
            bool: Success status
        """
        try:
            logger.info(f"Exporting data for {output_format} training...")
            
            export_dir = self.processed_dir / f"export_{output_format}"
            export_dir.mkdir(exist_ok=True)
            
            splits = ['train_final.json', 'validation_final.json', 'test_final.json']
            
            for split_file in splits:
                split_path = self.processed_dir / split_file
                if not split_path.exists():
                    continue
                
                split_name = split_file.replace('_final.json', '')
                logger.info(f"Exporting {split_name} split...")
                
                with open(split_path, 'r') as f:
                    data = json.load(f)
                
                if output_format == 'pytorch':
                    self._export_pytorch(data, export_dir / f"{split_name}.pt")
                elif output_format == 'tensorflow':
                    self._export_tensorflow(data, export_dir / f"{split_name}.tfrecord")
                elif output_format == 'numpy':
                    self._export_numpy(data, export_dir / f"{split_name}.npz")
            
            # Export class information
            class_info = {
                'classes': list(self.damage_categories.keys()),
                'class_to_idx': {cls: idx for idx, cls in enumerate(self.damage_categories.keys())},
                'severity_levels': ['none', 'light', 'moderate', 'severe'],
                'damage_categories': self.damage_categories
            }
            
            with open(export_dir / 'class_info.json', 'w') as f:
                json.dump(class_info, f, indent=2)
            
            logger.info(f"Export completed successfully to {export_dir}")
            return True
            
        except Exception as e:
            logger.error(f"Error exporting data: {e}")
            return False
    
    def _export_pytorch(self, data: List[Dict], output_path: Path):
        """Export data in PyTorch format."""
        try:
            import torch
            
            images = []
            labels = []
            metadata = []
            
            for sample in data:
                # Load image
                image_file = Path(sample['image_file'])
                if image_file.exists():
                    image = np.load(image_file)
                    images.append(torch.tensor(image).permute(2, 0, 1))  # HWC to CHW
                    
                    # Create label tensor
                    label_dict = sample['labels']
                    class_idx = list(self.damage_categories.keys()).index(label_dict['primary_damage'])
                    severity_idx = ['none', 'light', 'moderate', 'severe'].index(label_dict['severity'])
                    
                    labels.append({
                        'class': class_idx,
                        'severity': severity_idx,
                        'confidence': label_dict['confidence']
                    })
                    
                    metadata.append({
                        'sample_id': sample['sample_id'],
                        'original_size': sample['original_size'],
                        'preprocessed_size': sample['preprocessed_size']
                    })
            
            torch.save({
                'images': torch.stack(images) if images else torch.tensor([]),
                'labels': labels,
                'metadata': metadata
            }, output_path)
            
            logger.info(f"PyTorch export saved to {output_path}")
            
        except Exception as e:
            logger.error(f"Error exporting PyTorch data: {e}")
    
    def _export_tensorflow(self, data: List[Dict], output_path: Path):
        """Export data in TensorFlow format."""
        try:
            import tensorflow as tf
            
            def _bytes_feature(value):
                return tf.train.Feature(bytes_list=tf.train.BytesList(value=[value]))
            
            def _int64_feature(value):
                return tf.train.Feature(int64_list=tf.train.Int64List(value=[value]))
            
            def _float_feature(value):
                return tf.train.Feature(float_list=tf.train.FloatList(value=[value]))
            
            with tf.io.TFRecordWriter(str(output_path)) as writer:
                for sample in data:
                    image_file = Path(sample['image_file'])
                    if image_file.exists():
                        image = np.load(image_file)
                        image_bytes = image.tobytes()
                        
                        label_dict = sample['labels']
                        class_idx = list(self.damage_categories.keys()).index(label_dict['primary_damage'])
                        severity_idx = ['none', 'light', 'moderate', 'severe'].index(label_dict['severity'])
                        
                        example = tf.train.Example(features=tf.train.Features(feature={
                            'image': _bytes_feature(image_bytes),
                            'class': _int64_feature(class_idx),
                            'severity': _int64_feature(severity_idx),
                            'confidence': _float_feature(label_dict['confidence']),
                            'height': _int64_feature(image.shape[0]),
                            'width': _int64_feature(image.shape[1]),
                            'channels': _int64_feature(image.shape[2])
                        }))
                        
                        writer.write(example.SerializeToString())
            
            logger.info(f"TensorFlow export saved to {output_path}")
            
        except Exception as e:
            logger.error(f"Error exporting TensorFlow data: {e}")
    
    def _export_numpy(self, data: List[Dict], output_path: Path):
        """Export data in NumPy format."""
        try:
            images = []
            labels = []
            metadata = []
            
            for sample in data:
                image_file = Path(sample['image_file'])
                if image_file.exists():
                    image = np.load(image_file)
                    images.append(image)
                    
                    label_dict = sample['labels']
                    class_idx = list(self.damage_categories.keys()).index(label_dict['primary_damage'])
                    severity_idx = ['none', 'light', 'moderate', 'severe'].index(label_dict['severity'])
                    
                    labels.append([class_idx, severity_idx, label_dict['confidence']])
                    metadata.append([
                        sample['sample_id'],
                        sample['original_size'][0] if sample['original_size'] else 0,
                        sample['original_size'][1] if sample['original_size'] else 0
                    ])
            
            np.savez_compressed(
                output_path,
                images=np.array(images),
                labels=np.array(labels),
                metadata=np.array(metadata)
            )
            
            logger.info(f"NumPy export saved to {output_path}")
            
        except Exception as e:
            logger.error(f"Error exporting NumPy data: {e}")


def main():
    """Main function to run the dataset downloader."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Roof Damage Dataset Downloader and Processor')
    parser.add_argument('--config', type=str, help='Path to configuration file')
    parser.add_argument('--download', action='store_true', help='Download dataset')
    parser.add_argument('--analyze', action='store_true', help='Analyze dataset structure')
    parser.add_argument('--preprocess', action='store_true', help='Preprocess images')
    parser.add_argument('--splits', action='store_true', help='Create training splits')
    parser.add_argument('--validate', action='store_true', help='Validate processed data')
    parser.add_argument('--export', type=str, choices=['pytorch', 'tensorflow', 'numpy'], help='Export format')
    parser.add_argument('--all', action='store_true', help='Run complete pipeline')
    
    args = parser.parse_args()
    
    try:
        # Initialize downloader
        downloader = RoofDamageDatasetDownloader(args.config)
        
        if args.all:
            # Run complete pipeline
            logger.info("Running complete dataset preparation pipeline...")
            
            success = downloader.download_dataset()
            if not success:
                logger.error("Dataset download failed")
                sys.exit(1)
            
            downloader.analyze_dataset_structure()
            
            success = downloader.preprocess_images()
            if not success:
                logger.error("Image preprocessing failed")
                sys.exit(1)
            
            success = downloader.create_training_splits()
            if not success:
                logger.error("Training splits creation failed")
                sys.exit(1)
            
            validation_report = downloader.validate_dataset()
            if validation_report['status'] != 'ready':
                logger.warning(f"Dataset validation issues: {validation_report['quality_issues']}")
            
            success = downloader.export_for_training('pytorch')
            if not success:
                logger.error("Data export failed")
                sys.exit(1)
            
            logger.info("Complete pipeline executed successfully!")
            
        else:
            # Run individual steps
            if args.download:
                success = downloader.download_dataset()
                if not success:
                    sys.exit(1)
            
            if args.analyze:
                downloader.analyze_dataset_structure()
            
            if args.preprocess:
                success = downloader.preprocess_images()
                if not success:
                    sys.exit(1)
            
            if args.splits:
                success = downloader.create_training_splits()
                if not success:
                    sys.exit(1)
            
            if args.validate:
                validation_report = downloader.validate_dataset()
                print(f"Validation Status: {validation_report['status']}")
            
            if args.export:
                success = downloader.export_for_training(args.export)
                if not success:
                    sys.exit(1)
    
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()