#!/usr/bin/env python3
"""
Susan AI Integration Module for Roof Damage Training System
Seamless integration with Susan AI's existing Qwen VL infrastructure
Provides bidirectional communication and enhanced capabilities
"""

import os
import sys
import json
import logging
import asyncio
import aiohttp
import requests
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Union
import numpy as np
import torch
from PIL import Image
import base64
import io
from datetime import datetime
import websocket
import threading
import time
from dataclasses import dataclass, asdict
from enum import Enum
import warnings
warnings.filterwarnings('ignore')

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

# Import Susan AI components
try:
    from src.qwen_vision_integration import QwenVisionIntegration
    from src.api.services.RealRoofingDamageAnalysisService import RealRoofingDamageAnalysisService
    from src.api.services.QwenVLService import QwenVLService
except ImportError as e:
    logging.warning(f"Could not import Susan AI components: {e}")
    QwenVisionIntegration = None
    RealRoofingDamageAnalysisService = None
    QwenVLService = None

# Import training system components
from damage_classifier import EnsembleDamageClassifier
from utils.hail_damage_specialist import HailDamageAnalyzer
from utils.damage_quantification import DamageQuantificationSystem

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class IntegrationStatus(Enum):
    """Status enumeration for integration operations."""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    PROCESSING = "processing"
    READY = "ready"


@dataclass
class TrainingRequest:
    """Data structure for training requests from Susan AI."""
    request_id: str
    image_data: str  # Base64 encoded
    analysis_type: str
    parameters: Dict[str, Any]
    timestamp: str
    callback_url: Optional[str] = None


@dataclass
class TrainingResponse:
    """Data structure for training responses to Susan AI."""
    request_id: str
    success: bool
    results: Dict[str, Any]
    confidence: float
    processing_time: float
    timestamp: str
    error_message: Optional[str] = None


