#!/bin/bash

# Load environment variables
export OPENAI_API_KEY="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"
export ANTHROPIC_API_KEY="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"
export ANYTHINGLLM_API_KEY="2N9FRGD-WD74M7N-J2ZCXMY-PR0JXV7"
export ANYTHINGLLM_BASE_URL="http://localhost:3001"
export ANYTHINGLLM_WORKSPACE="roofer21"
export PORT=3003
export HOST=localhost

echo "🚀 Starting Susan AI Server on port $PORT..."
echo "📊 AnythingLLM integration enabled for workspace: $ANYTHINGLLM_WORKSPACE"

# Start the server
npm start