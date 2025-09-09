#!/bin/bash
echo "🚀 Starting Job Tracker + Resume Tailor..."

# Kill any existing tmux sessions with this name
tmux kill-session -t job_tracker 2>/dev/null

# Create new tmux session
tmux new-session -d -s job_tracker

# Split window vertically
tmux split-window -v

# Backend (top pane)
tmux send-keys -t job_tracker:0.0 "cd backend && npm run dev" C-m

# Frontend (bottom pane)
tmux send-keys -t job_tracker:0.1 "cd frontend && python -m http.server 3000" C-m

# Attach to the session
tmux attach-session -t job_tracker