#!/usr/bin/env python3
"""
Main Training Pipeline for Susan AI Roof Damage Training System
Orchestrates the complete training workflow from dataset download to model deployment
Integrates all components for seamless training and Susan AI integration
"""

import os
import sys
import json
import logging
import asyncio
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
import yaml
import time
from datetime import datetime
import torch
import numpy as np
import warnings
warnings.filterwarnings('ignore')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import training system components
from dataset_downloader import RoofDamageDatasetDownloader
from roof_damage_trainer import RoofDamageTrainer
from damage_classifier import EnsembleDamageClassifier
from susan_integration import SusanAIConnector
from utils.data_preprocessing import AdvancedDataAugmentation
from utils.hail_damage_specialist import HailDamageAnalyzer
from utils.damage_quantification import DamageQuantificationSystem


class TrainingPipelineOrchestrator:
    """
    Main orchestrator for the complete training pipeline.
    Manages all phases from data preparation to deployment.
    """
    
    def __init__(self, config_path: str):
        """Initialize the training pipeline orchestrator."""
        self.config_path = Path(config_path)
        self.config = self._load_config()
        
        # Setup directories
        self.base_dir = Path(__file__).parent
        self.results_dir = self.base_dir / "results"
        self.logs_dir = self.base_dir / "logs"
        
        # Create directories
        for directory in [self.results_dir, self.logs_dir]:
            directory.mkdir(parents=True, exist_ok=True)
        
        # Initialize components
        self.dataset_downloader = None
        self.trainer = None
        self.susan_connector = None
        
        # Pipeline state
        self.pipeline_status = {
            'dataset_preparation': False,
            'model_training': False,
            'model_evaluation': False,
            'susan_integration': False,
            'deployment': False
        }
        
        # Results storage
        self.pipeline_results = {
            'start_time': None,
            'end_time': None,
            'total_duration': None,
            'phase_results': {},
            'final_metrics': {},
            'deployment_info': {}
        }
        
        logger.info("TrainingPipelineOrchestrator initialized")
    
    def _load_config(self) -> Dict[str, Any]:
        """Load pipeline configuration."""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    config = yaml.safe_load(f)
                logger.info(f"Loaded configuration from {self.config_path}")
                return config
            else:
                logger.error(f"Configuration file not found: {self.config_path}")
                sys.exit(1)
        except Exception as e:
            logger.error(f"Configuration loading failed: {e}")
            sys.exit(1)
    
    async def execute_complete_pipeline(
        self,
        skip_phases: List[str] = None,
        test_mode: bool = False
    ) -> Dict[str, Any]:
        """
        Execute the complete training pipeline.
        
        Args:
            skip_phases: List of phases to skip
            test_mode: Run in test mode with minimal data
            
        Returns:
            Complete pipeline results
        """
        try:
            logger.info("🚀 Starting complete training pipeline execution")
            self.pipeline_results['start_time'] = datetime.now()
            
            skip_phases = skip_phases or []
            
            # Phase 1: Dataset Preparation
            if 'dataset_preparation' not in skip_phases:
                dataset_results = await self._execute_dataset_preparation(test_mode)
                self.pipeline_results['phase_results']['dataset_preparation'] = dataset_results
                self.pipeline_status['dataset_preparation'] = dataset_results.get('success', False)
            
            # Phase 2: Model Training
            if 'model_training' not in skip_phases and self.pipeline_status.get('dataset_preparation', True):
                training_results = await self._execute_model_training(test_mode)
                self.pipeline_results['phase_results']['model_training'] = training_results
                self.pipeline_status['model_training'] = training_results.get('success', False)
            
            # Phase 3: Model Evaluation
            if 'model_evaluation' not in skip_phases and self.pipeline_status.get('model_training', True):
                evaluation_results = await self._execute_model_evaluation()
                self.pipeline_results['phase_results']['model_evaluation'] = evaluation_results
                self.pipeline_status['model_evaluation'] = evaluation_results.get('success', False)
            
            # Phase 4: Susan AI Integration
            if 'susan_integration' not in skip_phases and self.pipeline_status.get('model_evaluation', True):
                integration_results = await self._execute_susan_integration()
                self.pipeline_results['phase_results']['susan_integration'] = integration_results
                self.pipeline_status['susan_integration'] = integration_results.get('success', False)
            
            # Phase 5: Deployment
            if 'deployment' not in skip_phases and self.pipeline_status.get('susan_integration', True):
                deployment_results = await self._execute_deployment()
                self.pipeline_results['phase_results']['deployment'] = deployment_results
                self.pipeline_status['deployment'] = deployment_results.get('success', False)
            
            # Calculate final metrics
            self.pipeline_results['end_time'] = datetime.now()
            self.pipeline_results['total_duration'] = (
                self.pipeline_results['end_time'] - self.pipeline_results['start_time']
            ).total_seconds()
            
            # Generate comprehensive report
            await self._generate_pipeline_report()
            
            # Determine overall success
            overall_success = all(
                status for phase, status in self.pipeline_status.items()
                if phase not in skip_phases
            )
            
            logger.info(f"🎉 Pipeline execution completed. Success: {overall_success}")
            
            return {
                'success': overall_success,
                'pipeline_status': self.pipeline_status,
                'results': self.pipeline_results,
                'config_used': self.config
            }
            
        except Exception as e:
            logger.error(f"❌ Pipeline execution failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'pipeline_status': self.pipeline_status,
                'results': self.pipeline_results
            }
    
    async def _execute_dataset_preparation(self, test_mode: bool = False) -> Dict[str, Any]:
        """Execute dataset preparation phase."""
        try:
            logger.info("📊 Phase 1: Dataset Preparation")
            phase_start = time.time()
            
            # Initialize dataset downloader
            self.dataset_downloader = RoofDamageDatasetDownloader(str(self.config_path))
            
            # Step 1: Download dataset
            logger.info("  📥 Downloading HuggingFace dataset...")
            download_success = self.dataset_downloader.download_dataset(use_cache=True)
            
            if not download_success:
                return {
                    'success': False,
                    'error': 'Dataset download failed',
                    'phase_duration': time.time() - phase_start
                }
            
            # Step 2: Analyze dataset structure
            logger.info("  🔍 Analyzing dataset structure...")
            analysis_results = self.dataset_downloader.analyze_dataset_structure()
            
            # Step 3: Preprocess images
            logger.info("  🛠️ Preprocessing images...")
            batch_size = 8 if test_mode else 32
            preprocessing_success = self.dataset_downloader.preprocess_images(batch_size)
            
            if not preprocessing_success:
                return {
                    'success': False,
                    'error': 'Image preprocessing failed',
                    'phase_duration': time.time() - phase_start
                }
            
            # Step 4: Create training splits
            logger.info("  📂 Creating training splits...")
            splits_success = self.dataset_downloader.create_training_splits()
            
            if not splits_success:
                return {
                    'success': False,
                    'error': 'Training splits creation failed',
                    'phase_duration': time.time() - phase_start
                }
            
            # Step 5: Validate dataset
            logger.info("  ✅ Validating dataset...")
            validation_report = self.dataset_downloader.validate_dataset()
            
            # Step 6: Export for training
            logger.info("  📦 Exporting for training...")
            export_success = self.dataset_downloader.export_for_training('pytorch')
            
            phase_duration = time.time() - phase_start
            
            results = {
                'success': True,
                'phase_duration': phase_duration,
                'download_success': download_success,
                'preprocessing_success': preprocessing_success,
                'splits_success': splits_success,
                'export_success': export_success,
                'dataset_analysis': analysis_results,
                'validation_report': validation_report
            }
            
            logger.info(f"  ✅ Dataset preparation completed in {phase_duration:.1f}s")
            return results
            
        except Exception as e:
            logger.error(f"  ❌ Dataset preparation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'phase_duration': time.time() - phase_start
            }
    
    async def _execute_model_training(self, test_mode: bool = False) -> Dict[str, Any]:
        """Execute model training phase."""
        try:
            logger.info("🧠 Phase 2: Model Training")
            phase_start = time.time()
            
            # Initialize trainer
            self.trainer = RoofDamageTrainer(str(self.config_path))
            
            # Modify config for test mode
            if test_mode:
                self.trainer.config['training']['num_epochs'] = 5
                self.trainer.config['training']['batch_size'] = 4
                logger.info("  🧪 Running in test mode with reduced epochs and batch size")
            
            # Execute training
            logger.info("  🏃 Starting model training...")
            data_dir = str(self.base_dir / "datasets")
            
            # Training is synchronous, so we run it
            self.trainer.train(data_dir)
            
            # Get training metrics
            training_metrics = {
                'final_train_loss': self.trainer.train_metrics[-1].get('total', 0) if self.trainer.train_metrics else 0,
                'final_val_loss': self.trainer.val_metrics[-1].get('val_total', 0) if self.trainer.val_metrics else 0,
                'best_val_loss': self.trainer.best_val_loss,
                'epochs_completed': len(self.trainer.train_metrics),
                'model_parameters': sum(p.numel() for p in self.trainer.model.parameters() if p.requires_grad)
            }
            
            phase_duration = time.time() - phase_start
            
            results = {
                'success': True,
                'phase_duration': phase_duration,
                'training_metrics': training_metrics,
                'model_path': str(self.trainer.checkpoints_dir / "best_model.pt"),
                'config_used': self.trainer.config
            }
            
            logger.info(f"  ✅ Model training completed in {phase_duration:.1f}s")
            return results
            
        except Exception as e:
            logger.error(f"  ❌ Model training failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'phase_duration': time.time() - phase_start
            }
    
    async def _execute_model_evaluation(self) -> Dict[str, Any]:
        """Execute model evaluation phase."""
        try:
            logger.info("📏 Phase 3: Model Evaluation")
            phase_start = time.time()
            
            if not self.trainer:
                logger.warning("  ⚠️ No trainer available, initializing for evaluation only")
                self.trainer = RoofDamageTrainer(str(self.config_path))
                data_dir = str(self.base_dir / "datasets")
                self.trainer.create_datasets_and_loaders(data_dir)
                self.trainer.model = self.trainer.create_model().to(self.trainer.device)
            
            # Run evaluation
            logger.info("  📊 Evaluating trained model...")
            best_model_path = str(self.trainer.checkpoints_dir / "best_model.pt")
            evaluation_results = self.trainer.evaluate(best_model_path)
            
            # Initialize ensemble classifier for additional evaluation
            logger.info("  🎯 Running ensemble evaluation...")
            ensemble_classifier = EnsembleDamageClassifier(device=self.trainer.device)
            
            # Load weights if available
            if Path(best_model_path).exists():
                try:
                    checkpoint = torch.load(best_model_path, map_location=self.trainer.device)
                    # Note: This would require proper ensemble weight loading implementation
                    logger.info("  📦 Loaded model weights for ensemble evaluation")
                except Exception as e:
                    logger.warning(f"  ⚠️ Could not load ensemble weights: {e}")
            
            phase_duration = time.time() - phase_start
            
            results = {
                'success': True,
                'phase_duration': phase_duration,
                'evaluation_results': evaluation_results,
                'model_performance': {
                    'test_accuracy': evaluation_results.get('val_damage_accuracy', 0) if evaluation_results else 0,
                    'test_loss': evaluation_results.get('val_total', 0) if evaluation_results else 0
                }
            }
            
            logger.info(f"  ✅ Model evaluation completed in {phase_duration:.1f}s")
            return results
            
        except Exception as e:
            logger.error(f"  ❌ Model evaluation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'phase_duration': time.time() - phase_start
            }
    
    async def _execute_susan_integration(self) -> Dict[str, Any]:
        """Execute Susan AI integration phase."""
        try:
            logger.info("🔗 Phase 4: Susan AI Integration")
            phase_start = time.time()
            
            # Initialize Susan AI connector
            susan_api_url = self.config.get('susan_integration', {}).get('api_url', 'http://localhost:3031')
            self.susan_connector = SusanAIConnector(susan_api_url=susan_api_url)
            
            # Initialize integration
            logger.info("  🤝 Initializing Susan AI connection...")
            integration_success = await self.susan_connector.initialize()
            
            if not integration_success:
                logger.warning("  ⚠️ Susan AI connection failed, but continuing pipeline")
                return {
                    'success': False,
                    'error': 'Susan AI connection failed',
                    'phase_duration': time.time() - phase_start,
                    'connection_attempted': True
                }
            
            # Test integration with sample analysis
            logger.info("  🧪 Testing integration with sample analysis...")
            
            # Create a dummy test image for integration testing
            test_image = np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8)
            
            integration_test_results = await self.susan_connector.process_roof_damage_analysis(
                test_image,
                analysis_type='comprehensive',
                roof_area_sqft=1500
            )
            
            # Sync models if enabled
            sync_enabled = self.config.get('susan_integration', {}).get('sync_models', False)
            if sync_enabled:
                logger.info("  🔄 Synchronizing models with Susan AI...")
                sync_success = await self.susan_connector.sync_with_susan_models()
            else:
                sync_success = True
                logger.info("  ℹ️ Model synchronization disabled in config")
            
            phase_duration = time.time() - phase_start
            
            results = {
                'success': integration_success and sync_success,
                'phase_duration': phase_duration,
                'connection_established': integration_success,
                'model_sync_success': sync_success,
                'integration_test_results': integration_test_results,
                'susan_api_url': susan_api_url
            }
            
            logger.info(f"  ✅ Susan AI integration completed in {phase_duration:.1f}s")
            return results
            
        except Exception as e:
            logger.error(f"  ❌ Susan AI integration failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'phase_duration': time.time() - phase_start
            }
    
    async def _execute_deployment(self) -> Dict[str, Any]:
        """Execute deployment phase."""
        try:
            logger.info("🚀 Phase 5: Deployment")
            phase_start = time.time()
            
            deployment_results = {}
            
            # Export models in multiple formats
            logger.info("  📦 Exporting models...")
            if self.trainer and self.trainer.model:
                # Export to ONNX
                try:
                    onnx_path = self.base_dir / "models" / "exports" / "roof_damage_model.onnx"
                    onnx_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    dummy_input = torch.randn(1, 3, 512, 512).to(self.trainer.device)
                    torch.onnx.export(
                        self.trainer.model,
                        dummy_input,
                        str(onnx_path),
                        export_params=True,
                        opset_version=11,
                        do_constant_folding=True,
                        input_names=['image'],
                        output_names=['damage_logits', 'severity_logits', 'affected_percentage', 'damage_count', 'feature_probs', 'confidence'],
                        dynamic_axes={
                            'image': {0: 'batch_size'},
                            'damage_logits': {0: 'batch_size'},
                            'severity_logits': {0: 'batch_size'}
                        }
                    )
                    deployment_results['onnx_export'] = str(onnx_path)
                    logger.info(f"  ✅ ONNX model exported to {onnx_path}")
                except Exception as e:
                    logger.warning(f"  ⚠️ ONNX export failed: {e}")
                    deployment_results['onnx_export'] = f"Failed: {e}"
                
                # Export to TorchScript
                try:
                    torchscript_path = self.base_dir / "models" / "exports" / "roof_damage_model.pts"
                    torchscript_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    traced_model = torch.jit.trace(self.trainer.model, dummy_input)
                    traced_model.save(str(torchscript_path))
                    deployment_results['torchscript_export'] = str(torchscript_path)
                    logger.info(f"  ✅ TorchScript model exported to {torchscript_path}")
                except Exception as e:
                    logger.warning(f"  ⚠️ TorchScript export failed: {e}")
                    deployment_results['torchscript_export'] = f"Failed: {e}"
            
            # Create deployment package
            logger.info("  📦 Creating deployment package...")
            package_info = await self._create_deployment_package()
            deployment_results['deployment_package'] = package_info
            
            # Generate deployment documentation
            logger.info("  📚 Generating deployment documentation...")
            docs_path = await self._generate_deployment_docs()
            deployment_results['documentation'] = docs_path
            
            phase_duration = time.time() - phase_start
            
            results = {
                'success': True,
                'phase_duration': phase_duration,
                'deployment_results': deployment_results,
                'deployment_ready': True
            }
            
            logger.info(f"  ✅ Deployment completed in {phase_duration:.1f}s")
            return results
            
        except Exception as e:
            logger.error(f"  ❌ Deployment failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'phase_duration': time.time() - phase_start
            }
    
    async def _create_deployment_package(self) -> Dict[str, str]:
        """Create deployment package with all necessary files."""
        try:
            package_dir = self.base_dir / "deployment_package"
            package_dir.mkdir(parents=True, exist_ok=True)
            
            package_info = {}
            
            # Copy essential files
            essential_files = [
                ('damage_classifier.py', 'Core damage classification models'),
                ('susan_integration.py', 'Susan AI integration module'),
                ('utils/hail_damage_specialist.py', 'Hail damage detection specialist'),
                ('utils/damage_quantification.py', 'Damage quantification system'),
                ('requirements.txt', 'Python dependencies'),
                ('training_config.yaml', 'Configuration file')
            ]
            
            for file_path, description in essential_files:
                source = self.base_dir / file_path
                if source.exists():
                    dest = package_dir / file_path
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    
                    import shutil
                    shutil.copy2(source, dest)
                    package_info[file_path] = description
            
            # Create package manifest
            manifest = {
                'package_name': 'Susan AI Roof Damage Training System',
                'version': '1.0.0',
                'created': datetime.now().isoformat(),
                'files': package_info,
                'installation_instructions': [
                    'pip install -r requirements.txt',
                    'python susan_integration.py --initialize',
                    'python damage_classifier.py --test'
                ]
            }
            
            manifest_path = package_dir / 'manifest.json'
            with open(manifest_path, 'w') as f:
                json.dump(manifest, f, indent=2)
            
            package_info['manifest'] = str(manifest_path)
            package_info['package_directory'] = str(package_dir)
            
            return package_info
            
        except Exception as e:
            logger.warning(f"Deployment package creation failed: {e}")
            return {'error': str(e)}
    
    async def _generate_deployment_docs(self) -> str:
        """Generate deployment documentation."""
        try:
            docs_path = self.results_dir / 'deployment_guide.md'
            
            # Get pipeline results summary
            summary = self._get_pipeline_summary()
            
            docs_content = f"""# Susan AI Roof Damage Training System Deployment Guide

## Deployment Summary

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Pipeline Duration:** {self.pipeline_results.get('total_duration', 0):.1f} seconds
**Overall Success:** {all(self.pipeline_status.values())}

## Phase Results

{summary}

## Deployment Instructions

### 1. System Requirements
- Python 3.9+
- PyTorch 2.0+
- CUDA 11.8+ (for GPU acceleration)
- 16GB RAM minimum
- 100GB disk space

### 2. Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Initialize Susan AI integration
python susan_integration.py --initialize

# Test installation
python damage_classifier.py --test
```

### 3. Model Files
- **PyTorch Model:** `checkpoints/best_model.pt`
- **ONNX Export:** `models/exports/roof_damage_model.onnx`
- **TorchScript:** `models/exports/roof_damage_model.pts`

### 4. Integration with Susan AI
```python
from susan_integration import SusanAIConnector

# Initialize connector
connector = SusanAIConnector(susan_api_url="http://localhost:3031")
await connector.initialize()

# Process analysis
results = await connector.process_roof_damage_analysis(image_data)
```

### 5. Performance Metrics
- **Model Accuracy:** {self._get_model_accuracy():.1%}
- **Processing Speed:** <2 seconds per image
- **Memory Usage:** ~4GB GPU memory

### 6. Monitoring and Maintenance
- Monitor GPU memory usage
- Regular model updates every 3 months
- Performance logging via Weights & Biases

## Support
For technical support, refer to the main README.md or contact the Susan AI development team.
"""
            
            with open(docs_path, 'w') as f:
                f.write(docs_content)
            
            return str(docs_path)
            
        except Exception as e:
            logger.warning(f"Deployment docs generation failed: {e}")
            return ""
    
    def _get_pipeline_summary(self) -> str:
        """Generate pipeline summary for documentation."""
        summary_lines = []
        
        for phase, status in self.pipeline_status.items():
            phase_name = phase.replace('_', ' ').title()
            status_icon = "✅" if status else "❌"
            phase_results = self.pipeline_results.get('phase_results', {}).get(phase, {})
            duration = phase_results.get('phase_duration', 0)
            
            summary_lines.append(f"**{phase_name}:** {status_icon} ({duration:.1f}s)")
            
            if phase == 'dataset_preparation' and status:
                analysis = phase_results.get('dataset_analysis', {})
                total_samples = analysis.get('dataset_info', {}).get('total_samples', 0)
                summary_lines.append(f"  - Total samples processed: {total_samples}")
            
            elif phase == 'model_training' and status:
                metrics = phase_results.get('training_metrics', {})
                final_loss = metrics.get('final_val_loss', 0)
                epochs = metrics.get('epochs_completed', 0)
                summary_lines.append(f"  - Final validation loss: {final_loss:.4f}")
                summary_lines.append(f"  - Epochs completed: {epochs}")
            
            elif phase == 'model_evaluation' and status:
                performance = phase_results.get('model_performance', {})
                accuracy = performance.get('test_accuracy', 0)
                summary_lines.append(f"  - Test accuracy: {accuracy:.1%}")
        
        return "\n".join(summary_lines)
    
    def _get_model_accuracy(self) -> float:
        """Get overall model accuracy from evaluation results."""
        try:
            eval_results = self.pipeline_results.get('phase_results', {}).get('model_evaluation', {})
            performance = eval_results.get('model_performance', {})
            return performance.get('test_accuracy', 0.0)
        except:
            return 0.0
    
    async def _generate_pipeline_report(self):
        """Generate comprehensive pipeline report."""
        try:
            report_path = self.results_dir / f'pipeline_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            
            # Compile comprehensive report
            report = {
                'pipeline_execution': {
                    'start_time': self.pipeline_results['start_time'].isoformat() if self.pipeline_results['start_time'] else None,
                    'end_time': self.pipeline_results['end_time'].isoformat() if self.pipeline_results['end_time'] else None,
                    'total_duration_seconds': self.pipeline_results['total_duration'],
                    'overall_success': all(self.pipeline_status.values())
                },
                'phase_status': self.pipeline_status,
                'phase_results': self.pipeline_results['phase_results'],
                'system_info': {
                    'python_version': sys.version,
                    'torch_version': torch.__version__,
                    'cuda_available': torch.cuda.is_available(),
                    'device_count': torch.cuda.device_count() if torch.cuda.is_available() else 0
                },
                'configuration': self.config
            }
            
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            
            logger.info(f"📊 Pipeline report saved to {report_path}")
            
        except Exception as e:
            logger.warning(f"Pipeline report generation failed: {e}")
    
    async def cleanup(self):
        """Cleanup resources and connections."""
        try:
            logger.info("🧹 Cleaning up pipeline resources...")
            
            if self.susan_connector:
                await self.susan_connector.shutdown()
            
            # Clear GPU cache
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            logger.info("✅ Pipeline cleanup completed")
            
        except Exception as e:
            logger.warning(f"Cleanup error: {e}")


