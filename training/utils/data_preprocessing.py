#!/usr/bin/env python3
"""
Advanced Data Preprocessing and Augmentation Pipeline for Susan AI Roof Damage Training
Specialized preprocessing for roof damage images with weather-aware augmentations
Integrates with the main training system and damage classification models
"""

import os
import sys
import json
import yaml
import logging
import numpy as np
import cv2
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import torch
import torchvision.transforms as transforms
import torchvision.transforms.functional as TF
import albumentations as A
from albumentations.pytorch import ToTensorV2
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Union
import random
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.decomposition import PCA
import imgaug.augmenters as iaa
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import ndimage
from skimage import filters, morphology, measure, exposure, restoration
from skimage.color import rgb2hsv, hsv2rgb, rgb2gray
from skimage.feature import local_binary_pattern, hog
from skimage.segmentation import slic, felzenszwalb
import warnings
warnings.filterwarnings('ignore')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class RoofImagePreprocessor:
    """
    Advanced preprocessing pipeline specifically designed for roof damage analysis.
    Handles various image conditions, lighting, and damage types.
    """
    
    def __init__(
        self,
        target_size: Tuple[int, int] = (512, 512),
        normalize: bool = True,
        enhance_contrast: bool = True,
        remove_noise: bool = True
    ):
        """Initialize the roof image preprocessor."""
        self.target_size = target_size
        self.normalize = normalize
        self.enhance_contrast = enhance_contrast
        self.remove_noise = remove_noise
        
        # Standard ImageNet normalization
        self.mean = [0.485, 0.456, 0.406]
        self.std = [0.229, 0.224, 0.225]
        
        # Roof-specific enhancement parameters
        self.contrast_params = {
            'clahe_clip_limit': 2.0,
            'clahe_grid_size': (8, 8),
            'gamma_correction': 1.2,
            'brightness_adjustment': 0.1
        }
        
        # Noise reduction parameters
        self.noise_params = {
            'bilateral_d': 9,
            'bilateral_sigma_color': 75,
            'bilateral_sigma_space': 75,
            'gaussian_kernel_size': (3, 3),
            'median_kernel_size': 3
        }
        
        logger.info("RoofImagePreprocessor initialized")
    
    def preprocess_image(
        self,
        image: Union[np.ndarray, Image.Image],
        preserve_aspect_ratio: bool = False,
        return_metadata: bool = False
    ) -> Union[np.ndarray, Tuple[np.ndarray, Dict[str, Any]]]:
        """
        Comprehensive preprocessing pipeline for roof images.
        
        Args:
            image: Input image (PIL Image or numpy array)
            preserve_aspect_ratio: Whether to preserve aspect ratio during resize
            return_metadata: Whether to return preprocessing metadata
            
        Returns:
            Processed image and optionally metadata
        """
        try:
            metadata = {}
            
            # Convert to numpy array if PIL Image
            if isinstance(image, Image.Image):
                original_format = image.format
                original_mode = image.mode
                image = np.array(image)
                metadata['original_format'] = original_format
                metadata['original_mode'] = original_mode
            
            # Store original dimensions
            original_shape = image.shape
            metadata['original_shape'] = original_shape
            
            # Ensure RGB format
            if len(image.shape) == 3 and image.shape[2] == 3:
                # Already RGB
                pass
            elif len(image.shape) == 3 and image.shape[2] == 4:
                # RGBA to RGB
                image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
                metadata['conversion'] = 'RGBA_to_RGB'
            elif len(image.shape) == 2:
                # Grayscale to RGB
                image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
                metadata['conversion'] = 'GRAY_to_RGB'
            
            # Quality assessment
            quality_metrics = self._assess_image_quality(image)
            metadata['quality_metrics'] = quality_metrics
            
            # Adaptive preprocessing based on image quality
            if quality_metrics['brightness'] < 0.3:
                image = self._enhance_brightness(image)
                metadata['brightness_enhanced'] = True
            
            if quality_metrics['contrast'] < 0.4:
                image = self._enhance_contrast(image)
                metadata['contrast_enhanced'] = True
            
            if quality_metrics['noise_level'] > 0.6:
                image = self._reduce_noise(image)
                metadata['noise_reduced'] = True
            
            # Lighting normalization
            image = self._normalize_lighting(image)
            metadata['lighting_normalized'] = True
            
            # Edge preservation during resize
            if preserve_aspect_ratio:
                image = self._resize_with_aspect_ratio(image, self.target_size)
                metadata['aspect_ratio_preserved'] = True
            else:
                image = cv2.resize(image, self.target_size, interpolation=cv2.INTER_LANCZOS4)
            
            # Final quality enhancements
            image = self._apply_final_enhancements(image)
            
            # Convert to float32 and normalize
            image = image.astype(np.float32)
            if self.normalize:
                image = image / 255.0
                metadata['normalized'] = True
            
            if return_metadata:
                return image, metadata
            else:
                return image
                
        except Exception as e:
            logger.error(f"Error in image preprocessing: {e}")
            # Return a black image as fallback
            fallback = np.zeros((*self.target_size[::-1], 3), dtype=np.float32)
            if return_metadata:
                return fallback, {'error': str(e)}
            else:
                return fallback
    
    def _assess_image_quality(self, image: np.ndarray) -> Dict[str, float]:
        """Assess various quality metrics of the image."""
        try:
            # Convert to grayscale for some metrics
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if len(image.shape) == 3 else image
            
            # Brightness assessment
            brightness = np.mean(gray) / 255.0
            
            # Contrast assessment (standard deviation of pixel intensities)
            contrast = np.std(gray) / 255.0
            
            # Sharpness assessment (Laplacian variance)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            sharpness = laplacian.var() / 10000  # Normalized
            
            # Noise assessment (high frequency content)
            noise_level = self._estimate_noise_level(gray)
            
            # Color distribution assessment
            color_variance = np.mean([np.var(image[:, :, i]) for i in range(3)]) / 65535
            
            return {
                'brightness': float(np.clip(brightness, 0, 1)),
                'contrast': float(np.clip(contrast, 0, 1)),
                'sharpness': float(np.clip(sharpness, 0, 1)),
                'noise_level': float(np.clip(noise_level, 0, 1)),
                'color_variance': float(np.clip(color_variance, 0, 1))
            }
            
        except Exception as e:
            logger.warning(f"Error assessing image quality: {e}")
            return {
                'brightness': 0.5,
                'contrast': 0.5,
                'sharpness': 0.5,
                'noise_level': 0.5,
                'color_variance': 0.5
            }
    
    def _estimate_noise_level(self, gray_image: np.ndarray) -> float:
        """Estimate noise level in grayscale image."""
        try:
            # Use Laplacian to detect high frequency content (noise)
            laplacian = cv2.Laplacian(gray_image, cv2.CV_64F)
            noise_estimate = np.mean(np.abs(laplacian)) / 255.0
            return min(noise_estimate, 1.0)
        except:
            return 0.5
    
    def _enhance_brightness(self, image: np.ndarray) -> np.ndarray:
        """Enhance brightness of dark images."""
        try:
            # Gamma correction for brightness
            gamma = self.contrast_params['gamma_correction']
            adjusted = np.power(image / 255.0, 1.0 / gamma) * 255.0
            return np.clip(adjusted, 0, 255).astype(np.uint8)
        except Exception as e:
            logger.warning(f"Brightness enhancement failed: {e}")
            return image
    
    def _enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """Enhance contrast using CLAHE and other techniques."""
        try:
            # Convert to LAB color space for better contrast enhancement
            lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
            
            # Apply CLAHE to L channel
            clahe = cv2.createCLAHE(
                clipLimit=self.contrast_params['clahe_clip_limit'],
                tileGridSize=self.contrast_params['clahe_grid_size']
            )
            lab[:, :, 0] = clahe.apply(lab[:, :, 0])
            
            # Convert back to RGB
            enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
            return enhanced
            
        except Exception as e:
            logger.warning(f"Contrast enhancement failed: {e}")
            return image
    
    def _reduce_noise(self, image: np.ndarray) -> np.ndarray:
        """Reduce noise while preserving edges."""
        try:
            # Bilateral filtering for noise reduction while preserving edges
            denoised = cv2.bilateralFilter(
                image,
                self.noise_params['bilateral_d'],
                self.noise_params['bilateral_sigma_color'],
                self.noise_params['bilateral_sigma_space']
            )
            return denoised
            
        except Exception as e:
            logger.warning(f"Noise reduction failed: {e}")
            return image
    
    def _normalize_lighting(self, image: np.ndarray) -> np.ndarray:
        """Normalize lighting conditions across the image."""
        try:
            # Convert to LAB
            lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
            
            # Normalize the L (lightness) channel
            l_channel = lab[:, :, 0].astype(np.float32)
            
            # Apply histogram equalization to L channel
            l_normalized = cv2.equalizeHist(l_channel.astype(np.uint8))
            
            # Smooth the normalization to avoid harsh transitions
            l_smooth = cv2.GaussianBlur(l_normalized.astype(np.float32), (15, 15), 0)
            
            # Blend original and normalized
            l_final = cv2.addWeighted(l_channel, 0.6, l_smooth, 0.4, 0)
            
            # Replace L channel
            lab[:, :, 0] = np.clip(l_final, 0, 255).astype(np.uint8)
            
            # Convert back to RGB
            normalized = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
            return normalized
            
        except Exception as e:
            logger.warning(f"Lighting normalization failed: {e}")
            return image
    
    def _resize_with_aspect_ratio(
        self,
        image: np.ndarray,
        target_size: Tuple[int, int]
    ) -> np.ndarray:
        """Resize image while preserving aspect ratio."""
        try:
            h, w = image.shape[:2]
            target_w, target_h = target_size
            
            # Calculate scaling factor
            scale = min(target_w / w, target_h / h)
            
            # Calculate new dimensions
            new_w = int(w * scale)
            new_h = int(h * scale)
            
            # Resize image
            resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
            
            # Create canvas with target size
            canvas = np.zeros((target_h, target_w, 3), dtype=image.dtype)
            
            # Calculate padding
            y_offset = (target_h - new_h) // 2
            x_offset = (target_w - new_w) // 2
            
            # Place resized image on canvas
            canvas[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized
            
            return canvas
            
        except Exception as e:
            logger.warning(f"Aspect ratio resize failed: {e}")
            return cv2.resize(image, target_size, interpolation=cv2.INTER_LANCZOS4)
    
    def _apply_final_enhancements(self, image: np.ndarray) -> np.ndarray:
        """Apply final enhancement steps."""
        try:
            # Subtle sharpening
            kernel = np.array([[-1, -1, -1],
                              [-1,  9, -1],
                              [-1, -1, -1]]) * 0.1
            sharpened = cv2.filter2D(image, -1, kernel)
            
            # Blend original and sharpened
            enhanced = cv2.addWeighted(image, 0.8, sharpened, 0.2, 0)
            
            return np.clip(enhanced, 0, 255).astype(np.uint8)
            
        except Exception as e:
            logger.warning(f"Final enhancement failed: {e}")
            return image


class WeatherAwareAugmentation:
    """
    Advanced augmentation pipeline that simulates various weather conditions
    and damage scenarios for comprehensive roof damage training.
    """
    
    def __init__(self, severity_level: str = 'moderate'):
        """Initialize weather-aware augmentation."""
        self.severity_level = severity_level
        
        # Weather simulation parameters
        self.weather_effects = {
            'rain': {
                'probability': 0.15,
                'intensity_range': (0.1, 0.4),
                'drop_size_range': (1, 3),
                'angle_range': (-15, 15)
            },
            'shadow': {
                'probability': 0.25,
                'intensity_range': (0.2, 0.6),
                'size_range': (0.2, 0.8),
                'edge_softness': (10, 30)
            },
            'sun_glare': {
                'probability': 0.1,
                'intensity_range': (0.3, 0.7),
                'position_variance': 0.3
            },
            'fog': {
                'probability': 0.05,
                'density_range': (0.1, 0.3),
                'color_tint': (0.9, 0.95, 1.0)
            }
        }
        
        # Damage simulation parameters
        self.damage_simulation = {
            'hail_marks': {
                'probability': 0.3,
                'count_range': (5, 25),
                'size_range': (3, 15),
                'opacity_range': (0.3, 0.8)
            },
            'wear_patterns': {
                'probability': 0.2,
                'intensity_range': (0.1, 0.5),
                'pattern_types': ['granule_loss', 'fading', 'discoloration']
            },
            'wind_damage': {
                'probability': 0.15,
                'displacement_range': (2, 10),
                'curl_intensity': (0.1, 0.4)
            }
        }
        
        logger.info(f"WeatherAwareAugmentation initialized with {severity_level} severity")
    
    def create_training_augmentation(self) -> A.Compose:
        """Create comprehensive training augmentation pipeline."""
        
        # Base geometric augmentations
        geometric_augs = [
            A.HorizontalFlip(p=0.5),
            A.RandomRotate90(p=0.3),
            A.ShiftScaleRotate(
                shift_limit=0.1,
                scale_limit=0.2,
                rotate_limit=15,
                border_mode=cv2.BORDER_REFLECT_101,
                p=0.7
            ),
            A.Perspective(scale=(0.05, 0.1), p=0.3),
            A.OpticalDistortion(distort_limit=0.05, shift_limit=0.05, p=0.2)
        ]
        
        # Color and lighting augmentations
        color_augs = [
            A.RandomBrightnessContrast(
                brightness_limit=0.3,
                contrast_limit=0.3,
                p=0.7
            ),
            A.HueSaturationValue(
                hue_shift_limit=15,
                sat_shift_limit=30,
                val_shift_limit=20,
                p=0.6
            ),
            A.RGBShift(r_shift_limit=20, g_shift_limit=20, b_shift_limit=20, p=0.4),
            A.ChannelShuffle(p=0.1),
            A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1, p=0.5)
        ]
        
        # Weather and environmental augmentations
        weather_augs = [
            A.RandomRain(
                slant_range=(-10, 10),
                drop_length=(10, 20),
                drop_width=(1, 2),
                drop_color=(200, 200, 200),
                blur_value=1,
                brightness_coefficient=0.7,
                rain_type="drizzle",
                p=0.1
            ),
            A.RandomShadow(
                shadow_roi=(0, 0.5, 1, 1),
                num_shadows_lower=1,
                num_shadows_upper=3,
                shadow_dimension=5,
                p=0.2
            ),
            A.RandomSunFlare(
                flare_roi=(0, 0, 1, 0.5),
                angle_lower=0,
                angle_upper=1,
                num_flare_circles_lower=6,
                num_flare_circles_upper=10,
                src_radius=160,
                src_color=(255, 255, 255),
                p=0.05
            ),
            A.RandomFog(
                fog_coef_lower=0.1,
                fog_coef_upper=0.3,
                alpha_coef=0.08,
                p=0.05
            )
        ]
        
        # Noise and blur augmentations
        noise_augs = [
            A.GaussNoise(var_limit=(10.0, 50.0), p=0.3),
            A.ISONoise(color_shift=(0.01, 0.05), intensity=(0.1, 0.5), p=0.2),
            A.MultiplicativeNoise(multiplier=[0.9, 1.1], p=0.2),
            A.GaussianBlur(blur_limit=(1, 3), p=0.2),
            A.MotionBlur(blur_limit=3, p=0.1),
            A.MedianBlur(blur_limit=3, p=0.1)
        ]
        
        # Advanced augmentations
        advanced_augs = [
            A.GridDistortion(num_steps=5, distort_limit=0.1, p=0.2),
            A.ElasticTransform(alpha=1, sigma=50, alpha_affine=50, p=0.1),
            A.CLAHE(clip_limit=2.0, tile_grid_size=(8, 8), p=0.3),
            A.Sharpen(alpha=(0.2, 0.5), lightness=(0.5, 1.0), p=0.2),
            A.Emboss(alpha=(0.2, 0.5), strength=(0.5, 1.0), p=0.1)
        ]
        
        # Cutout and erasing
        cutout_augs = [
            A.CoarseDropout(
                max_holes=8,
                max_height=32,
                max_width=32,
                min_holes=1,
                min_height=8,
                min_width=8,
                fill_value=0,
                p=0.3
            ),
            A.GridDropout(ratio=0.1, p=0.2),
            A.ChannelDropout(channel_drop_range=(1, 1), fill_value=0, p=0.1)
        ]
        
        # Combine all augmentations
        all_augs = (geometric_augs + color_augs + weather_augs + 
                   noise_augs + advanced_augs + cutout_augs)
        
        # Final pipeline with normalization
        transform = A.Compose(
            all_augs + [
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
                ToTensorV2()
            ]
        )
        
        return transform
    
    def create_validation_augmentation(self) -> A.Compose:
        """Create validation augmentation pipeline (minimal augmentation)."""
        return A.Compose([
            A.Resize(512, 512),
            A.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
            ToTensorV2()
        ])
    
    def simulate_hail_damage(
        self,
        image: np.ndarray,
        num_impacts: int = None,
        impact_sizes: List[int] = None
    ) -> np.ndarray:
        """Simulate hail damage on roof images."""
        try:
            if num_impacts is None:
                num_impacts = random.randint(*self.damage_simulation['hail_marks']['count_range'])
            
            if impact_sizes is None:
                size_range = self.damage_simulation['hail_marks']['size_range']
                impact_sizes = [random.randint(*size_range) for _ in range(num_impacts)]
            
            height, width = image.shape[:2]
            damaged_image = image.copy()
            
            for size in impact_sizes:
                # Random position
                x = random.randint(size, width - size)
                y = random.randint(size, height - size)
                
                # Create circular impact
                mask = np.zeros((height, width), dtype=np.uint8)
                cv2.circle(mask, (x, y), size, 255, -1)
                
                # Create damage effect (darker, granule loss simulation)
                damage_intensity = random.uniform(*self.damage_simulation['hail_marks']['opacity_range'])
                damaged_area = image[mask > 0]
                damaged_area = damaged_area * (1 - damage_intensity * 0.3)  # Darken
                damaged_image[mask > 0] = damaged_area
                
                # Add some texture variation
                noise = np.random.normal(0, 10, damaged_area.shape)
                damaged_image[mask > 0] = np.clip(damaged_image[mask > 0] + noise, 0, 255)
            
            return damaged_image.astype(np.uint8)
            
        except Exception as e:
            logger.warning(f"Hail damage simulation failed: {e}")
            return image
    
    def simulate_weather_effects(self, image: np.ndarray, weather_type: str) -> np.ndarray:
        """Simulate specific weather effects on images."""
        try:
            if weather_type == 'rain':
                return self._add_rain_effect(image)
            elif weather_type == 'shadow':
                return self._add_shadow_effect(image)
            elif weather_type == 'sun_glare':
                return self._add_sun_glare(image)
            elif weather_type == 'fog':
                return self._add_fog_effect(image)
            else:
                return image
                
        except Exception as e:
            logger.warning(f"Weather effect simulation failed: {e}")
            return image
    
    def _add_rain_effect(self, image: np.ndarray) -> np.ndarray:
        """Add realistic rain effect to image."""
        height, width = image.shape[:2]
        rain_image = image.copy().astype(np.float32)
        
        # Rain parameters
        num_drops = random.randint(50, 200)
        rain_params = self.weather_effects['rain']
        
        for _ in range(num_drops):
            # Random drop properties
            x = random.randint(0, width - 1)
            y = random.randint(0, height - 1)
            length = random.randint(5, 15)
            angle = random.uniform(*rain_params['angle_range'])
            intensity = random.uniform(*rain_params['intensity_range'])
            
            # Calculate end point
            end_x = int(x + length * np.sin(np.radians(angle)))
            end_y = int(y + length * np.cos(np.radians(angle)))
            
            # Ensure within bounds
            end_x = np.clip(end_x, 0, width - 1)
            end_y = np.clip(end_y, 0, height - 1)
            
            # Draw rain drop
            cv2.line(rain_image, (x, y), (end_x, end_y), 
                    (255, 255, 255), 1)
        
        # Apply blur for realism
        rain_image = cv2.GaussianBlur(rain_image, (1, 1), 0)
        
        # Blend with original
        result = cv2.addWeighted(image.astype(np.float32), 0.8, rain_image, 0.2, 0)
        
        return np.clip(result, 0, 255).astype(np.uint8)
    
    def _add_shadow_effect(self, image: np.ndarray) -> np.ndarray:
        """Add realistic shadow effect to image."""
        height, width = image.shape[:2]
        shadow_params = self.weather_effects['shadow']
        
        # Create shadow mask
        shadow_mask = np.zeros((height, width), dtype=np.float32)
        
        # Random shadow properties
        num_shadows = random.randint(1, 3)
        
        for _ in range(num_shadows):
            # Shadow parameters
            intensity = random.uniform(*shadow_params['intensity_range'])
            size = random.uniform(*shadow_params['size_range'])
            
            # Shadow position and size
            center_x = random.randint(int(width * 0.2), int(width * 0.8))
            center_y = random.randint(int(height * 0.2), int(height * 0.8))
            radius_x = int(width * size * 0.5)
            radius_y = int(height * size * 0.3)
            
            # Create elliptical shadow
            y, x = np.ogrid[:height, :width]
            mask = ((x - center_x) / radius_x) ** 2 + ((y - center_y) / radius_y) ** 2 <= 1
            shadow_mask[mask] = intensity
        
        # Apply Gaussian blur for soft edges
        shadow_mask = cv2.GaussianBlur(shadow_mask, (21, 21), 0)
        
        # Apply shadow to image
        shadowed_image = image.astype(np.float32)
        for i in range(3):  # Apply to each color channel
            shadowed_image[:, :, i] *= (1 - shadow_mask)
        
        return np.clip(shadowed_image, 0, 255).astype(np.uint8)
    
    def _add_sun_glare(self, image: np.ndarray) -> np.ndarray:
        """Add sun glare effect to image."""
        height, width = image.shape[:2]
        glare_params = self.weather_effects['sun_glare']
        
        # Glare center (usually in upper portion)
        center_x = random.randint(int(width * 0.3), int(width * 0.7))
        center_y = random.randint(0, int(height * 0.4))
        
        # Create radial gradient for glare
        y, x = np.ogrid[:height, :width]
        distance = np.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
        max_distance = np.sqrt(width ** 2 + height ** 2)
        
        # Glare intensity based on distance
        intensity = random.uniform(*glare_params['intensity_range'])
        glare_mask = np.exp(-distance / (max_distance * 0.3)) * intensity
        
        # Apply glare
        glare_image = image.astype(np.float32)
        glare_effect = glare_mask[:, :, np.newaxis] * np.array([255, 255, 200])
        
        result = glare_image + glare_effect
        return np.clip(result, 0, 255).astype(np.uint8)
    
    def _add_fog_effect(self, image: np.ndarray) -> np.ndarray:
        """Add fog effect to image."""
        fog_params = self.weather_effects['fog']
        density = random.uniform(*fog_params['density_range'])
        
        # Create fog overlay
        fog_color = np.array(fog_params['color_tint']) * 255
        fog_overlay = np.full_like(image, fog_color, dtype=np.float32)
        
        # Blend with original image
        fogged_image = cv2.addWeighted(
            image.astype(np.float32), 1 - density,
            fog_overlay, density, 0
        )
        
        return np.clip(fogged_image, 0, 255).astype(np.uint8)


