#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Environnements Simulés — Automated Phase Runner
# ══════════════════════════════════════════════════════════════
#
# Usage:
#   ./run-phases.sh           # Run all phases (1-6)
#   ./run-phases.sh 3         # Run only phase 3
#   ./run-phases.sh 3 5       # Run phases 3 to 5
#
# Each phase gets a fresh Claude context with CLAUDE.md loaded.
# Progress is logged to ./phase-logs/
# ══════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/phase-logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Phase range
START_PHASE=${1:-1}
END_PHASE=${2:-6}

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

mkdir -p "$LOG_DIR"

echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Environnements Simulés — Phase Runner${NC}"
echo -e "${BLUE}  Phases $START_PHASE → $END_PHASE${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

for phase in $(seq "$START_PHASE" "$END_PHASE"); do
    LOG_FILE="$LOG_DIR/phase-${phase}-${TIMESTAMP}.log"

    echo -e "${YELLOW}══════ Phase $phase / $END_PHASE ══════${NC}"
    echo -e "  Log: $LOG_FILE"
    echo -e "  Started: $(date '+%H:%M:%S')"
    echo ""

    # Build the prompt for this phase
    PROMPT="You are implementing Phase $phase of PHASES.md for the Environnements Simulés project.

CRITICAL INSTRUCTIONS:
1. First, read CLAUDE.md for full project context and conventions.
2. Then, read PHASES.md and find Phase $phase.
3. Check which tasks in Phase $phase are already completed (checked boxes). Skip those.
4. Implement ALL unchecked tasks for Phase $phase, one by one.
5. After implementing each task, test it if possible (start backend with 'cd $PROJECT_DIR/backend && npm run dev &', frontend with 'cd $PROJECT_DIR/frontend && npm run dev &').
6. When a task is done, update PHASES.md to check the box.
7. At the end, verify all acceptance criteria for Phase $phase.
8. Write a summary of what was done to $LOG_DIR/phase-${phase}-summary.md.

IMPORTANT:
- Follow the exact design and conventions described in CLAUDE.md.
- Match the mockup descriptions precisely (colors, layout, components).
- Use shadcn-svelte components where specified.
- All code in English, UI content in French.
- Don't skip any task. Be thorough.
- If you encounter an issue, document it and move on to the next task.
- Kill any background dev servers before finishing."

    # Run Claude with fresh context
    if claude -p "$PROMPT" \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
        --max-turns 150 \
        --model opus \
        > "$LOG_FILE" 2>&1; then
        echo -e "  ${GREEN}✓ Phase $phase completed successfully${NC}"
    else
        EXIT_CODE=$?
        echo -e "  ${RED}✗ Phase $phase failed (exit code: $EXIT_CODE)${NC}"
        echo -e "  ${RED}  Check log: $LOG_FILE${NC}"
        echo ""
        echo -e "${YELLOW}Continue with next phase? [y/N]${NC}"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo -e "${RED}Aborted.${NC}"
            exit 1
        fi
    fi

    echo -e "  Finished: $(date '+%H:%M:%S')"
    echo ""
done

echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  All phases complete!${NC}"
echo -e "${GREEN}  Logs: $LOG_DIR/${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
