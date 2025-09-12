#!/usr/bin/env python3
"""
MLOps Infrastructure Setup for Susan AI
Week 1 Critical Implementation - Experiment Tracking, Model Registry, and Monitoring

This script sets up the complete MLOps infrastructure required for the 26-week
reconstruction plan including:
1. Experiment tracking with MLflow and Weights & Biases
2. Model registry and versioning
3. Real-time monitoring and alerting
4. Automated quality gates
5. CI/CD pipeline foundations
"""

import os
import sys
import json
import yaml
import logging
import mlflow
import mlflow.tracking
from pathlib import Path
from typing import Dict, List, Optional, Any
import subprocess
import time
from datetime import datetime
import sqlite3
import shutil
import requests
import tempfile
from dataclasses import dataclass, asdict
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from collections import defaultdict
import threading
# import schedule  # Remove for emergency deployment

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class ModelMetrics:
    """Model performance metrics for tracking."""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    specificity: float
    false_positive_rate: float
    confidence_score: float
    timestamp: str
    model_version: str
    dataset_version: str


@dataclass  
class QualityGate:
    """Quality gate definition for automated validation."""
    name: str
    metric: str
    threshold: float
    operator: str  # 'gt', 'lt', 'ge', 'le', 'eq'
    critical: bool = False
    

