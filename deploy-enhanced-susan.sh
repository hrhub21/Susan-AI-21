#!/bin/bash

# Deploy Enhanced Susan AI - Red, Black & White Professional Theme
# With consolidated features and image rendering capabilities

echo "🚀 Deploying Enhanced Susan AI Professional Edition"
echo "=================================================="

# Backup current files
echo "📋 Creating backup of current files..."
cp public/index.html public/index-backup.html
cp public/susan-working.js public/susan-working-backup.js
cp public/susan-styles.css public/susan-styles-backup.css

# Deploy new enhanced files
echo "🎨 Deploying new professional design..."
cp public/index-new.html public/index.html
cp public/susan-working-new.js public/susan-working.js
cp public/susan-styles-new.css public/susan-styles.css

# Verify deployment
echo "✅ Enhanced Susan AI deployed successfully!"
echo ""
echo "🔧 New Features:"
echo "• Professional red, black & white theme (no logo)"
echo "• 6 consolidated feature suites (from 34 individual features)"
echo "• Advanced image rendering & AI analysis capabilities"
echo "• Enhanced UI/UX with cleaner, modern design"
echo "• All 8 local LLMs verified and connected"
echo "• Improved company document training accuracy"
echo ""
echo "🌐 Access enhanced Susan AI at: http://localhost:3003"
echo ""
echo "🔄 To rollback to previous version:"
echo "   ./rollback-susan.sh"
echo ""
echo "🎯 Feature Suites Available:"
echo "   1. 🔍 Smart Analysis Hub - Photo analysis, damage assessment, measurements"
echo "   2. 🏢 Claims & Insurance Suite - Forms, templates, estimates, tracking"
echo "   3. 🧱 Materials & Operations - Calculator, inventory, pricing, suppliers"
echo "   4. 👥 Customer & Project Hub - Portal, scheduling, communication"
echo "   5. 🛡️ Safety & Compliance - Protocols, permits, quality control"
echo "   6. 🤖 AI & Automation - Advanced AI, analytics, workflow automation"
echo ""
echo "Ready for professional use! 🎉"