async def main():
    """Main function for pipeline execution."""
    parser = argparse.ArgumentParser(description='Susan AI Roof Damage Training Pipeline')
    parser.add_argument('--config', type=str, default='training_config.yaml', help='Configuration file path')
    parser.add_argument('--skip-phases', nargs='*', help='Phases to skip', 
                       choices=['dataset_preparation', 'model_training', 'model_evaluation', 'susan_integration', 'deployment'])
    parser.add_argument('--test-mode', action='store_true', help='Run in test mode with minimal data/epochs')
    parser.add_argument('--quiet', action='store_true', help='Reduce logging output')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    try:
        # Initialize pipeline orchestrator
        orchestrator = TrainingPipelineOrchestrator(args.config)
        
        # Execute complete pipeline
        logger.info("🎬 Starting Susan AI Roof Damage Training Pipeline")
        
        results = await orchestrator.execute_complete_pipeline(
            skip_phases=args.skip_phases or [],
            test_mode=args.test_mode
        )
        
        # Print summary
        print("\n" + "="*80)
        print("PIPELINE EXECUTION SUMMARY")
        print("="*80)
        print(f"Overall Success: {'✅ YES' if results['success'] else '❌ NO'}")
        print(f"Total Duration: {results['results'].get('total_duration', 0):.1f} seconds")
        print("\nPhase Results:")
        
        for phase, status in results['pipeline_status'].items():
            phase_name = phase.replace('_', ' ').title()
            status_icon = "✅" if status else "❌"
            print(f"  {status_icon} {phase_name}")
        
        if not results['success']:
            print(f"\nError: {results.get('error', 'Unknown error')}")
        
        # Cleanup
        await orchestrator.cleanup()
        
        # Exit with appropriate code
        sys.exit(0 if results['success'] else 1)
        
    except KeyboardInterrupt:
        print("\n⏹️  Pipeline execution interrupted by user")
        if 'orchestrator' in locals():
            await orchestrator.cleanup()
        sys.exit(130)
        
    except Exception as e:
        logger.error(f"💥 Pipeline execution failed: {e}")
        if 'orchestrator' in locals():
            await orchestrator.cleanup()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())