class MLOpsInfrastructure:
    """
    Complete MLOps infrastructure setup and management.
    Handles all aspects of ML lifecycle management for Susan AI.
    """
    
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.mlops_dir = self.project_root / "mlops"
        
        # Create directory structure
        self._create_directory_structure()
        
        # Configuration
        self.config = self._load_or_create_config()
        
        # Initialize components
        self.mlflow_uri = None
        self.model_registry = None
        self.monitoring_db_path = self.mlops_dir / "monitoring" / "metrics.db"
        
        # Quality gates for Susan AI
        self.quality_gates = [
            QualityGate("min_accuracy", "accuracy", 0.85, "ge", critical=True),
            QualityGate("max_false_positive_rate", "false_positive_rate", 0.10, "le", critical=True),
            QualityGate("min_specificity", "specificity", 0.90, "ge", critical=True),
            QualityGate("min_precision", "precision", 0.80, "ge", critical=True),
            QualityGate("min_recall", "recall", 0.75, "ge", critical=False),
            QualityGate("min_confidence", "confidence_score", 0.70, "ge", critical=False)
        ]
        
        logger.info("MLOps Infrastructure initialized")
    
    def _create_directory_structure(self):
        """Create MLOps directory structure."""
        directories = [
            "mlops",
            "mlops/experiments", 
            "mlops/models",
            "mlops/models/registry",
            "mlops/models/staging",
            "mlops/models/production",
            "mlops/models/archived",
            "mlops/monitoring",
            "mlops/monitoring/dashboards",
            "mlops/monitoring/alerts",
            "mlops/monitoring/logs",
            "mlops/data",
            "mlops/data/versions",
            "mlops/data/quality_reports",
            "mlops/pipelines",
            "mlops/pipelines/training",
            "mlops/pipelines/inference", 
            "mlops/pipelines/deployment",
            "mlops/config",
            "mlops/scripts",
            "mlops/tests",
            "mlops/artifacts"
        ]
        
        for directory in directories:
            dir_path = self.project_root / directory
            dir_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Created MLOps directory structure in {self.mlops_dir}")
    
    def _load_or_create_config(self) -> Dict[str, Any]:
        """Load or create MLOps configuration."""
        config_path = self.mlops_dir / "config" / "mlops_config.yaml"
        
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"Loaded MLOps config from {config_path}")
        else:
            config = self._create_default_config()
            config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(config_path, 'w') as f:
                yaml.dump(config, f, default_flow_style=False, indent=2)
            logger.info(f"Created default MLOps config at {config_path}")
        
        return config
    
    def _create_default_config(self) -> Dict[str, Any]:
        """Create default MLOps configuration."""
        return {
            'project': {
                'name': 'susan-ai-roof-damage',
                'description': 'Susan AI Roof Damage Detection MLOps Pipeline',
                'version': '1.0.0'
            },
            'mlflow': {
                'tracking_uri': str(self.mlops_dir / "experiments" / "mlruns"),
                'artifact_root': str(self.mlops_dir / "artifacts"),
                'default_experiment': 'susan-ai-training'
            },
            'wandb': {
                'project': 'susan-ai-roof-damage',
                'entity': None,  # Set via environment variable
                'enabled': False  # Enable when API key is available
            },
            'model_registry': {
                'backend': 'mlflow',
                'staging_threshold': 0.80,
                'production_threshold': 0.85,
                'auto_promotion': False
            },
            'monitoring': {
                'metrics_retention_days': 90,
                'alert_thresholds': {
                    'accuracy_drop': 0.05,
                    'false_positive_spike': 0.15,
                    'latency_increase': 2.0
                },
                'dashboard_refresh_seconds': 30
            },
            'quality_gates': {
                'enabled': True,
                'fail_on_critical': True,
                'notification_channels': ['console', 'file']
            },
            'data_versioning': {
                'enabled': True,
                'storage_path': str(self.mlops_dir / "data" / "versions"),
                'compression': True
            },
            'ci_cd': {
                'auto_training_trigger': False,
                'deployment_approval_required': True,
                'rollback_on_failure': True
            }
        }
    
    def setup_mlflow(self) -> bool:
        """Set up MLflow tracking and model registry."""
        try:
            # Set MLflow tracking URI
            self.mlflow_uri = f"file://{self.mlops_dir}/experiments/mlruns"
            mlflow.set_tracking_uri(self.mlflow_uri)
            
            # Create default experiment
            experiment_name = self.config['mlflow']['default_experiment']
            try:
                experiment = mlflow.create_experiment(
                    name=experiment_name,
                    artifact_location=self.config['mlflow']['artifact_root']
                )
                logger.info(f"Created MLflow experiment: {experiment_name}")
            except mlflow.exceptions.MlflowException:
                # Experiment already exists
                experiment = mlflow.get_experiment_by_name(experiment_name)
                logger.info(f"Using existing MLflow experiment: {experiment_name}")
            
            # Test MLflow functionality
            with mlflow.start_run(experiment_id=experiment.experiment_id):
                mlflow.log_param("setup_test", "mlflow_initialization")
                mlflow.log_metric("setup_success", 1.0)
                mlflow.set_tag("setup_timestamp", datetime.now().isoformat())
            
            logger.info(f"MLflow setup complete. Tracking URI: {self.mlflow_uri}")
            return True
            
        except Exception as e:
            logger.error(f"MLflow setup failed: {e}")
            return False
    
    def setup_wandb(self, api_key: Optional[str] = None) -> bool:
        """Set up Weights & Biases integration."""
        try:
            # Check for API key
            wandb_api_key = api_key or os.getenv('WANDB_API_KEY')
            
            if not wandb_api_key:
                logger.warning("WANDB_API_KEY not found. Weights & Biases integration disabled.")
                self.config['wandb']['enabled'] = False
                return False
            
            # Try to import and initialize wandb
            try:
                import wandb
                
                # Login to wandb
                wandb.login(key=wandb_api_key)
                
                # Test initialization
                run = wandb.init(
                    project=self.config['wandb']['project'],
                    name="mlops_setup_test",
                    tags=["setup", "infrastructure"],
                    config={"test": "wandb_initialization"}
                )
                
                wandb.log({"setup_success": 1.0})
                run.finish()
                
                self.config['wandb']['enabled'] = True
                logger.info("Weights & Biases setup complete")
                return True
                
            except ImportError:
                logger.warning("wandb package not installed. Run: pip install wandb")
                return False
            
        except Exception as e:
            logger.error(f"Weights & Biases setup failed: {e}")
            self.config['wandb']['enabled'] = False
            return False
    
    def setup_monitoring_database(self) -> bool:
        """Set up monitoring database for metrics tracking."""
        try:
            # Create monitoring database
            conn = sqlite3.connect(self.monitoring_db_path)
            cursor = conn.cursor()
            
            # Create metrics table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS model_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    model_version TEXT NOT NULL,
                    dataset_version TEXT NOT NULL,
                    accuracy REAL NOT NULL,
                    precision_score REAL NOT NULL,
                    recall_score REAL NOT NULL,
                    f1_score REAL NOT NULL,
                    specificity REAL NOT NULL,
                    false_positive_rate REAL NOT NULL,
                    confidence_score REAL NOT NULL,
                    metadata TEXT
                )
            ''')
            
            # Create alerts table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    alert_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    message TEXT NOT NULL,
                    resolved BOOLEAN DEFAULT FALSE,
                    metadata TEXT
                )
            ''')
            
            # Create model versions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS model_versions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version TEXT UNIQUE NOT NULL,
                    timestamp TEXT NOT NULL,
                    model_path TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    performance_metrics TEXT,
                    tags TEXT,
                    description TEXT
                )
            ''')
            
            conn.commit()
            conn.close()
            
            logger.info(f"Monitoring database created at {self.monitoring_db_path}")
            return True
            
        except Exception as e:
            logger.error(f"Monitoring database setup failed: {e}")
            return False
    
    def setup_model_registry(self) -> bool:
        """Set up model registry for version management."""
        try:
            registry_path = self.mlops_dir / "models" / "registry" / "registry.json"
            
            if not registry_path.exists():
                # Create initial registry
                registry_data = {
                    'created': datetime.now().isoformat(),
                    'models': {},
                    'stages': {
                        'development': {
                            'description': 'Models under development',
                            'requirements': []
                        },
                        'staging': {
                            'description': 'Models ready for testing',
                            'requirements': [
                                'accuracy >= 0.80',
                                'false_positive_rate <= 0.15'
                            ]
                        },
                        'production': {
                            'description': 'Production-ready models',
                            'requirements': [
                                'accuracy >= 0.85', 
                                'false_positive_rate <= 0.10',
                                'specificity >= 0.90'
                            ]
                        },
                        'archived': {
                            'description': 'Deprecated models',
                            'requirements': []
                        }
                    }
                }
                
                with open(registry_path, 'w') as f:
                    json.dump(registry_data, f, indent=2)
            
            self.model_registry = str(registry_path)
            logger.info(f"Model registry initialized at {registry_path}")
            return True
            
        except Exception as e:
            logger.error(f"Model registry setup failed: {e}")
            return False
    
    def log_metrics(self, metrics: ModelMetrics) -> bool:
        """Log metrics to monitoring database."""
        try:
            conn = sqlite3.connect(self.monitoring_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO model_metrics 
                (timestamp, model_version, dataset_version, accuracy, precision_score, 
                 recall_score, f1_score, specificity, false_positive_rate, confidence_score, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                metrics.timestamp,
                metrics.model_version,
                metrics.dataset_version,
                metrics.accuracy,
                metrics.precision,
                metrics.recall,
                metrics.f1_score,
                metrics.specificity,
                metrics.false_positive_rate,
                metrics.confidence_score,
                json.dumps(asdict(metrics))
            ))
            
            conn.commit()
            conn.close()
            
            # Check quality gates
            self._check_quality_gates(metrics)
            
            logger.info(f"Metrics logged for model {metrics.model_version}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to log metrics: {e}")
            return False
    
    def _check_quality_gates(self, metrics: ModelMetrics) -> List[QualityGate]:
        """Check metrics against quality gates."""
        failed_gates = []
        
        metrics_dict = asdict(metrics)
        
        for gate in self.quality_gates:
            if gate.metric not in metrics_dict:
                continue
            
            value = metrics_dict[gate.metric]
            threshold = gate.threshold
            
            # Evaluate condition
            passed = False
            if gate.operator == 'gt':
                passed = value > threshold
            elif gate.operator == 'ge':
                passed = value >= threshold
            elif gate.operator == 'lt':
                passed = value < threshold
            elif gate.operator == 'le':
                passed = value <= threshold
            elif gate.operator == 'eq':
                passed = abs(value - threshold) < 1e-6
            
            if not passed:
                failed_gates.append(gate)
                
                # Create alert
                self._create_alert(
                    alert_type="quality_gate_failure",
                    severity="critical" if gate.critical else "warning",
                    message=f"Quality gate '{gate.name}' failed: {gate.metric}={value:.3f} (threshold: {gate.operator} {threshold})",
                    metadata={"gate": gate.name, "value": value, "threshold": threshold}
                )
        
        if failed_gates:
            logger.warning(f"{len(failed_gates)} quality gates failed")
        else:
            logger.info("All quality gates passed ✅")
        
        return failed_gates
    
    def _create_alert(self, alert_type: str, severity: str, message: str, metadata: Dict = None) -> bool:
        """Create monitoring alert."""
        try:
            conn = sqlite3.connect(self.monitoring_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO alerts (timestamp, alert_type, severity, message, metadata)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                datetime.now().isoformat(),
                alert_type,
                severity,
                message,
                json.dumps(metadata or {})
            ))
            
            conn.commit()
            conn.close()
            
            # Console alert
            if severity == "critical":
                logger.error(f"🚨 CRITICAL ALERT: {message}")
            else:
                logger.warning(f"⚠️  WARNING: {message}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create alert: {e}")
            return False
    
    def register_model(self, model_path: str, version: str, stage: str = "development", 
                      metrics: ModelMetrics = None, description: str = "") -> bool:
        """Register a new model version."""
        try:
            # Copy model to registry
            stage_dir = self.mlops_dir / "models" / stage
            stage_dir.mkdir(exist_ok=True)
            
            model_file = f"model_{version}.pt"
            registry_model_path = stage_dir / model_file
            
            if Path(model_path).exists():
                shutil.copy2(model_path, registry_model_path)
            
            # Update registry database
            conn = sqlite3.connect(self.monitoring_db_path)
            cursor = conn.cursor()
            
            performance_data = asdict(metrics) if metrics else {}
            
            cursor.execute('''
                INSERT OR REPLACE INTO model_versions 
                (version, timestamp, model_path, stage, performance_metrics, description)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                version,
                datetime.now().isoformat(),
                str(registry_model_path),
                stage,
                json.dumps(performance_data),
                description
            ))
            
            conn.commit()
            conn.close()
            
            # Log to MLflow if available
            if self.mlflow_uri:
                try:
                    with mlflow.start_run():
                        mlflow.log_artifact(model_path, "model")
                        if metrics:
                            mlflow.log_metrics({
                                "accuracy": metrics.accuracy,
                                "precision": metrics.precision,
                                "recall": metrics.recall,
                                "f1_score": metrics.f1_score,
                                "specificity": metrics.specificity,
                                "false_positive_rate": metrics.false_positive_rate
                            })
                        mlflow.set_tag("version", version)
                        mlflow.set_tag("stage", stage)
                except Exception as e:
                    logger.warning(f"MLflow logging failed: {e}")
            
            logger.info(f"Model {version} registered in {stage} stage")
            return True
            
        except Exception as e:
            logger.error(f"Model registration failed: {e}")
            return False
    
    def promote_model(self, version: str, from_stage: str, to_stage: str) -> bool:
        """Promote model between stages."""
        try:
            # Check if model meets stage requirements
            if not self._validate_promotion(version, to_stage):
                logger.error(f"Model {version} does not meet requirements for {to_stage}")
                return False
            
            # Move model files
            from_dir = self.mlops_dir / "models" / from_stage
            to_dir = self.mlops_dir / "models" / to_stage
            to_dir.mkdir(exist_ok=True)
            
            model_file = f"model_{version}.pt"
            from_path = from_dir / model_file
            to_path = to_dir / model_file
            
            if from_path.exists():
                shutil.copy2(from_path, to_path)
            
            # Update database
            conn = sqlite3.connect(self.monitoring_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE model_versions 
                SET stage = ?, timestamp = ?, model_path = ?
                WHERE version = ?
            ''', (to_stage, datetime.now().isoformat(), str(to_path), version))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Model {version} promoted from {from_stage} to {to_stage}")
            return True
            
        except Exception as e:
            logger.error(f"Model promotion failed: {e}")
            return False
    
    def _validate_promotion(self, version: str, target_stage: str) -> bool:
        """Validate if model can be promoted to target stage."""
        try:
            # Get model metrics
            conn = sqlite3.connect(self.monitoring_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT performance_metrics FROM model_versions 
                WHERE version = ?
            ''', (version,))
            
            result = cursor.fetchone()
            conn.close()
            
            if not result or not result[0]:
                logger.warning(f"No performance metrics found for model {version}")
                return False
            
            metrics_data = json.loads(result[0])
            
            # Check stage requirements
            if target_stage == "staging":
                return (metrics_data.get('accuracy', 0) >= 0.80 and 
                       metrics_data.get('false_positive_rate', 1) <= 0.15)
            elif target_stage == "production":
                return (metrics_data.get('accuracy', 0) >= 0.85 and
                       metrics_data.get('false_positive_rate', 1) <= 0.10 and
                       metrics_data.get('specificity', 0) >= 0.90)
            
            return True
            
        except Exception as e:
            logger.error(f"Promotion validation failed: {e}")
            return False
    
    def create_monitoring_dashboard(self) -> str:
        """Create monitoring dashboard HTML."""
        try:
            dashboard_path = self.mlops_dir / "monitoring" / "dashboards" / "main_dashboard.html"
            
            # Get recent metrics
            conn = sqlite3.connect(self.monitoring_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM model_metrics 
                ORDER BY timestamp DESC 
                LIMIT 100
            ''')
            
            metrics_data = cursor.fetchall()
            
            cursor.execute('''
                SELECT * FROM alerts 
                WHERE resolved = FALSE 
                ORDER BY timestamp DESC 
                LIMIT 50
            ''')
            
            alerts_data = cursor.fetchall()
            conn.close()
            
            # Generate dashboard HTML
            dashboard_html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Susan AI MLOps Dashboard</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #2c3e50; color: white; padding: 20px; text-align: center; }}
        .metrics-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }}
        .metric-card {{ background: #f8f9fa; padding: 20px; border-radius: 5px; border-left: 4px solid #3498db; }}
        .metric-value {{ font-size: 2em; font-weight: bold; color: #2c3e50; }}
        .metric-label {{ color: #7f8c8d; }}
        .alerts {{ margin: 20px 0; }}
        .alert {{ padding: 10px; margin: 5px 0; border-radius: 3px; }}
        .alert-critical {{ background: #e74c3c; color: white; }}
        .alert-warning {{ background: #f39c12; color: white; }}
        .chart {{ margin: 20px 0; height: 400px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🏠 Susan AI MLOps Dashboard</h1>
        <p>Real-time Monitoring for Roof Damage Detection System</p>
        <p>Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
    
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-value">
                {len([m for m in metrics_data if m[4] >= 0.85])}/{len(metrics_data)}
            </div>
            <div class="metric-label">Models Meeting Accuracy Target</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">
                {len([a for a in alerts_data if a[3] == 'critical'])}
            </div>
            <div class="metric-label">Critical Alerts</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">
                {metrics_data[0][4]:.3f if metrics_data else 'N/A'}
            </div>
            <div class="metric-label">Latest Model Accuracy</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">
                {metrics_data[0][9]:.3f if metrics_data else 'N/A'}
            </div>
            <div class="metric-label">Latest False Positive Rate</div>
        </div>
    </div>
    
    <div class="alerts">
        <h2>🚨 Active Alerts</h2>
        {self._generate_alerts_html(alerts_data)}
    </div>
    
    <div id="accuracy-chart" class="chart"></div>
    <div id="fpr-chart" class="chart"></div>
    
    <script>
        // Accuracy over time
        var accuracyData = {{
            x: [{','.join([f'"{m[1]}"' for m in metrics_data[::-1]])}],
            y: [{','.join([str(m[4]) for m in metrics_data[::-1]])}],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Accuracy',
            line: {{color: '#3498db'}}
        }};
        
        var accuracyLayout = {{
            title: 'Model Accuracy Over Time',
            xaxis: {{title: 'Timestamp'}},
            yaxis: {{title: 'Accuracy', range: [0, 1]}},
            shapes: [{{
                type: 'line',
                x0: '{metrics_data[-1][1] if metrics_data else ""}',
                y0: 0.85,
                x1: '{metrics_data[0][1] if metrics_data else ""}',
                y1: 0.85,
                line: {{color: 'red', width: 2, dash: 'dash'}},
                name: 'Target Threshold'
            }}]
        }};
        
        Plotly.newPlot('accuracy-chart', [accuracyData], accuracyLayout);
        
        // False Positive Rate over time
        var fprData = {{
            x: [{','.join([f'"{m[1]}"' for m in metrics_data[::-1]])}],
            y: [{','.join([str(m[9]) for m in metrics_data[::-1]])}],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'False Positive Rate',
            line: {{color: '#e74c3c'}}
        }};
        
        var fprLayout = {{
            title: 'False Positive Rate Over Time',
            xaxis: {{title: 'Timestamp'}},
            yaxis: {{title: 'False Positive Rate', range: [0, 1]}},
            shapes: [{{
                type: 'line',
                x0: '{metrics_data[-1][1] if metrics_data else ""}',
                y0: 0.10,
                x1: '{metrics_data[0][1] if metrics_data else ""}',
                y1: 0.10,
                line: {{color: 'red', width: 2, dash: 'dash'}},
                name: 'Maximum Threshold'
            }}]
        }};
        
        Plotly.newPlot('fpr-chart', [fprData], fprLayout);
        
        // Auto-refresh every 30 seconds
        setTimeout(function(){{
            location.reload();
        }}, 30000);
    </script>
</body>
</html>
"""
            
            with open(dashboard_path, 'w') as f:
                f.write(dashboard_html)
            
            logger.info(f"Monitoring dashboard created at {dashboard_path}")
            return str(dashboard_path)
            
        except Exception as e:
            logger.error(f"Dashboard creation failed: {e}")
            return ""
    
    def _generate_alerts_html(self, alerts_data: List) -> str:
        """Generate HTML for alerts display."""
        if not alerts_data:
            return "<p>✅ No active alerts</p>"
        
        html = ""
        for alert in alerts_data:
            severity_class = f"alert-{alert[3]}"
            icon = "🚨" if alert[3] == "critical" else "⚠️"
            html += f'<div class="alert {severity_class}">{icon} {alert[4]} ({alert[1]})</div>'
        
        return html
    
    def setup_ci_cd_pipeline(self) -> bool:
        """Set up basic CI/CD pipeline scripts."""
        try:
            # Training pipeline script
            training_script = self.mlops_dir / "pipelines" / "training" / "train_model.py"
            training_script.parent.mkdir(parents=True, exist_ok=True)
            
            training_content = '''#!/usr/bin/env python3
"""
Automated Training Pipeline for Susan AI
Triggered by CI/CD system or schedule
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from emergency_binary_classifier import main as train_emergency_classifier
from mlops_infrastructure_setup import MLOpsInfrastructure

def main():
    """Run automated training pipeline."""
    print("🚀 Starting automated training pipeline...")
    
    # Initialize MLOps infrastructure
    mlops = MLOpsInfrastructure()
    
    # Run training
    model_path, success = train_emergency_classifier()
    
    if success and model_path:
        print("✅ Training completed successfully")
        
        # Register model
        version = f"auto_{int(time.time())}"
        mlops.register_model(
            model_path=model_path,
            version=version,
            stage="development",
            description="Automatically trained model"
        )
        
        print(f"📦 Model {version} registered")
    else:
        print("❌ Training failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
'''
            
            with open(training_script, 'w') as f:
                f.write(training_content)
            
            # Deployment script
            deployment_script = self.mlops_dir / "pipelines" / "deployment" / "deploy_model.py"
            deployment_script.parent.mkdir(parents=True, exist_ok=True)
            
            deployment_content = '''#!/usr/bin/env python3
"""
Automated Deployment Pipeline for Susan AI
Handles model promotion and deployment
"""

import sys
import argparse
from mlops_infrastructure_setup import MLOpsInfrastructure

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-version', required=True)
    parser.add_argument('--target-stage', required=True)
    args = parser.parse_args()
    
    mlops = MLOpsInfrastructure()
    
    print(f"🚀 Deploying model {args.model_version} to {args.target_stage}")
    
    # Promote model
    success = mlops.promote_model(
        version=args.model_version,
        from_stage="staging",
        to_stage=args.target_stage
    )
    
    if success:
        print("✅ Deployment successful")
    else:
        print("❌ Deployment failed") 
        sys.exit(1)

if __name__ == "__main__":
    main()
'''
            
            with open(deployment_script, 'w') as f:
                f.write(deployment_content)
            
            # Make scripts executable
            os.chmod(training_script, 0o755)
            os.chmod(deployment_script, 0o755)
            
            logger.info("CI/CD pipeline scripts created")
            return True
            
        except Exception as e:
            logger.error(f"CI/CD setup failed: {e}")
            return False
    
    def run_health_check(self) -> Dict[str, bool]:
        """Run comprehensive health check of MLOps infrastructure."""
        health_status = {}
        
        # Check MLflow
        try:
            mlflow.list_experiments()
            health_status['mlflow'] = True
        except:
            health_status['mlflow'] = False
        
        # Check monitoring database
        try:
            conn = sqlite3.connect(self.monitoring_db_path)
            conn.execute("SELECT COUNT(*) FROM model_metrics")
            conn.close()
            health_status['monitoring_db'] = True
        except:
            health_status['monitoring_db'] = False
        
        # Check model registry
        health_status['model_registry'] = Path(self.model_registry).exists() if self.model_registry else False
        
        # Check directory structure
        required_dirs = ['experiments', 'models', 'monitoring', 'pipelines']
        health_status['directory_structure'] = all(
            (self.mlops_dir / dir_name).exists() for dir_name in required_dirs
        )
        
        # Overall health
        health_status['overall'] = all(health_status.values())
        
        return health_status
    
    def generate_setup_report(self) -> str:
        """Generate comprehensive setup report."""
        health_status = self.run_health_check()
        
        report = {
            'setup_timestamp': datetime.now().isoformat(),
            'project_root': str(self.project_root),
            'mlops_directory': str(self.mlops_dir),
            'configuration': self.config,
            'health_check': health_status,
            'infrastructure_components': {
                'mlflow_tracking': {
                    'enabled': True,
                    'uri': self.mlflow_uri,
                    'status': health_status.get('mlflow', False)
                },
                'wandb_integration': {
                    'enabled': self.config['wandb']['enabled'],
                    'project': self.config['wandb']['project'],
                    'status': self.config['wandb']['enabled']
                },
                'model_registry': {
                    'enabled': True,
                    'path': self.model_registry,
                    'status': health_status.get('model_registry', False)
                },
                'monitoring_system': {
                    'enabled': True,
                    'database': str(self.monitoring_db_path),
                    'status': health_status.get('monitoring_db', False)
                },
                'quality_gates': {
                    'enabled': True,
                    'count': len(self.quality_gates),
                    'critical_gates': len([g for g in self.quality_gates if g.critical])
                }
            },
            'quality_gates': [asdict(gate) for gate in self.quality_gates],
            'next_steps': [
                'Run emergency binary classifier training',
                'Test model registration and promotion',
                'Set up automated monitoring alerts',
                'Configure CI/CD pipeline triggers',
                'Establish data versioning workflow'
            ]
        }
        
        report_path = self.mlops_dir / "setup_report.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        return str(report_path)


def main():
    """Main setup function for MLOps infrastructure."""
    logger.info("🏗️  Setting up MLOps Infrastructure for Susan AI")
    logger.info("="*80)
    
    try:
        # Initialize MLOps infrastructure
        mlops = MLOpsInfrastructure()
        
        # Setup components
        logger.info("📊 Setting up MLflow tracking...")
        mlflow_success = mlops.setup_mlflow()
        
        logger.info("📈 Setting up Weights & Biases...")
        wandb_success = mlops.setup_wandb()
        
        logger.info("🗄️  Setting up monitoring database...")
        monitoring_success = mlops.setup_monitoring_database()
        
        logger.info("📦 Setting up model registry...")
        registry_success = mlops.setup_model_registry()
        
        logger.info("🚀 Setting up CI/CD pipelines...")
        cicd_success = mlops.setup_ci_cd_pipeline()
        
        logger.info("📊 Creating monitoring dashboard...")
        dashboard_path = mlops.create_monitoring_dashboard()
        
        # Generate setup report
        report_path = mlops.generate_setup_report()
        
        # Health check
        health_status = mlops.run_health_check()
        
        # Summary
        logger.info("="*80)
        logger.info("MLOPS INFRASTRUCTURE SETUP COMPLETE")
        logger.info("="*80)
        logger.info(f"✅ MLflow Tracking: {'SUCCESS' if mlflow_success else 'FAILED'}")
        logger.info(f"✅ Weights & Biases: {'SUCCESS' if wandb_success else 'SKIPPED'}")
        logger.info(f"✅ Monitoring Database: {'SUCCESS' if monitoring_success else 'FAILED'}")
        logger.info(f"✅ Model Registry: {'SUCCESS' if registry_success else 'FAILED'}")
        logger.info(f"✅ CI/CD Pipelines: {'SUCCESS' if cicd_success else 'FAILED'}")
        logger.info(f"✅ Overall Health: {'HEALTHY' if health_status['overall'] else 'ISSUES DETECTED'}")
        logger.info("")
        logger.info(f"📊 Monitoring Dashboard: {dashboard_path}")
        logger.info(f"📋 Setup Report: {report_path}")
        logger.info(f"🏗️  MLOps Directory: {mlops.mlops_dir}")
        logger.info("")
        logger.info("🎯 READY FOR EMERGENCY BINARY CLASSIFIER TRAINING!")
        
        return mlops, health_status['overall']
        
    except Exception as e:
        logger.error(f"MLOps infrastructure setup failed: {e}")
        import traceback
        traceback.print_exc()
        return None, False


if __name__ == "__main__":
    main()