class AdvancedDataAugmentation:
    """
    Advanced data augmentation pipeline combining multiple techniques
    for comprehensive roof damage training data enhancement.
    """
    
    def __init__(self, config_path: str = None):
        """Initialize advanced data augmentation."""
        self.config = self._load_config(config_path)
        
        # Initialize components
        self.preprocessor = RoofImagePreprocessor()
        self.weather_augmentation = WeatherAwareAugmentation()
        
        # Setup augmentation pipeline
        self.train_transform = self.weather_augmentation.create_training_augmentation()
        self.val_transform = self.weather_augmentation.create_validation_augmentation()
        
        logger.info("AdvancedDataAugmentation initialized")
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load augmentation configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        else:
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default augmentation configuration."""
        return {
            'augmentation': {
                'augmentation_probability': 0.8,
                'weather_effects': {
                    'enabled': True,
                    'probability': 0.3
                },
                'damage_simulation': {
                    'enabled': True,
                    'probability': 0.4
                }
            }
        }
    
    def augment_training_batch(
        self,
        images: List[np.ndarray],
        labels: List[Dict[str, Any]]
    ) -> Tuple[List[torch.Tensor], List[Dict[str, Any]]]:
        """Apply comprehensive augmentation to a training batch."""
        augmented_images = []
        augmented_labels = []
        
        for image, label in zip(images, labels):
            try:
                # Preprocess image
                processed_image = self.preprocessor.preprocess_image(image)
                
                # Apply weather effects if enabled and random chance
                if (self.config['augmentation']['weather_effects']['enabled'] and
                    random.random() < self.config['augmentation']['weather_effects']['probability']):
                    
                    weather_type = random.choice(['rain', 'shadow', 'sun_glare', 'fog'])
                    processed_image = self.weather_augmentation.simulate_weather_effects(
                        processed_image, weather_type
                    )
                
                # Apply damage simulation if enabled
                if (self.config['augmentation']['damage_simulation']['enabled'] and
                    random.random() < self.config['augmentation']['damage_simulation']['probability']):
                    
                    # Simulate hail damage
                    if label.get('primary_damage') == 'hail' or random.random() < 0.3:
                        processed_image = self.weather_augmentation.simulate_hail_damage(processed_image)
                        # Update label to reflect simulated damage
                        label['simulated_damage'] = True
                        label['damage_features'] = label.get('damage_features', []) + ['circular_impacts']
                
                # Convert to tensor format for albumentations
                if processed_image.dtype == np.float32 and processed_image.max() <= 1.0:
                    processed_image = (processed_image * 255).astype(np.uint8)
                
                # Apply albumentations transform
                transformed = self.train_transform(image=processed_image)
                augmented_image = transformed['image']
                
                augmented_images.append(augmented_image)
                augmented_labels.append(label)
                
            except Exception as e:
                logger.warning(f"Error in batch augmentation: {e}")
                # Add original image as fallback
                fallback_transform = transforms.Compose([
                    transforms.ToPILImage(),
                    transforms.Resize((512, 512)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])
                
                if image.dtype == np.float32 and image.max() <= 1.0:
                    image = (image * 255).astype(np.uint8)
                
                fallback_tensor = fallback_transform(image)
                augmented_images.append(fallback_tensor)
                augmented_labels.append(label)
        
        return augmented_images, augmented_labels
    
    def create_augmentation_showcase(
        self,
        sample_image: np.ndarray,
        num_variations: int = 9,
        save_path: str = None
    ) -> List[np.ndarray]:
        """Create showcase of different augmentation effects."""
        variations = []
        
        # Original image
        original = self.preprocessor.preprocess_image(sample_image)
        variations.append(original)
        
        # Weather effects
        for weather_type in ['rain', 'shadow', 'sun_glare', 'fog']:
            if len(variations) >= num_variations:
                break
            
            weather_effect = self.weather_augmentation.simulate_weather_effects(
                original, weather_type
            )
            variations.append(weather_effect)
        
        # Damage simulations
        if len(variations) < num_variations:
            hail_damage = self.weather_augmentation.simulate_hail_damage(original)
            variations.append(hail_damage)
        
        # Random augmentations
        while len(variations) < num_variations:
            try:
                if original.dtype == np.float32 and original.max() <= 1.0:
                    aug_input = (original * 255).astype(np.uint8)
                else:
                    aug_input = original.astype(np.uint8)
                
                transformed = self.train_transform(image=aug_input)
                aug_tensor = transformed['image']
                
                # Convert back to numpy for visualization
                aug_numpy = aug_tensor.permute(1, 2, 0).numpy()
                aug_numpy = (aug_numpy * np.array([0.229, 0.224, 0.225])) + np.array([0.485, 0.456, 0.406])
                aug_numpy = np.clip(aug_numpy * 255, 0, 255).astype(np.uint8)
                
                variations.append(aug_numpy)
                
            except Exception as e:
                logger.warning(f"Error creating augmentation variation: {e}")
                break
        
        # Save showcase if path provided
        if save_path:
            self._save_augmentation_showcase(variations, save_path)
        
        return variations
    
    def _save_augmentation_showcase(self, variations: List[np.ndarray], save_path: str):
        """Save augmentation showcase as a grid image."""
        try:
            import math
            
            num_images = len(variations)
            grid_size = int(math.ceil(math.sqrt(num_images)))
            
            fig, axes = plt.subplots(grid_size, grid_size, figsize=(15, 15))
            axes = axes.flatten() if grid_size > 1 else [axes]
            
            for i, variation in enumerate(variations):
                if i < len(axes):
                    axes[i].imshow(variation)
                    axes[i].set_title(f'Variation {i+1}')
                    axes[i].axis('off')
            
            # Hide unused subplots
            for i in range(num_images, len(axes)):
                axes[i].axis('off')
            
            plt.tight_layout()
            plt.savefig(save_path, dpi=150, bbox_inches='tight')
            plt.close()
            
            logger.info(f"Augmentation showcase saved to {save_path}")
            
        except Exception as e:
            logger.error(f"Error saving augmentation showcase: {e}")


def main():
    """Main function for testing preprocessing and augmentation."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Data Preprocessing and Augmentation')
    parser.add_argument('--image', type=str, required=True, help='Path to test image')
    parser.add_argument('--output-dir', type=str, default='./augmentation_test', help='Output directory')
    parser.add_argument('--num-variations', type=int, default=9, help='Number of augmentation variations')
    
    args = parser.parse_args()
    
    try:
        # Create output directory
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load test image
        image = cv2.imread(args.image)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Initialize augmentation system
        augmentation_system = AdvancedDataAugmentation()
        
        # Create and save augmentation showcase
        showcase_path = output_dir / 'augmentation_showcase.png'
        variations = augmentation_system.create_augmentation_showcase(
            image, args.num_variations, str(showcase_path)
        )
        
        # Test preprocessing
        preprocessor = RoofImagePreprocessor()
        processed_image, metadata = preprocessor.preprocess_image(image, return_metadata=True)
        
        # Save preprocessing results
        preprocessing_info = output_dir / 'preprocessing_metadata.json'
        with open(preprocessing_info, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        
        print(f"Augmentation test completed. Results saved to {output_dir}")
        print(f"Created {len(variations)} augmentation variations")
        print(f"Preprocessing metadata: {metadata}")
        
    except Exception as e:
        logger.error(f"Augmentation test failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()