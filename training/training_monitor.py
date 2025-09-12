#!/usr/bin/env python3
"""
Susan AI v2.0 Training Monitor
=============================

Real-time monitoring of the training pipeline progress
"""

import time
import json
import os
import sys
from pathlib import Path
import subprocess
import datetime

class TrainingMonitor:
    def __init__(self):
        self.start_time = time.time()
        self.results_dir = Path("./results/susan_v2_simplified")
        self.models_dir = Path("./models/susan_v2_simplified")
        self.log_file = "susan_v2_simplified.log"
        
    def get_training_progress(self):
        """Get current training progress from logs"""
        try:
            if os.path.exists(self.log_file):
                with open(self.log_file, 'r') as f:
                    lines = f.readlines()
                
                # Extract relevant progress information
                progress_info = {
                    'current_epoch': 0,
                    'total_epochs': 20,
                    'best_accuracy': 0.0,
                    'current_loss': 0.0,
                    'status': 'unknown'
                }
                
                for line in reversed(lines[-50:]):  # Check last 50 lines
                    if 'Epoch [' in line and 'Batch [' in line:
                        # Extract epoch and batch info
                        parts = line.split('Epoch [')[1].split(']')[0].split('/')
                        if len(parts) == 2:
                            progress_info['current_epoch'] = int(parts[0])
                            progress_info['total_epochs'] = int(parts[1])
                        
                        # Extract loss
                        if 'Loss:' in line:
                            try:
                                loss_str = line.split('Loss:')[1].strip()
                                progress_info['current_loss'] = float(loss_str)
                            except:
                                pass
                    
                    elif 'Train Acc:' in line and 'Val Acc:' in line:
                        # Extract validation accuracy
                        try:
                            val_acc_str = line.split('Val Acc:')[1].split('%')[0].strip()
                            progress_info['best_accuracy'] = max(progress_info['best_accuracy'], float(val_acc_str))
                        except:
                            pass
                    
                    elif 'New best model saved' in line:
                        progress_info['status'] = 'improving'
                    
                    elif 'PIPELINE COMPLETED' in line:
                        progress_info['status'] = 'completed'
                        break
                    
                    elif 'Pipeline failed' in line:
                        progress_info['status'] = 'failed'
                        break
                
                if progress_info['current_epoch'] > 0:
                    progress_info['status'] = 'training'
                elif progress_info['status'] == 'unknown':
                    progress_info['status'] = 'initializing'
                
                return progress_info
            else:
                return {'status': 'not_started'}
                
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    def check_model_exists(self):
        """Check if trained model exists"""
        model_path = self.models_dir / "best_model.pth"
        return model_path.exists()
    
    def get_results_summary(self):
        """Get final results if available"""
        try:
            # Find the latest results file
            results_files = list(self.results_dir.glob("pipeline_results_*.json"))
            if results_files:
                latest_results = max(results_files, key=lambda x: x.stat().st_mtime)
                with open(latest_results, 'r') as f:
                    return json.load(f)
            return None
        except Exception as e:
            return {'error': str(e)}
    
    def display_progress(self):
        """Display current progress"""
        progress = self.get_training_progress()
        elapsed_time = (time.time() - self.start_time) / 60  # minutes
        
        print("\n" + "="*60)
        print("SUSAN AI V2.0 TRAINING MONITOR")
        print("="*60)
        print(f"Monitoring Time: {elapsed_time:.1f} minutes")
        print(f"Status: {progress['status'].upper()}")
        
        if progress['status'] == 'training':
            progress_percent = (progress['current_epoch'] / progress['total_epochs']) * 100
            print(f"Progress: Epoch {progress['current_epoch']}/{progress['total_epochs']} ({progress_percent:.1f}%)")
            print(f"Current Loss: {progress['current_loss']:.4f}")
            print(f"Best Accuracy: {progress['best_accuracy']:.2f}%")
            
            # Estimate remaining time
            if progress['current_epoch'] > 0:
                time_per_epoch = elapsed_time / progress['current_epoch']
                remaining_epochs = progress['total_epochs'] - progress['current_epoch']
                estimated_remaining = time_per_epoch * remaining_epochs
                print(f"Estimated Remaining Time: {estimated_remaining:.1f} minutes")
        
        elif progress['status'] == 'completed':
            print("Training completed successfully!")
            results = self.get_results_summary()
            if results:
                print(f"Final Accuracy: {results.get('evaluation_metrics', {}).get('accuracy', 0):.3f}")
                print(f"False Positive Rate: {results.get('evaluation_metrics', {}).get('false_positive_rate', 0):.3f}")
                success = results.get('success_criteria', {}).get('overall_success', False)
                print(f"Target Criteria Met: {'✅ YES' if success else '⚠️  PARTIAL'}")
        
        elif progress['status'] == 'failed':
            print("❌ Training failed. Check logs for details.")
        
        elif progress['status'] == 'initializing':
            print("🔄 Initializing training pipeline...")
        
        print(f"Model Exists: {'✅ YES' if self.check_model_exists() else '❌ NO'}")
        print("="*60)
    
    def monitor_continuously(self, interval=30):
        """Monitor training continuously"""
        print("Starting continuous monitoring (Ctrl+C to stop)...")
        
        try:
            while True:
                self.display_progress()
                
                # Check if training is completed
                progress = self.get_training_progress()
                if progress['status'] in ['completed', 'failed']:
                    break
                
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\nMonitoring stopped by user.")
        except Exception as e:
            print(f"Monitoring error: {e}")

def main():
    """Main function"""
    monitor = TrainingMonitor()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        monitor.monitor_continuously(interval=30)
    else:
        monitor.display_progress()

if __name__ == "__main__":
    main()