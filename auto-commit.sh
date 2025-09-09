#!/bin/bash

# Auto-commit script for Odin knowledge vault
# Commits changes every few hours if there are modifications

cd "/Users/eddowding/Sites/Odin"

# Check if there are any changes to commit
if [[ -n $(git status --porcelain) ]]; then
    # Add all changes
    git add .
    
    # Create commit with timestamp
    git commit -m "Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')"
    
    # Push to remote
    git push
    
    echo "$(date): Auto-commit completed"
else
    echo "$(date): No changes to commit"
fi