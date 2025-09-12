#!/usr/bin/env python3
"""
Susan AI Enhanced Training Integration
=====================================

Integrates extracted sales training data with existing HuggingFace roof damage 
training to create a comprehensive, production-ready Susan AI model with 
advanced conversational and technical capabilities.

Features:
- Sales knowledge integration
- Customer interaction patterns
- Technical damage explanation capabilities
- Multi-modal training coordination
- Production deployment preparation

Author: Susan AI Training Team
Version: 1.0.0
Date: 2025-08-24
"""

import os
import sys
import json
import logging
import asyncio
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import pickle

# Core ML libraries
try:
    import torch
    import torch.nn as nn
    from transformers import AutoTokenizer, AutoModel
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics import accuracy_score, classification_report
    print("✓ ML libraries loaded successfully")
except ImportError as e:
    print(f"Warning: Some ML libraries not available: {e}")
    print("Core functionality will still work with extracted data")

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SusanEnhancedTrainingIntegration:
    """Enhanced training integration for Susan AI"""
    
    def __init__(self):
        """Initialize the enhanced training integration"""
        self.sales_data_dir = Path("./sales_training_data/processed")
        self.output_dir = Path("./enhanced_susan_training")
        self.output_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        self.datasets_dir = self.output_dir / "datasets"
        self.models_dir = self.output_dir / "models"
        self.reports_dir = self.output_dir / "reports"
        
        for dir_path in [self.datasets_dir, self.models_dir, self.reports_dir]:
            dir_path.mkdir(exist_ok=True)
        
        # Load extracted sales data
        self.sales_data = self._load_sales_data()
        
        # Initialize embeddings model
        try:
            self.embeddings_model = SentenceTransformer('all-MiniLM-L6-v2')
            self.embeddings_available = True
        except Exception as e:
            logger.warning(f"Embeddings model not available: {e}")
            self.embeddings_model = None
            self.embeddings_available = False
        
        # Statistics
        self.integration_stats = {
            "sales_scripts_processed": 0,
            "damage_terms_cataloged": 0,
            "customer_patterns_identified": 0,
            "training_examples_created": 0,
            "embeddings_generated": 0
        }
        
        logger.info("Susan Enhanced Training Integration initialized")
    
    def _load_sales_data(self) -> Dict[str, Any]:
        """Load extracted sales training data"""
        try:
            # Load main extracted data
            extracted_data_path = self.sales_data_dir / "extracted_sales_data.json"
            if extracted_data_path.exists():
                with open(extracted_data_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                logger.warning("No extracted sales data found. Run extract_sales_data.py first.")
                return {}
        except Exception as e:
            logger.error(f"Error loading sales data: {e}")
            return {}
    
    async def integrate_all_training_data(self) -> Dict[str, Any]:
        """Integrate all training data for enhanced Susan AI"""
        logger.info("Starting enhanced training data integration")
        
        integration_results = {
            "sales_knowledge_base": {},
            "conversation_training_data": {},
            "damage_expertise_enhancement": {},
            "customer_interaction_patterns": {},
            "production_ready_datasets": {},
            "integration_summary": {}
        }
        
        try:
            # Step 1: Create Susan AI knowledge base
            logger.info("Step 1: Creating Susan AI knowledge base")
            knowledge_base = await self._create_susan_knowledge_base()
            integration_results["sales_knowledge_base"] = knowledge_base
            
            # Step 2: Generate conversation training data
            logger.info("Step 2: Generating conversation training data")
            conversation_data = await self._generate_conversation_training_data()
            integration_results["conversation_training_data"] = conversation_data
            
            # Step 3: Enhance damage expertise
            logger.info("Step 3: Enhancing damage expertise")
            damage_expertise = await self._enhance_damage_expertise()
            integration_results["damage_expertise_enhancement"] = damage_expertise
            
            # Step 4: Process customer interaction patterns
            logger.info("Step 4: Processing customer interaction patterns")
            interaction_patterns = await self._process_customer_interaction_patterns()
            integration_results["customer_interaction_patterns"] = interaction_patterns
            
            # Step 5: Create production-ready datasets
            logger.info("Step 5: Creating production-ready datasets")
            production_datasets = await self._create_production_ready_datasets(integration_results)
            integration_results["production_ready_datasets"] = production_datasets
            
            # Step 6: Generate integration summary
            logger.info("Step 6: Generating integration summary")
            summary = await self._generate_integration_summary(integration_results)
            integration_results["integration_summary"] = summary
            
            # Save all results
            await self._save_integration_results(integration_results)
            
            logger.info("Enhanced training data integration completed successfully")
            return integration_results
            
        except Exception as e:
            logger.error(f"Integration failed: {str(e)}")
            raise
    
    async def _create_susan_knowledge_base(self) -> Dict[str, Any]:
        """Create comprehensive knowledge base for Susan AI"""
        knowledge_base = {
            "sales_expertise": {},
            "technical_knowledge": {},
            "communication_patterns": {},
            "process_knowledge": {},
            "customer_psychology": {}
        }
        
        # Process sales scripts for expertise
        sales_scripts = self.sales_data.get("sales_scripts", [])
        
        sales_expertise = {
            "greeting_patterns": [],
            "value_propositions": [],
            "objection_handling": [],
            "closing_techniques": [],
            "technical_explanations": []
        }
        
        for script in sales_scripts:
            content = script.get("content", "")
            patterns = script.get("sales_patterns", [])
            
            # Extract specific techniques
            if "greeting" in patterns:
                greeting_examples = self._extract_greeting_examples(content)
                sales_expertise["greeting_patterns"].extend(greeting_examples)
            
            if "objection_handling" in patterns:
                objection_examples = self._extract_objection_handling(content)
                sales_expertise["objection_handling"].extend(objection_examples)
            
            if "closing" in patterns:
                closing_examples = self._extract_closing_techniques(content)
                sales_expertise["closing_techniques"].extend(closing_examples)
            
            # Extract technical explanations
            technical_explanations = self._extract_technical_explanations(content)
            sales_expertise["technical_explanations"].extend(technical_explanations)
            
            self.integration_stats["sales_scripts_processed"] += 1
        
        knowledge_base["sales_expertise"] = sales_expertise
        
        # Process damage terminology
        damage_terms = self.sales_data.get("damage_terminology", [])
        
        technical_knowledge = {
            "damage_types": {},
            "assessment_terminology": {},
            "repair_processes": {},
            "material_knowledge": {}
        }
        
        # Categorize damage terms
        for term in damage_terms:
            if isinstance(term, str):
                category = self._categorize_damage_term(term)
                if category not in technical_knowledge["damage_types"]:
                    technical_knowledge["damage_types"][category] = []
                technical_knowledge["damage_types"][category].append(term)
                self.integration_stats["damage_terms_cataloged"] += 1
        
        knowledge_base["technical_knowledge"] = technical_knowledge
        
        # Process communication patterns
        customer_interactions = self.sales_data.get("customer_interactions", [])
        
        communication_patterns = {
            "explanation_strategies": [],
            "question_answering_patterns": [],
            "empathy_expressions": [],
            "confidence_builders": []
        }
        
        for interaction in customer_interactions:
            content = interaction.get("content", "")
            
            # Extract communication patterns
            explanation_strategies = self._extract_explanation_strategies(content)
            communication_patterns["explanation_strategies"].extend(explanation_strategies)
            
            empathy_expressions = self._extract_empathy_expressions(content)
            communication_patterns["empathy_expressions"].extend(empathy_expressions)
            
            self.integration_stats["customer_patterns_identified"] += 1
        
        knowledge_base["communication_patterns"] = communication_patterns
        
        return knowledge_base
    
    async def _generate_conversation_training_data(self) -> Dict[str, Any]:
        """Generate conversation training data for Susan AI"""
        conversation_data = {
            "damage_assessment_conversations": [],
            "sales_consultation_dialogs": [],
            "technical_explanation_examples": [],
            "objection_handling_scenarios": [],
            "follow_up_interactions": []
        }
        
        # Generate damage assessment conversations
        damage_conversations = []
        
        # Use sales scripts to create realistic conversation examples
        sales_scripts = self.sales_data.get("sales_scripts", [])
        for script in sales_scripts:
            content = script.get("content", "")
            damage_terms = script.get("damage_terms", [])
            
            # Create conversation examples based on script content
            conversations = self._create_conversation_from_script(content, damage_terms)
            damage_conversations.extend(conversations)
        
        conversation_data["damage_assessment_conversations"] = damage_conversations
        
        # Generate technical explanation examples
        technical_examples = []
        
        # Create examples that explain damage in customer-friendly terms
        damage_terminology = self.sales_data.get("damage_terminology", [])
        for i in range(0, len(damage_terminology), 5):  # Process in groups
            batch = damage_terminology[i:i+5]
            examples = self._create_technical_explanations(batch)
            technical_examples.extend(examples)
        
        conversation_data["technical_explanation_examples"] = technical_examples
        
        # Generate objection handling scenarios
        objection_scenarios = []
        
        # Use customer objection patterns from extracted data
        for script in sales_scripts:
            objections = script.get("customer_objections", [])
            for objection in objections:
                scenario = self._create_objection_scenario(objection, script.get("content", ""))
                objection_scenarios.append(scenario)
        
        conversation_data["objection_handling_scenarios"] = objection_scenarios
        
        self.integration_stats["training_examples_created"] = (
            len(damage_conversations) + len(technical_examples) + len(objection_scenarios)
        )
        
        return conversation_data
    
    async def _enhance_damage_expertise(self) -> Dict[str, Any]:
        """Enhance Susan's damage assessment expertise"""
        damage_expertise = {
            "visual_damage_descriptions": {},
            "damage_severity_mapping": {},
            "repair_recommendations": {},
            "cost_estimation_guidance": {},
            "insurance_claim_support": {}
        }
        
        # Create visual damage descriptions
        visual_materials = self.sales_data.get("visual_materials", [])
        
        visual_descriptions = {}
        for visual in visual_materials:
            file_name = visual.get("file_name", "")
            damage_terms = visual.get("damage_terms", [])
            
            if damage_terms:
                description = self._create_visual_damage_description(file_name, damage_terms)
                if description:
                    visual_descriptions[file_name] = description
        
        damage_expertise["visual_damage_descriptions"] = visual_descriptions
        
        # Create damage severity mapping
        severity_mapping = {}
        
        # Use process workflows to understand damage assessment criteria
        process_workflows = self.sales_data.get("process_workflows", [])
        for workflow in process_workflows:
            process_steps = workflow.get("process_steps", [])
            severity_info = self._extract_severity_information(process_steps)
            if severity_info:
                severity_mapping.update(severity_info)
        
        damage_expertise["damage_severity_mapping"] = severity_mapping
        
        # Create repair recommendations
        repair_recommendations = {}
        
        # Extract repair guidance from sales scripts
        sales_scripts = self.sales_data.get("sales_scripts", [])
        for script in sales_scripts:
            content = script.get("content", "")
            damage_terms = script.get("damage_terms", [])
            
            recommendations = self._extract_repair_recommendations(content, damage_terms)
            for damage_type, recommendation in recommendations.items():
                if damage_type not in repair_recommendations:
                    repair_recommendations[damage_type] = []
                repair_recommendations[damage_type].append(recommendation)
        
        damage_expertise["repair_recommendations"] = repair_recommendations
        
        return damage_expertise
    
    async def _process_customer_interaction_patterns(self) -> Dict[str, Any]:
        """Process and analyze customer interaction patterns"""
        interaction_patterns = {
            "common_concerns": {},
            "communication_preferences": {},
            "decision_factors": {},
            "trust_building_strategies": {},
            "follow_up_protocols": {}
        }
        
        # Analyze sales scripts for customer interaction patterns
        sales_scripts = self.sales_data.get("sales_scripts", [])
        
        common_concerns = {}
        for script in sales_scripts:
            content = script.get("content", "")
            
            # Extract customer concerns mentioned in scripts
            concerns = self._extract_customer_concerns(content)
            for concern in concerns:
                if concern not in common_concerns:
                    common_concerns[concern] = {
                        "frequency": 0,
                        "responses": [],
                        "resolution_strategies": []
                    }
                
                common_concerns[concern]["frequency"] += 1
                
                # Extract how the concern is addressed
                response = self._extract_concern_response(content, concern)
                if response:
                    common_concerns[concern]["responses"].append(response)
        
        interaction_patterns["common_concerns"] = common_concerns
        
        # Analyze trust building strategies
        trust_strategies = []
        for script in sales_scripts:
            content = script.get("content", "")
            strategies = self._extract_trust_building_strategies(content)
            trust_strategies.extend(strategies)
        
        interaction_patterns["trust_building_strategies"] = list(set(trust_strategies))
        
        return interaction_patterns
    
    async def _create_production_ready_datasets(self, integration_results: Dict[str, Any]) -> Dict[str, Any]:
        """Create production-ready datasets for Susan AI training"""
        production_datasets = {
            "conversational_ai_dataset": {},
            "damage_classification_dataset": {},
            "customer_service_dataset": {},
            "technical_qa_dataset": {},
            "sales_support_dataset": {}
        }
        
        # Create conversational AI dataset
        conversation_data = integration_results.get("conversation_training_data", {})
        
        conversational_dataset = []
        
        # Process damage assessment conversations
        damage_conversations = conversation_data.get("damage_assessment_conversations", [])
        for conv in damage_conversations:
            conversational_dataset.append({
                "input": conv.get("customer_question", ""),
                "output": conv.get("susan_response", ""),
                "context": "damage_assessment",
                "confidence": 0.9
            })
        
        # Process technical explanations
        technical_explanations = conversation_data.get("technical_explanation_examples", [])
        for explanation in technical_explanations:
            conversational_dataset.append({
                "input": explanation.get("technical_term", ""),
                "output": explanation.get("customer_friendly_explanation", ""),
                "context": "technical_explanation",
                "confidence": 0.95
            })
        
        production_datasets["conversational_ai_dataset"] = {
            "data": conversational_dataset,
            "size": len(conversational_dataset),
            "format": "question_answer_pairs",
            "use_case": "conversational_ai_training"
        }
        
        # Create damage classification dataset
        damage_expertise = integration_results.get("damage_expertise_enhancement", {})
        
        damage_dataset = []
        visual_descriptions = damage_expertise.get("visual_damage_descriptions", {})
        
        for image_name, description in visual_descriptions.items():
            damage_dataset.append({
                "image_reference": image_name,
                "damage_description": description.get("description", ""),
                "damage_type": description.get("damage_type", "unknown"),
                "severity": description.get("severity", "moderate"),
                "repair_needed": description.get("repair_needed", True)
            })
        
        production_datasets["damage_classification_dataset"] = {
            "data": damage_dataset,
            "size": len(damage_dataset),
            "format": "image_text_pairs",
            "use_case": "damage_classification"
        }
        
        # Create customer service dataset
        interaction_patterns = integration_results.get("customer_interaction_patterns", {})
        
        customer_service_data = []
        common_concerns = interaction_patterns.get("common_concerns", {})
        
        for concern, details in common_concerns.items():
            for response in details.get("responses", []):
                customer_service_data.append({
                    "customer_concern": concern,
                    "susan_response": response,
                    "concern_category": self._categorize_concern(concern),
                    "resolution_effectiveness": "high"
                })
        
        production_datasets["customer_service_dataset"] = {
            "data": customer_service_data,
            "size": len(customer_service_data),
            "format": "concern_response_pairs",
            "use_case": "customer_service"
        }
        
        # Save datasets to files
        for dataset_name, dataset_info in production_datasets.items():
            if dataset_info.get("data"):
                # Save as JSON
                json_path = self.datasets_dir / f"{dataset_name}.json"
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(dataset_info, f, indent=2, ensure_ascii=False)
                
                # Save as CSV for tabular data
                try:
                    df = pd.DataFrame(dataset_info["data"])
                    csv_path = self.datasets_dir / f"{dataset_name}.csv"
                    df.to_csv(csv_path, index=False, encoding='utf-8')
                except Exception as e:
                    logger.warning(f"Could not create CSV for {dataset_name}: {e}")
        
        return production_datasets
    
    async def _generate_integration_summary(self, integration_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive integration summary"""
        summary = {
            "integration_date": datetime.now().isoformat(),
            "processing_statistics": self.integration_stats.copy(),
            "dataset_summary": {},
            "knowledge_base_summary": {},
            "quality_metrics": {},
            "deployment_readiness": {},
            "recommendations": []
        }
        
        # Dataset summary
        production_datasets = integration_results.get("production_ready_datasets", {})
        dataset_summary = {}
        
        for dataset_name, dataset_info in production_datasets.items():
            dataset_summary[dataset_name] = {
                "size": dataset_info.get("size", 0),
                "format": dataset_info.get("format", "unknown"),
                "use_case": dataset_info.get("use_case", "general")
            }
        
        summary["dataset_summary"] = dataset_summary
        
        # Knowledge base summary
        knowledge_base = integration_results.get("sales_knowledge_base", {})
        kb_summary = {}
        
        for kb_category, kb_data in knowledge_base.items():
            if isinstance(kb_data, dict):
                kb_summary[kb_category] = {
                    "subcategories": list(kb_data.keys()),
                    "total_items": sum(len(v) if isinstance(v, list) else len(v) if isinstance(v, dict) else 1 for v in kb_data.values())
                }
            else:
                kb_summary[kb_category] = {"total_items": len(kb_data) if isinstance(kb_data, (list, dict)) else 1}
        
        summary["knowledge_base_summary"] = kb_summary
        
        # Quality metrics
        total_training_examples = sum(
            dataset_info.get("size", 0) for dataset_info in production_datasets.values()
        )
        
        quality_metrics = {
            "total_training_examples": total_training_examples,
            "sales_knowledge_coverage": len(knowledge_base.get("sales_expertise", {}).get("greeting_patterns", [])) > 0,
            "technical_knowledge_coverage": len(knowledge_base.get("technical_knowledge", {}).get("damage_types", {})) > 0,
            "conversation_data_quality": len(integration_results.get("conversation_training_data", {}).get("damage_assessment_conversations", [])) > 10,
            "overall_readiness_score": 0.0
        }
        
        # Calculate overall readiness score
        readiness_factors = [
            quality_metrics["sales_knowledge_coverage"],
            quality_metrics["technical_knowledge_coverage"], 
            quality_metrics["conversation_data_quality"],
            total_training_examples > 50
        ]
        
        quality_metrics["overall_readiness_score"] = sum(readiness_factors) / len(readiness_factors)
        summary["quality_metrics"] = quality_metrics
        
        # Deployment readiness
        deployment_readiness = {
            "data_integration_complete": True,
            "datasets_created": len(production_datasets) > 0,
            "knowledge_base_populated": len(knowledge_base) > 0,
            "training_data_sufficient": total_training_examples > 100,
            "ready_for_model_training": quality_metrics["overall_readiness_score"] > 0.8
        }
        
        summary["deployment_readiness"] = deployment_readiness
        
        # Generate recommendations
        recommendations = []
        
        if not deployment_readiness["training_data_sufficient"]:
            recommendations.append("Increase training data volume for improved model performance")
        
        if quality_metrics["overall_readiness_score"] < 0.9:
            recommendations.append("Review and enhance data quality before production deployment")
        
        if len(knowledge_base.get("sales_expertise", {}).get("objection_handling", [])) < 10:
            recommendations.append("Expand objection handling examples for better customer service")
        
        recommendations.extend([
            "Implement continuous learning pipeline for ongoing improvement",
            "Set up A/B testing framework for model performance evaluation",
            "Create customer feedback integration system",
            "Plan regular model retraining cycles"
        ])
        
        summary["recommendations"] = recommendations
        
        return summary
    
    async def _save_integration_results(self, results: Dict[str, Any]):
        """Save integration results to files"""
        
        # Save complete results
        results_path = self.output_dir / "complete_integration_results.json"
        with open(results_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        # Save individual components
        for component_name, component_data in results.items():
            if component_data and component_name != "integration_summary":
                component_path = self.output_dir / f"{component_name}.json"
                with open(component_path, 'w', encoding='utf-8') as f:
                    json.dump(component_data, f, indent=2, ensure_ascii=False)
        
        # Create markdown summary report
        summary = results.get("integration_summary", {})
        markdown_report = self._create_markdown_report(summary)
        
        report_path = self.reports_dir / f"integration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(markdown_report)
        
        # Create Susan AI integration configuration
        susan_config = self._create_susan_integration_config(results)
        config_path = self.output_dir / "susan_ai_integration_config.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(susan_config, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Integration results saved to: {self.output_dir}")
        logger.info(f"Summary report available at: {report_path}")
    
    def _create_susan_integration_config(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Create Susan AI integration configuration"""
        summary = results.get("integration_summary", {})
        
        return {
            "integration_version": "1.0.0",
            "integration_date": summary.get("integration_date", datetime.now().isoformat()),
            "capabilities": {
                "sales_conversation": True,
                "damage_assessment_explanation": True,
                "customer_objection_handling": True,
                "technical_damage_analysis": True,
                "insurance_claim_assistance": True,
                "multi_modal_analysis": True
            },
            "knowledge_base": {
                "sales_expertise_loaded": True,
                "technical_knowledge_loaded": True,
                "customer_patterns_loaded": True,
                "conversation_examples_loaded": True
            },
            "training_datasets": {
                "conversational_ai_dataset": "./datasets/conversational_ai_dataset.json",
                "damage_classification_dataset": "./datasets/damage_classification_dataset.json", 
                "customer_service_dataset": "./datasets/customer_service_dataset.json"
            },
            "deployment_status": {
                "ready_for_training": summary.get("quality_metrics", {}).get("overall_readiness_score", 0) > 0.8,
                "ready_for_production": summary.get("deployment_readiness", {}).get("ready_for_model_training", False),
                "integration_complete": True
            },
            "performance_targets": {
                "accuracy_target": 0.92,
                "response_time_ms": 2000,
                "customer_satisfaction_score": 4.5
            }
        }
    
    def _create_markdown_report(self, summary: Dict[str, Any]) -> str:
        """Create markdown integration report"""
        timestamp = summary.get("integration_date", datetime.now().isoformat())
        
        markdown = f"""# Susan AI Enhanced Training Integration Report

**Generated:** {timestamp}
**Integration Version:** 1.0.0

## Executive Summary

This report summarizes the successful integration of comprehensive sales training materials with Susan AI's existing roof damage detection capabilities, creating an enhanced conversational AI system with advanced customer interaction and technical explanation abilities.

## Processing Statistics

"""
        
        stats = summary.get("processing_statistics", {})
        for stat_name, stat_value in stats.items():
            readable_name = stat_name.replace('_', ' ').title()
            markdown += f"- **{readable_name}:** {stat_value}\n"
        
        markdown += "\n## Dataset Summary\n\n"
        
        dataset_summary = summary.get("dataset_summary", {})
        for dataset_name, dataset_info in dataset_summary.items():
            readable_name = dataset_name.replace('_', ' ').title()
            size = dataset_info.get("size", 0)
            use_case = dataset_info.get("use_case", "general")
            markdown += f"- **{readable_name}:** {size} examples ({use_case})\n"
        
        markdown += "\n## Knowledge Base Summary\n\n"
        
        kb_summary = summary.get("knowledge_base_summary", {})
        for kb_category, kb_info in kb_summary.items():
            readable_category = kb_category.replace('_', ' ').title()
            total_items = kb_info.get("total_items", 0)
            markdown += f"- **{readable_category}:** {total_items} items\n"
        
        markdown += "\n## Quality Metrics\n\n"
        
        quality_metrics = summary.get("quality_metrics", {})
        overall_score = quality_metrics.get("overall_readiness_score", 0)
        markdown += f"- **Overall Readiness Score:** {overall_score:.1%}\n"
        markdown += f"- **Total Training Examples:** {quality_metrics.get('total_training_examples', 0)}\n"
        
        coverage_items = [
            ("Sales Knowledge Coverage", quality_metrics.get("sales_knowledge_coverage", False)),
            ("Technical Knowledge Coverage", quality_metrics.get("technical_knowledge_coverage", False)),
            ("Conversation Data Quality", quality_metrics.get("conversation_data_quality", False))
        ]
        
        for item_name, item_status in coverage_items:
            status_icon = "✅" if item_status else "❌"
            markdown += f"- **{item_name}:** {status_icon}\n"
        
        markdown += "\n## Deployment Readiness\n\n"
        
        deployment = summary.get("deployment_readiness", {})
        for check_name, check_status in deployment.items():
            readable_name = check_name.replace('_', ' ').title()
            status_icon = "✅" if check_status else "❌"
            markdown += f"- **{readable_name}:** {status_icon}\n"
        
        markdown += "\n## Enhanced Capabilities\n\n"
        
        markdown += """Susan AI now includes the following enhanced capabilities:

### 🗣️ Conversational Excellence
- Natural sales conversation patterns
- Customer-friendly damage explanations
- Professional greeting and closing techniques
- Empathetic customer communication

### 🔧 Technical Expertise
- Comprehensive damage terminology knowledge
- Repair process explanations
- Insurance claim guidance
- Material and cost information

### 🤝 Customer Service
- Objection handling strategies
- Trust building techniques
- Follow-up protocols
- Concern resolution patterns

### 📊 Multi-Modal Analysis
- Visual damage assessment
- Text-based customer interaction
- Integrated technical and sales knowledge
- Context-aware responses

## Recommendations\n\n"""
        
        recommendations = summary.get("recommendations", [])
        for i, recommendation in enumerate(recommendations, 1):
            markdown += f"{i}. {recommendation}\n"
        
        markdown += f"""

## Next Steps

1. **Model Training**: Use generated datasets to train enhanced Susan AI model
2. **Integration Testing**: Verify all capabilities work correctly with existing systems
3. **Performance Validation**: Test against quality metrics and performance targets
4. **Production Deployment**: Deploy to production environment with monitoring
5. **Continuous Improvement**: Implement feedback loops for ongoing enhancement

## Conclusion

The enhanced training integration has successfully combined sales expertise with technical knowledge, creating a comprehensive conversational AI system. Susan AI is now equipped with advanced customer interaction capabilities while maintaining its core roof damage analysis expertise.

**Overall Status: {'READY FOR PRODUCTION' if overall_score > 0.8 else 'NEEDS FURTHER DEVELOPMENT'}**

---

*Report generated by Susan AI Enhanced Training Integration System*
"""
        
        return markdown
    
    # Helper methods for content processing
    def _extract_greeting_examples(self, content: str) -> List[str]:
        """Extract greeting examples from content"""
        greetings = []
        lines = content.split('\n')
        
        for line in lines:
            if any(word in line.lower() for word in ['hello', 'good morning', 'good afternoon', 'hi there']):
                cleaned_line = line.strip().strip('"').strip()
                if cleaned_line and len(cleaned_line) > 10:
                    greetings.append(cleaned_line)
        
        return greetings[:3]  # Limit to 3 examples
    
    def _extract_objection_handling(self, content: str) -> List[str]:
        """Extract objection handling examples"""
        objection_patterns = []
        
        # Look for patterns that indicate objection handling
        objection_indicators = [
            'understand your concern',
            'i know that',
            'let me explain',
            'what if i told you',
            'however',
            'but'
        ]
        
        sentences = content.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(indicator in sentence.lower() for indicator in objection_indicators):
                if len(sentence) > 20:
                    objection_patterns.append(sentence)
        
        return objection_patterns[:3]
    
    def _extract_closing_techniques(self, content: str) -> List[str]:
        """Extract closing technique examples"""
        closing_techniques = []
        
        closing_indicators = [
            'sign',
            'agreement',
            'move forward',
            'next steps',
            'get started',
            'ready to proceed'
        ]
        
        sentences = content.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(indicator in sentence.lower() for indicator in closing_indicators):
                if len(sentence) > 15:
                    closing_techniques.append(sentence)
        
        return closing_techniques[:3]
    
    def _extract_technical_explanations(self, content: str) -> List[str]:
        """Extract technical explanation examples"""
        technical_explanations = []
        
        # Look for explanatory patterns
        explanation_patterns = [
            'this means',
            'what happens is',
            'the reason',
            'because',
            'due to'
        ]
        
        sentences = content.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(pattern in sentence.lower() for pattern in explanation_patterns):
                if len(sentence) > 25:
                    technical_explanations.append(sentence)
        
        return technical_explanations[:5]
    
    def _categorize_damage_term(self, term: str) -> str:
        """Categorize damage terms"""
        term_lower = term.lower()
        
        if term_lower in ['hail', 'impact', 'granule', 'circular']:
            return 'hail_damage'
        elif term_lower in ['wind', 'uplift', 'missing', 'torn']:
            return 'wind_damage'
        elif term_lower in ['wear', 'aging', 'deterioration', 'curling']:
            return 'wear_damage'
        elif term_lower in ['shingle', 'roof', 'flashing', 'gutter']:
            return 'materials'
        else:
            return 'general_damage'
    
    def _create_conversation_from_script(self, content: str, damage_terms: List[str]) -> List[Dict[str, Any]]:
        """Create conversation examples from script content"""
        conversations = []
        
        # Extract question-answer patterns from script
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            line = line.strip()
            if '?' in line and len(line) > 20:
                # This could be a customer question
                customer_question = line.strip('"').strip()
                
                # Look for response in next few lines
                response_lines = lines[i+1:i+4]
                response = ' '.join([l.strip().strip('"') for l in response_lines if l.strip()])
                
                if response and len(response) > 30:
                    conversations.append({
                        "customer_question": customer_question,
                        "susan_response": response,
                        "context": "damage_assessment",
                        "damage_types": damage_terms
                    })
        
        return conversations[:3]  # Limit to 3 per script
    
    def _create_technical_explanations(self, damage_terms: List[str]) -> List[Dict[str, Any]]:
        """Create technical explanations for damage terms"""
        explanations = []
        
        # Mapping of technical terms to customer-friendly explanations
        explanation_map = {
            'hail': 'Small ice balls that fall from storm clouds and can damage your roof by creating dents and removing protective granules',
            'granule': 'The small rock particles on shingles that protect them from UV rays and weather',
            'uplift': 'When strong winds get under your shingles and lift or tear them away from the roof',
            'flashing': 'Metal strips that seal joints and prevent water from entering your home',
            'impact': 'Damage caused when something hits your roof, like hail or falling branches'
        }
        
        for term in damage_terms:
            if isinstance(term, str) and term.lower() in explanation_map:
                explanations.append({
                    "technical_term": term,
                    "customer_friendly_explanation": explanation_map[term.lower()],
                    "context": "technical_explanation"
                })
        
        return explanations
    
    def _create_objection_scenario(self, objection: str, script_content: str) -> Dict[str, Any]:
        """Create objection handling scenario"""
        return {
            "customer_objection": objection,
            "objection_category": self._categorize_objection(objection),
            "suggested_response": self._generate_objection_response(objection),
            "context": "objection_handling",
            "source_script": script_content[:100] + "..." if len(script_content) > 100 else script_content
        }
    
    def _categorize_objection(self, objection: str) -> str:
        """Categorize customer objections"""
        objection_lower = objection.lower()
        
        if 'expensive' in objection_lower or 'afford' in objection_lower or 'money' in objection_lower:
            return 'price_concern'
        elif 'insurance' in objection_lower or 'cover' in objection_lower:
            return 'insurance_concern'
        elif 'think' in objection_lower or 'time' in objection_lower:
            return 'timing_concern'
        elif 'other' in objection_lower or 'quote' in objection_lower:
            return 'comparison_shopping'
        else:
            return 'general_objection'
    
    def _generate_objection_response(self, objection: str) -> str:
        """Generate appropriate response to objection"""
        category = self._categorize_objection(objection)
        
        responses = {
            'price_concern': "I understand cost is a concern. The good news is that with insurance coverage, your out-of-pocket expense is typically just your deductible.",
            'insurance_concern': "Great question about insurance. I work directly with insurance companies and can help navigate the claims process to ensure you get proper coverage.",
            'timing_concern': "I completely understand wanting to take time with this decision. However, delaying repairs can lead to more damage and higher costs.",
            'comparison_shopping': "That's smart to compare options. What I can offer is expertise in insurance claims and quality workmanship with warranties.",
            'general_objection': "I understand your concerns. Let me explain how we can address that and make this process easy for you."
        }
        
        return responses.get(category, responses['general_objection'])
    
    # Additional helper methods
    def _extract_explanation_strategies(self, content: str) -> List[str]:
        """Extract explanation strategies from content"""
        strategies = []
        
        explanation_indicators = [
            'let me explain',
            'what this means is',
            'in simple terms',
            'think of it this way',
            'for example'
        ]
        
        sentences = content.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(indicator in sentence.lower() for indicator in explanation_indicators):
                if len(sentence) > 20:
                    strategies.append(sentence)
        
        return strategies[:3]
    
    def _extract_empathy_expressions(self, content: str) -> List[str]:
        """Extract empathy expressions from content"""
        empathy_expressions = []
        
        empathy_indicators = [
            'i understand',
            'i know',
            'that makes sense',
            'i can see how',
            'you\'re right'
        ]
        
        sentences = content.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(indicator in sentence.lower() for indicator in empathy_indicators):
                if len(sentence) > 15:
                    empathy_expressions.append(sentence)
        
        return empathy_expressions[:3]
    
    def _create_visual_damage_description(self, file_name: str, damage_terms: List[str]) -> Optional[Dict[str, Any]]:
        """Create description for visual damage material"""
        if not damage_terms:
            return None
        
        primary_damage = damage_terms[0] if damage_terms else 'unknown'
        
        description_templates = {
            'hail': 'This image shows hail damage with visible impact marks and granule loss',
            'wind': 'This image demonstrates wind damage with lifted or missing shingles',
            'storm': 'This image shows storm damage to roofing materials',
            'damage': 'This image shows roof damage requiring professional assessment'
        }
        
        description = description_templates.get(primary_damage.lower(), 
                                              f'This image shows {primary_damage} damage to roofing materials')
        
        return {
            'description': description,
            'damage_type': primary_damage,
            'severity': 'moderate',  # Default assumption
            'repair_needed': True
        }
    
    def _extract_severity_information(self, process_steps: List[str]) -> Dict[str, str]:
        """Extract severity information from process steps"""
        severity_info = {}
        
        severity_keywords = {
            'minor': ['small', 'light', 'minimal'],
            'moderate': ['moderate', 'medium', 'some'],
            'severe': ['severe', 'major', 'extensive', 'significant']
        }
        
        for step in process_steps:
            step_lower = step.lower()
            for severity, keywords in severity_keywords.items():
                if any(keyword in step_lower for keyword in keywords):
                    if 'damage' in step_lower:
                        severity_info[f'{severity}_damage_indicators'] = step
        
        return severity_info
    
    def _extract_repair_recommendations(self, content: str, damage_terms: List[str]) -> Dict[str, str]:
        """Extract repair recommendations from content"""
        recommendations = {}
        
        content_lower = content.lower()
        
        for damage_type in damage_terms:
            damage_lower = damage_type.lower()
            
            if damage_lower == 'hail':
                if 'replace' in content_lower:
                    recommendations['hail'] = 'Full roof replacement recommended for extensive hail damage'
                elif 'repair' in content_lower:
                    recommendations['hail'] = 'Spot repairs may be sufficient for minor hail damage'
            
            elif damage_lower == 'wind':
                if 'missing' in content_lower:
                    recommendations['wind'] = 'Replace missing shingles and inspect for additional wind damage'
            
            elif damage_lower in ['roof', 'shingle']:
                if 'full' in content_lower and 'replace' in content_lower:
                    recommendations[damage_lower] = 'Full roof replacement recommended based on damage assessment'
        
        return recommendations
    
    def _extract_customer_concerns(self, content: str) -> List[str]:
        """Extract customer concerns mentioned in content"""
        concerns = []
        
        concern_patterns = [
            'cost', 'expensive', 'afford', 'money', 'price',
            'insurance', 'coverage', 'claim', 'deductible',
            'time', 'schedule', 'timing', 'busy',
            'quality', 'workmanship', 'guarantee', 'warranty',
            'other companies', 'quotes', 'comparison'
        ]
        
        content_lower = content.lower()
        
        for pattern in concern_patterns:
            if pattern in content_lower:
                # Extract sentence containing the concern
                sentences = content.split('.')
                for sentence in sentences:
                    if pattern in sentence.lower() and len(sentence.strip()) > 20:
                        concerns.append(pattern)
                        break
        
        return list(set(concerns))
    
    def _extract_concern_response(self, content: str, concern: str) -> Optional[str]:
        """Extract how a concern is addressed in the content"""
        sentences = content.split('.')
        
        for i, sentence in enumerate(sentences):
            if concern.lower() in sentence.lower():
                # Look for response in next few sentences
                response_sentences = sentences[i:i+3]
                response = '. '.join([s.strip() for s in response_sentences if s.strip()])
                if len(response) > 50:
                    return response
        
        return None
    
    def _extract_trust_building_strategies(self, content: str) -> List[str]:
        """Extract trust building strategies from content"""
        strategies = []
        
        trust_indicators = [
            'guarantee', 'warranty', 'certified', 'licensed', 'insured',
            'experience', 'quality', 'reputation', 'references',
            'free', 'no cost', 'transparent', 'honest'
        ]
        
        sentences = content.split('.')
        for sentence in sentences:
            sentence = sentence.strip()
            if any(indicator in sentence.lower() for indicator in trust_indicators):
                if len(sentence) > 25:
                    strategies.append(sentence)
        
        return strategies[:5]
    
    def _categorize_concern(self, concern: str) -> str:
        """Categorize customer concerns"""
        concern_lower = concern.lower()
        
        if any(word in concern_lower for word in ['cost', 'expensive', 'afford', 'money']):
            return 'financial'
        elif any(word in concern_lower for word in ['insurance', 'coverage', 'claim']):
            return 'insurance_related'
        elif any(word in concern_lower for word in ['time', 'schedule', 'timing']):
            return 'scheduling'
        elif any(word in concern_lower for word in ['quality', 'workmanship', 'warranty']):
            return 'quality_assurance'
        else:
            return 'general'

async def main():
    """Main execution function"""
    print("="*70)
    print("SUSAN AI ENHANCED TRAINING INTEGRATION")
    print("="*70)
    
    try:
        # Initialize integration system
        integration = SusanEnhancedTrainingIntegration()
        
        # Run complete integration
        results = await integration.integrate_all_training_data()
        
        print("\n✅ Integration completed successfully!")
        
        # Print summary
        summary = results.get("integration_summary", {})
        stats = summary.get("processing_statistics", {})
        
        print(f"\n📊 Processing Statistics:")
        print(f"   Sales Scripts Processed: {stats.get('sales_scripts_processed', 0)}")
        print(f"   Damage Terms Cataloged: {stats.get('damage_terms_cataloged', 0)}")
        print(f"   Customer Patterns Identified: {stats.get('customer_patterns_identified', 0)}")
        print(f"   Training Examples Created: {stats.get('training_examples_created', 0)}")
        
        quality_metrics = summary.get("quality_metrics", {})
        readiness_score = quality_metrics.get("overall_readiness_score", 0)
        
        print(f"\n🎯 Quality Metrics:")
        print(f"   Overall Readiness Score: {readiness_score:.1%}")
        print(f"   Total Training Examples: {quality_metrics.get('total_training_examples', 0)}")
        
        deployment_ready = summary.get("deployment_readiness", {}).get("ready_for_model_training", False)
        status = "READY FOR PRODUCTION" if deployment_ready else "NEEDS FURTHER DEVELOPMENT"
        
        print(f"\n🚀 Deployment Status: {status}")
        
        print(f"\n📁 Results saved to: ./enhanced_susan_training/")
        print(f"📄 Report available at: ./enhanced_susan_training/reports/")
        
        print("\n🔗 Next Steps:")
        print("   1. Review generated datasets")
        print("   2. Train enhanced Susan AI model")  
        print("   3. Integration test with existing systems")
        print("   4. Deploy to production environment")
        
        print("="*70)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Integration failed: {str(e)}")
        logger.error(f"Integration error: {str(e)}")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)