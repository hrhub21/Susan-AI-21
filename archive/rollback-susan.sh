#!/bin/bash

# Rollback to Previous Susan AI Version

echo "🔄 Rolling back to previous Susan AI version..."
echo "=============================================="

# Check if backup files exist
if [ ! -f "public/index-backup.html" ]; then
    echo "❌ No backup files found. Cannot rollback."
    exit 1
fi

# Restore backup files
echo "📋 Restoring backup files..."
cp public/index-backup.html public/index.html
cp public/susan-working-backup.js public/susan-working.js
cp public/susan-styles-backup.css public/susan-styles.css

echo "✅ Successfully rolled back to previous version!"
echo ""
echo "🌐 Access restored Susan AI at: http://localhost:3003"
echo ""
echo "🚀 To deploy enhanced version again:"
echo "   ./deploy-enhanced-susan.sh"