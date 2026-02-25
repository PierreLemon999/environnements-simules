#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Environnements Simulés — Automated Visual & Functional Feedback Loop
# ══════════════════════════════════════════════════════════════
#
# This script runs an autonomous improve loop:
#   1. Takes screenshots of every page (Playwright)
#   2. Compares them to mockups using Claude vision
#   3. Runs functional tests (Playwright)
#   4. Sends all issues to Claude for fixing
#   5. Repeats until quality threshold or max iterations
#
# Usage:
#   ./run-feedback-loop.sh          # Default: max 15 iterations
#   ./run-feedback-loop.sh 30       # Custom max iterations
#
# Fire and forget — runs all night unattended.
# ══════════════════════════════════════════════════════════════

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TESTS_DIR="$PROJECT_DIR/tests"
SCREENSHOTS_DIR="$TESTS_DIR/screenshots"
MOCKUPS_DIR="/Users/pierre/Library/Mobile Documents/com~apple~CloudDocs/code/mockup-forge/projects/environnements-simules"
LOG_DIR="$PROJECT_DIR/feedback-logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

MAX_ITERATIONS=${1:-15}
ITERATION=0
BACKEND_PID=""
FRONTEND_PID=""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

mkdir -p "$LOG_DIR" "$SCREENSHOTS_DIR"

# ── Cleanup on exit ──────────────────────────────────────────
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    # Kill any leftover node processes on our ports
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT

# ── Start servers ────────────────────────────────────────────
start_servers() {
    echo -e "${CYAN}Starting servers...${NC}"

    # Kill existing
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 1

    # Ensure dependencies are installed
    cd "$PROJECT_DIR/backend" && npm install --silent 2>/dev/null
    cd "$PROJECT_DIR/frontend" && npm install --silent 2>/dev/null

    # Backend
    cd "$PROJECT_DIR/backend"
    npx tsx src/db/seed.ts > /dev/null 2>&1
    npx tsx src/index.ts > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!

    # Frontend
    cd "$PROJECT_DIR/frontend"
    npx vite dev > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!

    # Wait for servers
    echo -n "  Waiting for backend..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            echo -e " ${GREEN}OK${NC}"
            break
        fi
        sleep 1
        [ $i -eq 30 ] && echo -e " ${RED}TIMEOUT${NC}" && return 1
    done

    echo -n "  Waiting for frontend..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo -e " ${GREEN}OK${NC}"
            break
        fi
        sleep 1
        [ $i -eq 30 ] && echo -e " ${RED}TIMEOUT${NC}" && return 1
    done

    cd "$PROJECT_DIR"
}

# ── Restart servers (after code changes) ─────────────────────
restart_servers() {
    echo -e "${CYAN}Restarting servers after code changes...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 2
    start_servers
}

# ── Take screenshots ─────────────────────────────────────────
take_screenshots() {
    echo -e "${CYAN}Taking screenshots...${NC}"
    cd "$PROJECT_DIR"
    npx playwright test \
        --config=tests/playwright.config.ts \
        --project=screenshots \
        --reporter=line \
        2>&1 | tee "$LOG_DIR/iteration-${ITERATION}-screenshots.log"
    local exit_code=${PIPESTATUS[0]}
    echo -e "  Screenshots: $(ls "$SCREENSHOTS_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ') captured"
    return $exit_code
}

# ── Run functional tests ─────────────────────────────────────
run_functional_tests() {
    echo -e "${CYAN}Running functional tests...${NC}"
    cd "$PROJECT_DIR"
    npx playwright test \
        --config=tests/playwright.config.ts \
        --project=functional \
        --reporter=line \
        2>&1 | tee "$LOG_DIR/iteration-${ITERATION}-functional.log"
    local exit_code=${PIPESTATUS[0]}
    return $exit_code
}

