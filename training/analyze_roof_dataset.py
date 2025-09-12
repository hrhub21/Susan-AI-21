#!/usr/bin/env python3
"""
Comprehensive analysis of the HuggingFace roof damage dataset.
Provides detailed insights into data quality, distribution, and suitability for training.
"""

import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datasets import load_dataset
from PIL import Image
import pandas as pd
from pathlib import Path
import json
from collections import Counter
import cv2

def analyze_roof_dataset():
    """Comprehensive analysis of the roof damage dataset."""
    
    print("="*80)
    print("COMPREHENSIVE ROOF DAMAGE DATASET ANALYSIS")
    print("="*80)
    
    # Load dataset
    print("Loading dataset...")
    cache_dir = './datasets/cache'
    dataset = load_dataset('brendan12009/Roof_Training_Images_2', cache_dir=cache_dir)
    train_data = dataset['train']
    
    # Basic statistics
    print(f"\n📊 DATASET OVERVIEW")
    print(f"Total samples: {len(train_data)}")
    print(f"Available features: {list(train_data.features.keys())}")
    print(f"Label classes: {train_data.features['label'].names}")
    
    # Label distribution
    labels = train_data['label']
    label_names = train_data.features['label'].names
    unique_labels, label_counts = np.unique(labels, return_counts=True)
    
    print(f"\n🏷️  LABEL DISTRIBUTION")
    for label_idx, count in zip(unique_labels, label_counts):
        label_name = label_names[label_idx]
        percentage = (count / len(train_data)) * 100
        print(f"  {label_name}: {count} images ({percentage:.1f}%)")
    
    # Image size analysis
    print(f"\n📐 IMAGE SIZE ANALYSIS")
    widths, heights, file_sizes, aspect_ratios = [], [], [], []
    
    print("Analyzing image properties...")
    for i in range(min(100, len(train_data))):  # Sample first 100 images
        sample = train_data[i]
        img = sample['image']
        
        widths.append(img.size[0])
        heights.append(img.size[1])
        aspect_ratios.append(img.size[0] / img.size[1])
        
        # Estimate file size
        img_array = np.array(img)
        file_sizes.append(img_array.nbytes)
    
    print(f"  Average dimensions: {np.mean(widths):.0f} x {np.mean(heights):.0f}")
    print(f"  Size range: {min(widths)}x{min(heights)} to {max(widths)}x{max(heights)}")
    print(f"  Average aspect ratio: {np.mean(aspect_ratios):.2f}")
    print(f"  Average file size: {np.mean(file_sizes)/1024/1024:.1f} MB")
    
    # Quality assessment
    print(f"\n🔍 QUALITY ASSESSMENT")
    quality_issues = []
    
    # Check for very small images
    small_images = sum(1 for w, h in zip(widths, heights) if w < 256 or h < 256)
    if small_images > 0:
        quality_issues.append(f"{small_images} images smaller than 256x256")
    
    # Check for very large images
    large_images = sum(1 for w, h in zip(widths, heights) if w > 2048 or h > 2048)
    if large_images > 0:
        quality_issues.append(f"{large_images} images larger than 2048x2048")
    
    # Check aspect ratio extremes
    extreme_ratios = sum(1 for ratio in aspect_ratios if ratio < 0.5 or ratio > 2.0)
    if extreme_ratios > 0:
        quality_issues.append(f"{extreme_ratios} images with extreme aspect ratios")
    
    if quality_issues:
        print("  Quality concerns found:")
        for issue in quality_issues:
            print(f"    - {issue}")
    else:
        print("  ✅ No major quality issues detected")
    
    # Sample image inspection
    print(f"\n🖼️  SAMPLE IMAGE INSPECTION")
    damage_samples = []
    undamaged_samples = []
    
    for i, sample in enumerate(train_data):
        label_name = label_names[sample['label']]
        if label_name == 'Damaged roofs' and len(damage_samples) < 3:
            damage_samples.append((i, sample))
        elif label_name == 'Undamaged Roofs' and len(undamaged_samples) < 3:
            undamaged_samples.append((i, sample))
        
        if len(damage_samples) >= 3 and len(undamaged_samples) >= 3:
            break
    
    print("  Damaged roof samples:")
    for i, (idx, sample) in enumerate(damage_samples):
        img = sample['image']
        print(f"    Sample {idx}: {img.size[0]}x{img.size[1]} pixels")
    
    print("  Undamaged roof samples:")
    for i, (idx, sample) in enumerate(undamaged_samples):
        img = sample['image']
        print(f"    Sample {idx}: {img.size[0]}x{img.size[1]} pixels")
    
    # Dataset suitability for training
    print(f"\n🎯 TRAINING SUITABILITY ASSESSMENT")
    
    suitability_score = 0
    max_score = 10
    
    # Size adequacy (3 points)
    if len(train_data) >= 300:
        suitability_score += 3
        print("  ✅ Dataset size adequate (300+ samples)")
    elif len(train_data) >= 100:
        suitability_score += 2
        print("  ⚠️  Dataset size moderate (100-299 samples)")
    else:
        suitability_score += 1
        print("  ❌ Dataset size small (<100 samples)")
    
    # Label balance (2 points)
    balance_ratio = min(label_counts) / max(label_counts)
    if balance_ratio >= 0.8:
        suitability_score += 2
        print("  ✅ Labels well balanced")
    elif balance_ratio >= 0.6:
        suitability_score += 1
        print("  ⚠️  Labels moderately balanced")
    else:
        print("  ❌ Labels imbalanced")
    
    # Image quality (3 points)
    if len(quality_issues) == 0:
        suitability_score += 3
        print("  ✅ Image quality excellent")
    elif len(quality_issues) <= 2:
        suitability_score += 2
        print("  ⚠️  Image quality good with minor issues")
    else:
        suitability_score += 1
        print("  ❌ Image quality has several issues")
    
    # Label granularity (2 points)
    if len(label_names) >= 5:
        suitability_score += 2
        print("  ✅ Fine-grained damage classification")
    elif len(label_names) >= 3:
        suitability_score += 1
        print("  ⚠️  Basic damage classification")
    else:
        print("  ❌ Only binary classification (damaged/undamaged)")
    
    print(f"\n  Overall suitability score: {suitability_score}/{max_score}")
    
    if suitability_score >= 8:
        print("  🟢 Excellent for training advanced damage detection")
    elif suitability_score >= 6:
        print("  🟡 Good for basic damage detection training")
    elif suitability_score >= 4:
        print("  🟠 Adequate for proof-of-concept training")
    else:
        print("  🔴 Limited training potential - consider data augmentation")
    
    # Recommendations
    print(f"\n💡 RECOMMENDATIONS")
    
    recommendations = []
    
    if len(label_names) == 2:
        recommendations.append("Dataset only provides binary classification - consider supplementing with datasets that have specific damage types (hail, wind, wear)")
        recommendations.append("Use this as a foundation and add manual labeling for damage type specificity")
    
    if large_images > len(widths) * 0.2:
        recommendations.append("Implement image resizing in preprocessing to standardize input sizes")
    
    if balance_ratio < 0.7:
        recommendations.append("Apply data augmentation to balance the classes")
    
    if len(train_data) < 500:
        recommendations.append("Consider collecting more data or finding additional roof damage datasets")
    
    recommendations.append("Implement train/validation/test splits for proper evaluation")
    recommendations.append("Add data augmentation techniques (rotation, brightness, contrast) to increase training diversity")
    
    for i, rec in enumerate(recommendations, 1):
        print(f"  {i}. {rec}")
    
    # Save detailed analysis
    analysis_results = {
        'dataset_info': {
            'total_samples': len(train_data),
            'label_names': label_names,
            'label_distribution': dict(zip([label_names[i] for i in unique_labels], label_counts.tolist()))
        },
        'image_statistics': {
            'avg_width': float(np.mean(widths)),
            'avg_height': float(np.mean(heights)),
            'min_dimensions': [int(min(widths)), int(min(heights))],
            'max_dimensions': [int(max(widths)), int(max(heights))],
            'avg_aspect_ratio': float(np.mean(aspect_ratios)),
            'avg_file_size_mb': float(np.mean(file_sizes)) / 1024 / 1024
        },
        'quality_assessment': {
            'quality_issues': quality_issues,
            'suitability_score': suitability_score,
            'max_score': max_score
        },
        'recommendations': recommendations
    }
    
    # Save analysis
    analysis_file = Path('./datasets/processed/detailed_analysis.json')
    analysis_file.parent.mkdir(parents=True, exist_ok=True)
    with open(analysis_file, 'w') as f:
        json.dump(analysis_results, f, indent=2)
    
    print(f"\n📄 Detailed analysis saved to: {analysis_file}")
    
    # Create visualization
    create_visualizations(train_data, widths, heights, aspect_ratios, label_counts, label_names)
    
    return analysis_results

