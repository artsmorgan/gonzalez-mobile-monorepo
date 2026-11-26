#!/bin/bash
set -e

# Set environment variables
export EXPO_PROJECT_ROOT=$(pwd)
export METRO_PROJECT_ROOT=$(pwd)
export NODE_PATH=$(pwd)/node_modules

# Patch Metro before export
echo "Patching Metro Transformer..."
node patch-metro.js

# Export Expo web build
echo "Exporting Expo web build..."
npx expo export --platform web --clear

echo "Build complete!"
