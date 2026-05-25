#!/bin/bash

# ============================================
# MASTER TEST RUNNER
# Runs all tests and generates comprehensive report
# ============================================

echo "🚀 Gmail Automation - Master Test Suite"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track overall status
OVERALL_STATUS=0

# ============================================
# 1. UNIT TESTS (Fast, Mocked)
# ============================================
echo -e "${BLUE}📦 Running Unit Tests (Fast, Mocked)${NC}"
echo "-------------------------------------------"

npm run test:unit

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Unit tests passed!${NC}"
else
    echo -e "${RED}❌ Unit tests failed!${NC}"
    OVERALL_STATUS=1
fi

echo ""
echo ""

# ============================================
# 2. TEST COVERAGE
# ============================================
echo -e "${BLUE}📊 Generating Test Coverage Report${NC}"
echo "-------------------------------------------"

npm run test:coverage -- --silent

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Coverage report generated!${NC}"
else
    echo -e "${YELLOW}⚠️  Coverage report had issues${NC}"
fi

echo ""
echo ""

# ============================================
# 3. LINTING
# ============================================
echo -e "${BLUE}🔍 Running ESLint${NC}"
echo "-------------------------------------------"

npm run lint

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ No linting errors!${NC}"
else
    echo -e "${YELLOW}⚠️  Linting warnings found (non-critical)${NC}"
fi

echo ""
echo ""

# ============================================
# 4. INTEGRATION TESTS (Optional)
# ============================================
echo -e "${BLUE}🌐 Checking Integration Tests${NC}"
echo "-------------------------------------------"

# Check if integration tests are enabled
if grep -q "describe.skip" tests-local/api-service.integration.test.js; then
    echo -e "${YELLOW}⏭️  Integration tests are DISABLED (skipped)${NC}"
    echo ""
    echo "To enable:"
    echo "  1. Set API key: export GEMINI_API_KEY=\"your-key\""
    echo "  2. Edit: tests-local/api-service.integration.test.js"
    echo "  3. Change: describe.skip → describe"
    echo "  4. Run: npm run test:integration"
else
    echo "Integration tests are ENABLED"

    # Check if API key is set
    if [ -z "$GEMINI_API_KEY" ]; then
        echo -e "${YELLOW}⚠️  No API key found!${NC}"
        echo "Set GEMINI_API_KEY environment variable to run integration tests"
        echo "Example: export GEMINI_API_KEY=\"your-key-here\""
    else
        echo "Running integration tests with real Gemini API..."
        echo ""

        npm run test:integration

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Integration tests passed!${NC}"
        else
            echo -e "${RED}❌ Integration tests failed!${NC}"
            OVERALL_STATUS=1
        fi
    fi
fi

echo ""
echo ""

# ============================================
# 5. FILE STATISTICS
# ============================================
echo -e "${BLUE}📈 Project Statistics${NC}"
echo "-------------------------------------------"

echo "JavaScript Files:"
find . -name "*.js" -not -path "./node_modules/*" -not -path "./coverage/*" | wc -l

echo "Test Files:"
find tests-local -name "*.test.js" | wc -l

echo "Total Lines of Code (excluding node_modules):"
find . -name "*.js" -not -path "./node_modules/*" -not -path "./coverage/*" -exec wc -l {} + | tail -1

echo ""

# ============================================
# 6. SUMMARY
# ============================================
echo ""
echo "========================================"
echo -e "${BLUE}📋 TEST SUMMARY${NC}"
echo "========================================"
echo ""

# Unit test count
UNIT_TESTS=$(npm test -- --silent 2>&1 | grep "Tests:" | head -1)
echo "Unit Tests: $UNIT_TESTS"

# Coverage summary - extract the line with actual numbers
COVERAGE=$(npm run test:coverage -- --silent 2>&1 | grep -E "All files.*\|.*\|.*\|.*\|" | head -1)
if [ -z "$COVERAGE" ]; then
  echo "Coverage: Unable to parse coverage data (check npm run test:coverage)"
else
  echo "Coverage: $COVERAGE"
fi

echo ""

# Overall status
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo ""
    echo "🎉 Your code is ready for deployment!"
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please fix the failing tests before deploying."
fi

echo ""
echo "========================================"
echo ""

# ============================================
# 7. USEFUL COMMANDS
# ============================================
echo -e "${BLUE}💡 Useful Commands:${NC}"
echo ""
echo "  npm test                    - Run all unit tests"
echo "  npm run test:watch          - Run tests in watch mode"
echo "  npm run test:coverage       - Generate coverage report"
echo "  npm run test:integration    - Run integration tests"
echo "  npm run lint                - Run ESLint"
echo "  npm run lint:fix            - Auto-fix linting issues"
echo ""

exit $OVERALL_STATUS