def create_visualizations(train_data, widths, heights, aspect_ratios, label_counts, label_names):
    """Create visualizations for the dataset analysis."""
    
    plt.style.use('seaborn-v0_8')
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle('Roof Damage Dataset Analysis', fontsize=16, fontweight='bold')
    
    # 1. Label distribution pie chart
    axes[0, 0].pie(label_counts, labels=label_names, autopct='%1.1f%%', startangle=90)
    axes[0, 0].set_title('Label Distribution')
    
    # 2. Image dimensions scatter plot
    axes[0, 1].scatter(widths, heights, alpha=0.6)
    axes[0, 1].set_xlabel('Width (pixels)')
    axes[0, 1].set_ylabel('Height (pixels)')
    axes[0, 1].set_title('Image Dimensions Distribution')
    
    # 3. Aspect ratio histogram
    axes[0, 2].hist(aspect_ratios, bins=20, alpha=0.7)
    axes[0, 2].set_xlabel('Aspect Ratio (W/H)')
    axes[0, 2].set_ylabel('Count')
    axes[0, 2].set_title('Aspect Ratio Distribution')
    axes[0, 2].axvline(np.mean(aspect_ratios), color='red', linestyle='--', label=f'Mean: {np.mean(aspect_ratios):.2f}')
    axes[0, 2].legend()
    
    # 4. Width distribution
    axes[1, 0].hist(widths, bins=20, alpha=0.7, color='skyblue')
    axes[1, 0].set_xlabel('Width (pixels)')
    axes[1, 0].set_ylabel('Count')
    axes[1, 0].set_title('Image Width Distribution')
    
    # 5. Height distribution
    axes[1, 1].hist(heights, bins=20, alpha=0.7, color='lightgreen')
    axes[1, 1].set_xlabel('Height (pixels)')
    axes[1, 1].set_ylabel('Count')
    axes[1, 1].set_title('Image Height Distribution')
    
    # 6. Sample images
    axes[1, 2].axis('off')
    axes[1, 2].text(0.5, 0.7, f'Dataset Summary:', fontsize=14, fontweight='bold', ha='center', transform=axes[1, 2].transAxes)
    axes[1, 2].text(0.5, 0.5, f'Total Images: {len(train_data)}', fontsize=12, ha='center', transform=axes[1, 2].transAxes)
    axes[1, 2].text(0.5, 0.4, f'Damaged: {label_counts[0]}', fontsize=12, ha='center', transform=axes[1, 2].transAxes)
    axes[1, 2].text(0.5, 0.3, f'Undamaged: {label_counts[1]}', fontsize=12, ha='center', transform=axes[1, 2].transAxes)
    axes[1, 2].text(0.5, 0.1, f'Avg Size: {np.mean(widths):.0f}×{np.mean(heights):.0f}', fontsize=12, ha='center', transform=axes[1, 2].transAxes)
    
    plt.tight_layout()
    
    # Save plot
    vis_file = Path('./datasets/processed/dataset_visualization.png')
    vis_file.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(vis_file, dpi=300, bbox_inches='tight')
    print(f"📊 Visualizations saved to: {vis_file}")
    
    plt.close()

if __name__ == "__main__":
    analyze_roof_dataset()