# ── Compare screenshots to mockups ───────────────────────────
compare_and_generate_issues() {
    echo -e "${CYAN}Comparing screenshots to mockups (Claude vision)...${NC}"

    local ISSUES_FILE="$LOG_DIR/iteration-${ITERATION}-issues.md"

    # Build the comparison prompt with screenshot and mockup paths
    local PROMPT="You are a UI/UX quality auditor for the Environnements Simulés project.

TASK: Compare the current app screenshots against the reference mockups and identify every visual and functional issue.

INSTRUCTIONS:
1. Read CLAUDE.md for project context and design system.
2. Look at each screenshot in $SCREENSHOTS_DIR/ (these are the CURRENT state of the app).
3. Look at the reference mockups in $MOCKUPS_DIR/ — for each mockup folder, find the latest version PNG in the retours/ subfolder. The feedback JSON files tell you what changes were requested.
4. For each page, compare CURRENT vs MOCKUP and list every difference.

Focus on:
- Layout structure (sidebar width, panel arrangement, spacing)
- Colors (exact shades matching design system: primary #3B82F6, backgrounds, text colors)
- Typography (font sizes, weights, uppercase labels)
- Components (are badges, status dots, progress bars, cards matching the mockups?)
- Content (correct labels in French, correct icons, correct placeholder data)
- Missing elements (sections, buttons, stats cards that are in mockups but not in app)
- Extra elements (things in app that shouldn't be there per mockups)
- Interactive elements (are tabs, dropdowns, toggles styled correctly?)
- Responsive behavior (sidebar collapse)

Also check:
- Are there any pages that crash or show errors?
- Are there blank/empty pages that should have content?
- Does the login flow actually work?
- Does navigation between pages work?

OUTPUT FORMAT — write to $ISSUES_FILE:
Start with a severity summary: CRITICAL (blocks usage), HIGH (clearly wrong), MEDIUM (noticeable), LOW (polish).
Then list each issue as:

## [PAGE_NAME] — [SEVERITY]
**File**: path/to/svelte/file.svelte
**Issue**: Describe what's wrong
**Expected**: What it should look like (per mockup)
**Fix**: Specific code change needed

If everything looks perfect for a page, write: ## [PAGE_NAME] — OK

End with:
TOTAL_ISSUES: [number]
CRITICAL: [number]
HIGH: [number]
MEDIUM: [number]
LOW: [number]

If TOTAL_ISSUES is 0, write QUALITY_APPROVED on the last line."

    claude -p "$PROMPT" \
        --allowedTools "Read,Glob,Grep" \
        --model opus \
        --max-turns 80 \
        > "$LOG_DIR/iteration-${ITERATION}-comparison.log" 2>&1

    # Check if issues file was created
    if [ -f "$ISSUES_FILE" ]; then
        local total=$(grep -o 'TOTAL_ISSUES: [0-9]*' "$ISSUES_FILE" | grep -o '[0-9]*' || echo "?")
        echo -e "  Issues found: ${YELLOW}${total}${NC}"

        if grep -q 'QUALITY_APPROVED' "$ISSUES_FILE" 2>/dev/null; then
            return 0  # No issues!
        fi
        return 1  # Has issues
    else
        # If no file created, check the log for the issues content
        echo -e "  ${YELLOW}Issues file not created separately, checking log...${NC}"
        # Copy log as issues file
        cp "$LOG_DIR/iteration-${ITERATION}-comparison.log" "$ISSUES_FILE"
        return 1
    fi
}

# ── Fix issues ───────────────────────────────────────────────
fix_issues() {
    echo -e "${CYAN}Fixing issues (Claude code)...${NC}"

    local ISSUES_FILE="$LOG_DIR/iteration-${ITERATION}-issues.md"
    local FIX_LOG="$LOG_DIR/iteration-${ITERATION}-fixes.log"

    local PROMPT="You are fixing UI/UX issues for the Environnements Simulés project.

INSTRUCTIONS:
1. Read CLAUDE.md for project context, design system, and conventions.
2. Read the issues file at $ISSUES_FILE — it contains a detailed list of visual and functional issues found by comparing the app to reference mockups.
3. Fix EVERY issue listed, starting with CRITICAL, then HIGH, then MEDIUM, then LOW.
4. For each fix, edit the appropriate Svelte/CSS/TS file.
5. After all fixes, run: cd $PROJECT_DIR/frontend && npx svelte-check to verify no type errors.
6. Write a summary of all fixes to $LOG_DIR/iteration-${ITERATION}-fix-summary.md

IMPORTANT RULES:
- Follow the design system exactly (colors, spacing, typography from CLAUDE.md)
- Keep all UI text in French
- Keep all code in English
- Don't break existing functionality while fixing visual issues
- If a fix requires a new component, create it in the appropriate directory
- If you're unsure about a mockup detail, err on the side of the Linear/Notion aesthetic
- Test your changes compile by running svelte-check"

    claude -p "$PROMPT" \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
        --model opus \
        --max-turns 150 \
        > "$FIX_LOG" 2>&1

    echo -e "  ${GREEN}Fixes applied${NC}"
}

# ══════════════════════════════════════════════════════════════
# MAIN LOOP
# ══════════════════════════════════════════════════════════════

echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Environnements Simulés — Feedback Loop${NC}"
echo -e "${BLUE}  Max iterations: $MAX_ITERATIONS${NC}"
echo -e "${BLUE}  Started: $(date)${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

# Initial server start
start_servers || { echo -e "${RED}Failed to start servers${NC}"; exit 1; }

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))

    echo ""
    echo -e "${YELLOW}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  Iteration $ITERATION / $MAX_ITERATIONS — $(date '+%H:%M:%S')${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════╝${NC}"
    echo ""

    # Step 1: Take screenshots
    take_screenshots

    # Step 2: Run functional tests
    FUNCTIONAL_OK=true
    run_functional_tests || FUNCTIONAL_OK=false

    if [ "$FUNCTIONAL_OK" = false ]; then
        echo -e "  ${RED}Functional tests failed${NC}"
    else
        echo -e "  ${GREEN}Functional tests passed${NC}"
    fi

    # Step 3: Compare screenshots to mockups
    QUALITY_OK=false
    compare_and_generate_issues && QUALITY_OK=true

    if [ "$QUALITY_OK" = true ] && [ "$FUNCTIONAL_OK" = true ]; then
        echo ""
        echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  QUALITY APPROVED — All checks passed!${NC}"
        echo -e "${GREEN}  Iterations needed: $ITERATION${NC}"
        echo -e "${GREEN}  Finished: $(date)${NC}"
        echo -e "${GREEN}══════════════════════════════════════════════════${NC}"

        # Final commit
        cd "$PROJECT_DIR"
        git add -A
        git commit -m "$(cat <<'EOF'
fix: visual and functional improvements from feedback loop

Automated fixes from screenshot comparison against mockups.
All functional tests passing, visual quality approved.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
        )" 2>/dev/null

        exit 0
    fi

    # Step 4: Fix issues
    fix_issues

    # Step 5: Restart servers to pick up changes
    restart_servers || { echo -e "${RED}Failed to restart servers${NC}"; exit 1; }

    # Intermediate commit every 3 iterations
    if [ $((ITERATION % 3)) -eq 0 ]; then
        echo -e "${CYAN}Intermediate commit...${NC}"
        cd "$PROJECT_DIR"
        git add -A
        git commit -m "$(cat <<EOF
fix: feedback loop iteration $ITERATION improvements

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
        )" 2>/dev/null
    fi

    echo -e "  ${BLUE}Iteration $ITERATION complete. Moving to next...${NC}"
done

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Max iterations reached ($MAX_ITERATIONS)${NC}"
echo -e "${YELLOW}  Check logs: $LOG_DIR/${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════${NC}"

# Final commit
cd "$PROJECT_DIR"
git add -A
git commit -m "$(cat <<'EOF'
fix: feedback loop improvements (max iterations reached)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" 2>/dev/null

exit 0