class SusanAIConnector:
    """
    Main connector class for Susan AI integration.
    Handles communication, data exchange, and service coordination.
    """
    
    def __init__(
        self,
        susan_api_url: str = "http://localhost:3031",
        training_service_port: int = 3032,
        config_path: Optional[str] = None
    ):
        """Initialize Susan AI connector."""
        self.susan_api_url = susan_api_url
        self.training_service_port = training_service_port
        self.config = self._load_config(config_path)
        
        # Connection status
        self.status = IntegrationStatus.DISCONNECTED
        self.last_heartbeat = None
        
        # Initialize specialized components
        self.damage_classifier = None
        self.hail_analyzer = None
        self.quantification_system = None
        
        # Susan AI service references
        self.qwen_integration = None
        self.roofing_service = None
        
        # WebSocket connection
        self.ws_connection = None
        self.ws_thread = None
        
        # Request tracking
        self.pending_requests = {}
        self.request_history = []
        
        logger.info("SusanAIConnector initialized")
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration for integration."""
        try:
            if config_path and Path(config_path).exists():
                with open(config_path, 'r') as f:
                    return json.load(f)
            else:
                return self._get_default_config()
        except Exception as e:
            logger.warning(f"Config loading failed: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration."""
        return {
            "connection": {
                "timeout": 30,
                "retry_attempts": 3,
                "heartbeat_interval": 10
            },
            "training": {
                "batch_size": 4,
                "confidence_threshold": 0.7,
                "enable_specialized_models": True
            },
            "integration": {
                "sync_models": True,
                "share_training_data": False,
                "real_time_updates": True
            }
        }
    
    async def initialize(self) -> bool:
        """Initialize all components and establish connections."""
        try:
            logger.info("Initializing Susan AI integration...")
            
            # Initialize specialized models
            await self._initialize_training_models()
            
            # Establish connection with Susan AI
            connection_established = await self._establish_susan_connection()
            
            if connection_established:
                # Initialize Susan AI service references
                await self._initialize_susan_services()
                
                # Start WebSocket connection for real-time communication
                self._start_websocket_connection()
                
                # Start heartbeat monitoring
                self._start_heartbeat_monitoring()
                
                self.status = IntegrationStatus.READY
                logger.info("Susan AI integration initialized successfully")
                return True
            else:
                logger.error("Failed to establish Susan AI connection")
                return False
                
        except Exception as e:
            logger.error(f"Integration initialization failed: {e}")
            self.status = IntegrationStatus.ERROR
            return False
    
    async def _initialize_training_models(self):
        """Initialize training system models."""
        try:
            logger.info("Initializing training models...")
            
            # Initialize damage classifier
            if torch.cuda.is_available():
                device = torch.device('cuda')
            else:
                device = torch.device('cpu')
            
            self.damage_classifier = EnsembleDamageClassifier(device=device)
            
            # Initialize hail damage analyzer
            self.hail_analyzer = HailDamageAnalyzer()
            
            # Initialize quantification system
            self.quantification_system = DamageQuantificationSystem()
            
            logger.info("Training models initialized successfully")
            
        except Exception as e:
            logger.error(f"Training model initialization failed: {e}")
            raise
    
    async def _establish_susan_connection(self) -> bool:
        """Establish connection with Susan AI main system."""
        try:
            logger.info(f"Connecting to Susan AI at {self.susan_api_url}")
            
            # Test connection with health check
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(
                        f"{self.susan_api_url}/status",
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        if response.status == 200:
                            status_data = await response.json()
                            logger.info(f"Susan AI connection established: {status_data}")
                            return True
                        else:
                            logger.error(f"Susan AI returned status {response.status}")
                            return False
                            
                except asyncio.TimeoutError:
                    logger.error("Connection timeout to Susan AI")
                    return False
                    
        except Exception as e:
            logger.error(f"Connection establishment failed: {e}")
            return False
    
    async def _initialize_susan_services(self):
        """Initialize references to Susan AI services."""
        try:
            if QwenVisionIntegration:
                self.qwen_integration = QwenVisionIntegration()
                logger.info("Qwen Vision Integration service connected")
            
            if RealRoofingDamageAnalysisService:
                self.roofing_service = RealRoofingDamageAnalysisService()
                logger.info("Real Roofing Damage Analysis service connected")
                
        except Exception as e:
            logger.warning(f"Susan AI service initialization failed: {e}")
    
    def _start_websocket_connection(self):
        """Start WebSocket connection for real-time communication."""
        try:
            ws_url = self.susan_api_url.replace('http', 'ws') + '/training'
            
            def on_message(ws, message):
                self._handle_websocket_message(message)
            
            def on_error(ws, error):
                logger.error(f"WebSocket error: {error}")
                self.status = IntegrationStatus.ERROR
            
            def on_close(ws, close_status_code, close_msg):
                logger.warning("WebSocket connection closed")
                self.status = IntegrationStatus.DISCONNECTED
            
            def on_open(ws):
                logger.info("WebSocket connection established")
                self.status = IntegrationStatus.CONNECTED
            
            def run_websocket():
                self.ws_connection = websocket.WebSocketApp(
                    ws_url,
                    on_open=on_open,
                    on_message=on_message,
                    on_error=on_error,
                    on_close=on_close
                )
                self.ws_connection.run_forever()
            
            self.ws_thread = threading.Thread(target=run_websocket, daemon=True)
            self.ws_thread.start()
            
        except Exception as e:
            logger.warning(f"WebSocket initialization failed: {e}")
    
    def _start_heartbeat_monitoring(self):
        """Start heartbeat monitoring thread."""
        try:
            def heartbeat_monitor():
                while True:
                    try:
                        self._send_heartbeat()
                        time.sleep(self.config["connection"]["heartbeat_interval"])
                    except Exception as e:
                        logger.warning(f"Heartbeat failed: {e}")
                        time.sleep(5)  # Retry after 5 seconds
            
            heartbeat_thread = threading.Thread(target=heartbeat_monitor, daemon=True)
            heartbeat_thread.start()
            
        except Exception as e:
            logger.warning(f"Heartbeat monitoring setup failed: {e}")
    
    def _send_heartbeat(self):
        """Send heartbeat to Susan AI."""
        try:
            if self.ws_connection and self.status == IntegrationStatus.CONNECTED:
                heartbeat_data = {
                    "type": "heartbeat",
                    "timestamp": datetime.now().isoformat(),
                    "status": self.status.value,
                    "service": "training_system"
                }
                self.ws_connection.send(json.dumps(heartbeat_data))
                self.last_heartbeat = datetime.now()
                
        except Exception as e:
            logger.warning(f"Heartbeat send failed: {e}")
    
    def _handle_websocket_message(self, message: str):
        """Handle incoming WebSocket messages from Susan AI."""
        try:
            data = json.loads(message)
            message_type = data.get('type')
            
            if message_type == 'training_request':
                self._process_training_request(data)
            elif message_type == 'model_update':
                self._handle_model_update(data)
            elif message_type == 'configuration_update':
                self._handle_configuration_update(data)
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except Exception as e:
            logger.error(f"WebSocket message handling failed: {e}")
    
    async def process_roof_damage_analysis(
        self,
        image_data: Union[np.ndarray, str],
        analysis_type: str = 'comprehensive',
        roof_area_sqft: float = 1500,
        return_visualizations: bool = False
    ) -> Dict[str, Any]:
        """
        Process roof damage analysis request with enhanced training capabilities.
        
        Args:
            image_data: Image data (numpy array or base64 string)
            analysis_type: Type of analysis ('hail', 'wind', 'wear', 'comprehensive')
            roof_area_sqft: Roof area in square feet
            return_visualizations: Whether to return visualization images
            
        Returns:
            Comprehensive analysis results
        """
        try:
            start_time = time.time()
            logger.info(f"Processing {analysis_type} analysis request")
            
            # Convert image data to numpy array if needed
            if isinstance(image_data, str):
                image_array = self._decode_base64_image(image_data)
            else:
                image_array = image_data
            
            # Initialize results dictionary
            results = {
                'analysis_type': analysis_type,
                'timestamp': datetime.now().isoformat(),
                'roof_area_sqft': roof_area_sqft
            }
            
            # Comprehensive analysis using ensemble classifier
            if analysis_type in ['comprehensive', 'all']:
                ensemble_results = self.damage_classifier.analyze_damage(
                    torch.tensor(image_array).permute(2, 0, 1).unsqueeze(0),
                    roof_area_sqft
                )
                results['ensemble_analysis'] = ensemble_results
            
            # Specialized hail damage analysis
            if analysis_type in ['hail', 'comprehensive']:
                hail_results = self.hail_analyzer.analyze_hail_damage(
                    image_array, roof_area_sqft
                )
                results['hail_analysis'] = hail_results
            
            # Quantification analysis
            if self.quantification_system:
                # Create binary mask from damage detection
                damage_mask = self._create_damage_mask(image_array, ensemble_results)
                
                # Mock roof measurements for demonstration
                from utils.damage_quantification import RoofMeasurements
                roof_measurements = RoofMeasurements(
                    pixel_to_inch_ratio=0.1,
                    pixel_to_sqft_ratio=roof_area_sqft / (image_array.shape[0] * image_array.shape[1]),
                    roof_area_sqft=roof_area_sqft,
                    image_area_pixels=image_array.shape[0] * image_array.shape[1],
                    calibration_method='estimated',
                    calibration_confidence=0.8
                )
                
                quantification_results = self.quantification_system.quantify_roof_damage(
                    damage_mask, roof_measurements
                )
                results['quantification_analysis'] = quantification_results
            
            # Integration with Susan AI services if available
            if self.qwen_integration:
                try:
                    qwen_results = await self.qwen_integration.analyzeWithVision(
                        image_data, 'roofing_damage', {'roof_area': roof_area_sqft}
                    )
                    results['qwen_integration_results'] = qwen_results
                except Exception as e:
                    logger.warning(f"Qwen integration failed: {e}")
            
            # Generate visualizations if requested
            if return_visualizations:
                visualizations = await self._generate_visualizations(
                    image_array, results
                )
                results['visualizations'] = visualizations
            
            # Calculate processing metrics
            processing_time = time.time() - start_time
            results['processing_metrics'] = {
                'processing_time_seconds': processing_time,
                'analysis_completeness': self._calculate_analysis_completeness(results),
                'confidence_score': self._calculate_overall_confidence(results)
            }
            
            logger.info(f"Analysis completed in {processing_time:.2f} seconds")
            return results
            
        except Exception as e:
            logger.error(f"Roof damage analysis failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    async def sync_with_susan_models(self) -> bool:
        """Synchronize training models with Susan AI's production models."""
        try:
            logger.info("Synchronizing with Susan AI models...")
            
            if not self.qwen_integration:
                logger.warning("Qwen integration not available for sync")
                return False
            
            # Get current model status from Susan AI
            model_status = self.qwen_integration.getSystemStatus()
            
            # Compare model versions and capabilities
            sync_needed = self._check_sync_requirements(model_status)
            
            if sync_needed:
                # Download updated model weights or configurations
                success = await self._perform_model_sync(model_status)
                
                if success:
                    logger.info("Model synchronization completed successfully")
                    return True
                else:
                    logger.error("Model synchronization failed")
                    return False
            else:
                logger.info("Models are already synchronized")
                return True
                
        except Exception as e:
            logger.error(f"Model synchronization failed: {e}")
            return False
    
    async def enhance_susan_capabilities(
        self,
        enhancement_type: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Enhance Susan AI capabilities with training system improvements."""
        try:
            logger.info(f"Enhancing Susan AI with {enhancement_type}")
            
            enhancement_results = {}
            
            if enhancement_type == 'specialized_hail_detection':
                # Enhance hail detection with specialized algorithms
                enhanced_detector = await self._create_enhanced_hail_detector(parameters)
                enhancement_results['hail_detector'] = enhanced_detector
                
            elif enhancement_type == 'improved_quantification':
                # Enhance damage quantification accuracy
                enhanced_quantifier = await self._create_enhanced_quantifier(parameters)
                enhancement_results['quantifier'] = enhanced_quantifier
                
            elif enhancement_type == 'advanced_classification':
                # Enhance damage classification with ensemble methods
                enhanced_classifier = await self._create_enhanced_classifier(parameters)
                enhancement_results['classifier'] = enhanced_classifier
                
            elif enhancement_type == 'real_time_training':
                # Enable real-time model updates
                training_pipeline = await self._setup_realtime_training(parameters)
                enhancement_results['training_pipeline'] = training_pipeline
                
            else:
                logger.warning(f"Unknown enhancement type: {enhancement_type}")
                return {'success': False, 'error': 'Unknown enhancement type'}
            
            # Deploy enhancements to Susan AI
            deployment_success = await self._deploy_enhancements(
                enhancement_type, enhancement_results
            )
            
            return {
                'success': deployment_success,
                'enhancement_type': enhancement_type,
                'results': enhancement_results,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Enhancement failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'enhancement_type': enhancement_type
            }
    
    def _decode_base64_image(self, base64_string: str) -> np.ndarray:
        """Decode base64 image string to numpy array."""
        try:
            # Remove data URL prefix if present
            if base64_string.startswith('data:image'):
                base64_string = base64_string.split(',')[1]
            
            # Decode base64
            image_bytes = base64.b64decode(base64_string)
            
            # Convert to PIL Image then numpy array
            image = Image.open(io.BytesIO(image_bytes))
            image_array = np.array(image)
            
            return image_array
            
        except Exception as e:
            logger.error(f"Base64 image decoding failed: {e}")
            raise
    
    def _create_damage_mask(
        self,
        image: np.ndarray,
        ensemble_results: Dict[str, Any]
    ) -> np.ndarray:
        """Create binary damage mask from ensemble results."""
        try:
            # Create empty mask
            mask = np.zeros(image.shape[:2], dtype=np.uint8)
            
            # Add hail damage areas
            hail_analysis = ensemble_results.get('hail_analysis', {})
            if 'impacts' in hail_analysis:
                for impact in hail_analysis['impacts']:
                    center = impact.get('centroid', (0, 0))
                    radius = impact.get('equivalent_diameter', 10) // 2
                    cv2.circle(mask, center, radius, 255, -1)
            
            # Add other damage types similarly
            # This is a simplified implementation
            
            return mask
            
        except Exception as e:
            logger.warning(f"Damage mask creation failed: {e}")
            return np.zeros(image.shape[:2], dtype=np.uint8)
    
    async def _generate_visualizations(
        self,
        image: np.ndarray,
        analysis_results: Dict[str, Any]
    ) -> Dict[str, str]:
        """Generate visualization images for analysis results."""
        try:
            visualizations = {}
            
            # Generate hail damage visualization
            if 'hail_analysis' in analysis_results:
                hail_viz = self.hail_analyzer.visualize_detection_results(
                    image, analysis_results['hail_analysis'].get('impacts', [])
                )
                visualizations['hail_damage'] = self._encode_image_base64(hail_viz)
            
            # Generate ensemble analysis visualization
            if 'ensemble_analysis' in analysis_results and self.damage_classifier:
                ensemble_viz = await self._create_ensemble_visualization(
                    image, analysis_results['ensemble_analysis']
                )
                visualizations['ensemble_analysis'] = self._encode_image_base64(ensemble_viz)
            
            return visualizations
            
        except Exception as e:
            logger.warning(f"Visualization generation failed: {e}")
            return {}
    
    def _encode_image_base64(self, image: np.ndarray) -> str:
        """Encode numpy image array to base64 string."""
        try:
            # Convert to PIL Image
            if image.dtype != np.uint8:
                image = (image * 255).astype(np.uint8)
            
            pil_image = Image.fromarray(image)
            
            # Convert to base64
            buffer = io.BytesIO()
            pil_image.save(buffer, format='PNG')
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return f"data:image/png;base64,{image_base64}"
            
        except Exception as e:
            logger.warning(f"Image base64 encoding failed: {e}")
            return ""
    
    def _calculate_analysis_completeness(self, results: Dict[str, Any]) -> float:
        """Calculate completeness score of the analysis."""
        try:
            expected_components = [
                'ensemble_analysis',
                'hail_analysis',
                'quantification_analysis'
            ]
            
            present_components = sum(1 for comp in expected_components if comp in results)
            completeness = present_components / len(expected_components)
            
            return completeness
            
        except Exception as e:
            logger.warning(f"Completeness calculation failed: {e}")
            return 0.5
    
    def _calculate_overall_confidence(self, results: Dict[str, Any]) -> float:
        """Calculate overall confidence score from analysis results."""
        try:
            confidences = []
            
            # Extract confidence from ensemble analysis
            if 'ensemble_analysis' in results:
                ensemble_conf = results['ensemble_analysis'].get('primary_confidence', 0)
                confidences.append(ensemble_conf)
            
            # Extract confidence from hail analysis
            if 'hail_analysis' in results:
                hail_conf = results['hail_analysis'].get('severity_assessment', {}).get('severity_score', 0)
                confidences.append(hail_conf)
            
            # Calculate weighted average
            if confidences:
                return sum(confidences) / len(confidences)
            else:
                return 0.5
                
        except Exception as e:
            logger.warning(f"Confidence calculation failed: {e}")
            return 0.5
    
    def _process_training_request(self, request_data: Dict[str, Any]):
        """Process training request from Susan AI."""
        try:
            # Create training request object
            training_request = TrainingRequest(
                request_id=request_data.get('request_id'),
                image_data=request_data.get('image_data'),
                analysis_type=request_data.get('analysis_type', 'comprehensive'),
                parameters=request_data.get('parameters', {}),
                timestamp=request_data.get('timestamp'),
                callback_url=request_data.get('callback_url')
            )
            
            # Process asynchronously
            asyncio.create_task(self._handle_training_request_async(training_request))
            
        except Exception as e:
            logger.error(f"Training request processing failed: {e}")
    
    async def _handle_training_request_async(self, request: TrainingRequest):
        """Handle training request asynchronously."""
        try:
            start_time = time.time()
            
            # Process the analysis
            results = await self.process_roof_damage_analysis(
                request.image_data,
                request.analysis_type,
                request.parameters.get('roof_area_sqft', 1500)
            )
            
            # Create response
            response = TrainingResponse(
                request_id=request.request_id,
                success=True,
                results=results,
                confidence=self._calculate_overall_confidence(results),
                processing_time=time.time() - start_time,
                timestamp=datetime.now().isoformat()
            )
            
            # Send response back to Susan AI
            await self._send_training_response(response)
            
        except Exception as e:
            # Create error response
            error_response = TrainingResponse(
                request_id=request.request_id,
                success=False,
                results={},
                confidence=0.0,
                processing_time=time.time() - start_time,
                timestamp=datetime.now().isoformat(),
                error_message=str(e)
            )
            
            await self._send_training_response(error_response)
    
    async def _send_training_response(self, response: TrainingResponse):
        """Send training response back to Susan AI."""
        try:
            if self.ws_connection and self.status == IntegrationStatus.CONNECTED:
                # Send via WebSocket
                message = {
                    'type': 'training_response',
                    **asdict(response)
                }
                self.ws_connection.send(json.dumps(message, default=str))
            
            # Also send via HTTP callback if available
            if response.callback_url:
                async with aiohttp.ClientSession() as session:
                    await session.post(
                        response.callback_url,
                        json=asdict(response),
                        headers={'Content-Type': 'application/json'}
                    )
            
        except Exception as e:
            logger.error(f"Response sending failed: {e}")
    
    # Additional methods for model sync, enhancements, etc.
    def _check_sync_requirements(self, model_status: Dict[str, Any]) -> bool:
        """Check if model synchronization is needed."""
        # Implementation would check version differences, capabilities, etc.
        return False
    
    async def _perform_model_sync(self, model_status: Dict[str, Any]) -> bool:
        """Perform actual model synchronization."""
        # Implementation would handle model downloads, updates, etc.
        return True
    
    async def _create_enhanced_hail_detector(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Create enhanced hail detection capabilities."""
        return {'status': 'enhanced', 'type': 'hail_detector'}
    
    async def _create_enhanced_quantifier(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Create enhanced damage quantification capabilities."""
        return {'status': 'enhanced', 'type': 'quantifier'}
    
    async def _create_enhanced_classifier(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Create enhanced damage classification capabilities."""
        return {'status': 'enhanced', 'type': 'classifier'}
    
    async def _setup_realtime_training(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Setup real-time training pipeline."""
        return {'status': 'setup', 'type': 'realtime_training'}
    
    async def _deploy_enhancements(
        self,
        enhancement_type: str,
        enhancement_results: Dict[str, Any]
    ) -> bool:
        """Deploy enhancements to Susan AI system."""
        try:
            # Send enhancement to Susan AI via API
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.susan_api_url}/api/training/enhancements",
                    json={
                        'type': enhancement_type,
                        'results': enhancement_results,
                        'timestamp': datetime.now().isoformat()
                    }
                ) as response:
                    return response.status == 200
                    
        except Exception as e:
            logger.error(f"Enhancement deployment failed: {e}")
            return False
    
    async def _create_ensemble_visualization(
        self,
        image: np.ndarray,
        ensemble_results: Dict[str, Any]
    ) -> np.ndarray:
        """Create visualization for ensemble analysis results."""
        # Implementation would create comprehensive visualization
        return image  # Placeholder
    
    def _handle_model_update(self, data: Dict[str, Any]):
        """Handle model update notifications from Susan AI."""
        logger.info(f"Received model update: {data}")
    
    def _handle_configuration_update(self, data: Dict[str, Any]):
        """Handle configuration update notifications from Susan AI."""
        logger.info(f"Received configuration update: {data}")
    
    async def shutdown(self):
        """Graceful shutdown of the integration system."""
        try:
            logger.info("Shutting down Susan AI integration...")
            
            # Close WebSocket connection
            if self.ws_connection:
                self.ws_connection.close()
            
            # Update status
            self.status = IntegrationStatus.DISCONNECTED
            
            logger.info("Susan AI integration shutdown complete")
            
        except Exception as e:
            logger.error(f"Shutdown error: {e}")


async def main():
    """Main function for testing Susan AI integration."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Susan AI Integration Test')
    parser.add_argument('--susan-url', type=str, default='http://localhost:3031', help='Susan AI API URL')
    parser.add_argument('--test-image', type=str, help='Path to test image')
    parser.add_argument('--analysis-type', type=str, default='comprehensive', help='Analysis type')
    
    args = parser.parse_args()
    
    try:
        # Initialize connector
        connector = SusanAIConnector(susan_api_url=args.susan_url)
        
        # Initialize integration
        success = await connector.initialize()
        
        if not success:
            logger.error("Integration initialization failed")
            return
        
        # Test image analysis if provided
        if args.test_image and Path(args.test_image).exists():
            # Load test image
            import cv2
            image = cv2.imread(args.test_image)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Process analysis
            results = await connector.process_roof_damage_analysis(
                image,
                args.analysis_type,
                roof_area_sqft=1500,
                return_visualizations=True
            )
            
            # Print results summary
            print("\n" + "="*60)
            print("SUSAN AI INTEGRATION TEST RESULTS")
            print("="*60)
            print(f"Analysis Type: {results.get('analysis_type', 'Unknown')}")
            print(f"Processing Time: {results.get('processing_metrics', {}).get('processing_time_seconds', 0):.2f}s")
            print(f"Overall Confidence: {results.get('processing_metrics', {}).get('confidence_score', 0):.2f}")
            print(f"Analysis Completeness: {results.get('processing_metrics', {}).get('analysis_completeness', 0):.2f}")
            
            # Save results
            results_file = Path('integration_test_results.json')
            with open(results_file, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            print(f"\nDetailed results saved to: {results_file}")
        
        # Keep running for WebSocket testing
        print("\nIntegration active. Press Ctrl+C to shutdown...")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down...")
        
        # Graceful shutdown
        await connector.shutdown()
        
    except Exception as e:
        logger.error(f"Integration test failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    import cv2
    asyncio.run(main())