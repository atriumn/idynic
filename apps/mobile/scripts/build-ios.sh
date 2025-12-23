#!/bin/bash
set -e

# iOS Build Script for Idynic
# Usage: ./scripts/build-ios.sh [dev|testflight|prod]

BUILD_TYPE="${1:-testflight}"
TEAM_ID="MVYX66G3WU"
SCHEME="Idynic"
WORKSPACE="ios/Idynic.xcworkspace"
ARCHIVE_PATH="ios/build/Idynic.xcarchive"
EXPORT_PATH="ios/build/export"

cd "$(dirname "$0")/.."

echo "🔧 Building iOS app for: $BUILD_TYPE"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd ../.. && pnpm install && cd apps/mobile
fi

# Set up environment based on build type
if [ "$BUILD_TYPE" = "dev" ]; then
    echo "🔧 Using development environment"
    # .env.local is already set up for dev
elif [ "$BUILD_TYPE" = "testflight" ] || [ "$BUILD_TYPE" = "prod" ]; then
    echo "🔧 Using production environment"
    if [ -f ".env.production" ]; then
        cp .env.production .env.local
    else
        echo "❌ .env.production not found!"
        exit 1
    fi
fi

# Always regenerate native project to pick up env changes
echo "📱 Generating iOS project..."
rm -rf ios
npx expo prebuild --platform ios

# Install CocoaPods if needed
if [ ! -d "ios/Pods" ]; then
    echo "🍫 Installing CocoaPods..."
    cd ios && pod install && cd ..
fi

# Clean previous build
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"
mkdir -p ios/build

echo "🏗️  Building archive..."
cd ios
xcodebuild -workspace Idynic.xcworkspace \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath build/Idynic.xcarchive \
    archive \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    | xcbeautify 2>/dev/null || tail -20

if [ ! -d "build/Idynic.xcarchive" ]; then
    echo "❌ Archive failed"
    exit 1
fi

echo "📦 Exporting IPA..."

if [ "$BUILD_TYPE" = "dev" ]; then
    METHOD="debugging"
elif [ "$BUILD_TYPE" = "testflight" ] || [ "$BUILD_TYPE" = "prod" ]; then
    METHOD="app-store-connect"
else
    echo "Unknown build type: $BUILD_TYPE"
    exit 1
fi

cat > build/ExportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>$METHOD</string>
    <key>teamID</key>
    <string>$TEAM_ID</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>destination</key>
    <string>export</string>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
    -archivePath build/Idynic.xcarchive \
    -exportPath build/export \
    -exportOptionsPlist build/ExportOptions.plist \
    -allowProvisioningUpdates \
    | tail -10

if [ -f "build/export/Idynic.ipa" ]; then
    echo ""
    echo "✅ Build complete!"
    echo "📍 IPA location: $(pwd)/build/export/Idynic.ipa"
    echo ""
    if [ "$BUILD_TYPE" = "testflight" ] || [ "$BUILD_TYPE" = "prod" ]; then
        echo "To upload to TestFlight:"
        echo "  open -a Transporter $(pwd)/build/export/Idynic.ipa"
        echo "  OR"
        echo "  cd .. && eas submit --platform ios --path ios/build/export/Idynic.ipa"
    fi
else
    echo "❌ Export failed"
    exit 1
fi
