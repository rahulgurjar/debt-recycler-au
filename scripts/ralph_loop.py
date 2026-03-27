#!/usr/bin/env python3
"""
Ralph Loop — Agentic Build Scaffolding

Reads tasks from spec/08_dashboard_tasks.md and feeds them to Claude CLI
for autonomous implementation of Dashboard SaaS (Debt Recycler Dashboard for advisors).

Usage:
    python3 scripts/ralph_loop.py                # Run all pending tasks
    python3 scripts/ralph_loop.py --dry-run      # Show tasks without running
    python3 scripts/ralph_loop.py --task auth    # Run specific task only
"""

import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Configuration
CONFIG = {
    "MIN_DELAY_SECONDS": 0,
    "MAX_CALLS_PER_HOUR": 999999,
    "MAX_CALLS_PER_DAY": 999999,
    "CLAUDE_MAX_TURNS": 20,
    "BACKOFF_BASE_SECONDS": 60,
    "MAX_BACKOFF_SECONDS": 600,
}

STATE_FILE = Path(".ralph_state.json")
SPEC_FILE = Path("spec/08_dashboard_tasks.md")
PROJECT_ROOT = Path(".")

# Color codes for output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"

def load_state():
    """Load Ralph state from .ralph_state.json"""
    if not STATE_FILE.exists():
        return {
            "project": "dashboard_saas",
            "completed": [],
            "current_task": None,
            "calls_today": [],
            "calls_this_hour": [],
            "last_call_at": None,
        }
    with open(STATE_FILE) as f:
        return json.load(f)

def save_state(state):
    """Save Ralph state"""
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def check_rate_limits(state):
    """Verify we're within rate limits before calling Claude"""
    now = datetime.now(timezone.utc)

    # Clean old calls from state
    calls_today = [
        call_time for call_time in state.get("calls_today", [])
        if datetime.fromisoformat(call_time) > now - timedelta(hours=24)
    ]
    calls_this_hour = [
        call_time for call_time in state.get("calls_this_hour", [])
        if datetime.fromisoformat(call_time) > now - timedelta(hours=1)
    ]

    state["calls_today"] = calls_today
    state["calls_this_hour"] = calls_this_hour

    # Check limits
    if len(calls_today) >= CONFIG["MAX_CALLS_PER_DAY"]:
        print(f"{RED}❌ Daily limit reached ({CONFIG['MAX_CALLS_PER_DAY']} calls){RESET}")
        return False

    if len(calls_this_hour) >= CONFIG["MAX_CALLS_PER_HOUR"]:
        print(f"{YELLOW}⚠️  Hour limit reached ({CONFIG['MAX_CALLS_PER_HOUR']} calls){RESET}")
        return False

    # Check minimum gap
    last_call = state.get("last_call_at")
    if last_call:
        last_call_dt = datetime.fromisoformat(last_call)
        gap = (now - last_call_dt).total_seconds()
        if gap < CONFIG["MIN_DELAY_SECONDS"]:
            wait_time = CONFIG["MIN_DELAY_SECONDS"] - gap
            print(f"{YELLOW}⏳ Waiting {wait_time:.0f}s (min gap: {CONFIG['MIN_DELAY_SECONDS']}s){RESET}")
            time.sleep(wait_time)

    return True

def parse_tasks_from_spec():
    """Parse task list from spec/08_dashboard_tasks.md"""
    if not SPEC_FILE.exists():
        print(f"{RED}❌ {SPEC_FILE} not found{RESET}")
        return []

    tasks = []
    with open(SPEC_FILE) as f:
        content = f.read()

    # Parse markdown task blocks: ## Task: task_id
    task_pattern = r"## Task: (\w+)\n(.*?)(?=## Task:|$)"
    matches = re.finditer(task_pattern, content, re.DOTALL)

    for match in matches:
        task_id = match.group(1)
        task_block = match.group(2).strip()
        tasks.append({"id": task_id, "prompt": task_block})

    return tasks

def run_claude_task(task_id, prompt):
    """Call Claude CLI to execute a task"""
    cmd = [
        "claude",
        "--print",
        "--max-turns", str(CONFIG["CLAUDE_MAX_TURNS"]),
        "--permission-mode", "bypassPermissions",
        prompt,
    ]

    print(f"\n{GREEN}▶️  Running task: {task_id}{RESET}")
    print(f"Prompt ({len(prompt)} chars):\n{prompt[:200]}...")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)

        if result.returncode != 0:
            print(f"{RED}❌ Task failed: {task_id}{RESET}")
            print(f"stderr: {result.stderr}")
            return False

        print(f"{GREEN}✓ Task completed: {task_id}{RESET}")
        if result.stdout:
            print(f"Output: {result.stdout[:500]}...")
        return True
    except subprocess.TimeoutExpired:
        print(f"{RED}❌ Task timeout: {task_id}{RESET}")
        return False
    except Exception as e:
        print(f"{RED}❌ Task error: {e}{RESET}")
        return False

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Ralph Loop — Agentic Build Driver")
    parser.add_argument("--dry-run", action="store_true", help="Show tasks without running")
    parser.add_argument("--task", help="Run specific task ID only")
    parser.add_argument("--retry-failed", action="store_true", help="Retry failed tasks")
    args = parser.parse_args()

    state = load_state()
    tasks = parse_tasks_from_spec()

    if not tasks:
        print(f"{RED}❌ No tasks found in {SPEC_FILE}{RESET}")
        print("Create spec/08_dashboard_tasks.md with task definitions")
        sys.exit(1)

    print(f"{GREEN}📋 Ralph Loop — Dashboard SaaS Implementation{RESET}")
    print(f"Tasks: {len(tasks)} | Completed: {len(state['completed'])}")

    # Dry run: just list tasks
    if args.dry_run:
        print("\n" + "=" * 60)
        for i, task in enumerate(tasks, 1):
            status = "✓" if task["id"] in state["completed"] else " "
            print(f"{status} {i}. {task['id']}")
        return

    # Run specific task
    if args.task:
        task = next((t for t in tasks if t["id"] == args.task), None)
        if not task:
            print(f"{RED}❌ Task not found: {args.task}{RESET}")
            sys.exit(1)
        tasks = [task]

    # Execute tasks
    for task in tasks:
        if task["id"] in state["completed"] and not args.retry_failed:
            print(f"⊘ Skipping completed task: {task['id']}")
            continue

        # Check rate limits
        if not check_rate_limits(state):
            print(f"{YELLOW}Rate limit reached. Run again later.{RESET}")
            save_state(state)
            sys.exit(0)

        # Run task
        success = run_claude_task(task["id"], task["prompt"])

        # Update state
        now = datetime.now(timezone.utc).isoformat()
        state["last_call_at"] = now
        state["calls_today"].append(now)
        state["calls_this_hour"].append(now)

        if success:
            state["completed"].append(task["id"])
            state["current_task"] = None
        else:
            state["current_task"] = task["id"]
            print(f"{YELLOW}Task {task['id']} failed. Fix errors and retry with: python3 scripts/ralph_loop.py --retry-failed{RESET}")

        save_state(state)

    print(f"\n{GREEN}✓ Ralph loop complete! {len(state['completed'])}/{len(tasks)} tasks done{RESET}")

if __name__ == "__main__":
    os.chdir(PROJECT_ROOT)
    main()
