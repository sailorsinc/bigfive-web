#!/bin/bash

# Script to push BigFive API changes to GitHub

echo "🚀 Preparing to push BigFive API to GitHub..."
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ No git repository found. Initializing..."
    git init
    echo "✅ Git initialized"
else
    echo "✅ Git repository exists"
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    echo "📝 No branch exists yet. Creating 'main' branch..."
    git checkout -b main
    CURRENT_BRANCH="main"
fi

echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Show status
echo "📊 Git Status:"
git status --short
echo ""

# Stage all changes
echo "📦 Staging all changes..."
git add .
echo "✅ Changes staged"
echo ""

# Show what will be committed
echo "📝 Files to be committed:"
git diff --cached --name-status
echo ""

# Create commit
read -p "Enter commit message (or press Enter for default): " COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Add BigFive Interview Transcript API with Railway deployment support

- Add standalone API server (Express + TypeScript)
- Add transcript analyzer package with GPT-4 integration
- Add content quality validation
- Add Railway deployment configuration (nixpacks + Docker)
- Add comprehensive documentation
- Add rate limiting and security features
- Add health checks and monitoring
- Ready for production deployment"
fi

git commit -m "$COMMIT_MSG"
echo "✅ Commit created"
echo ""

# Check for remote
REMOTE_URL=$(git remote get-url origin 2>/dev/null)

if [ -z "$REMOTE_URL" ]; then
    echo "❌ No remote repository configured"
    echo ""
    echo "Please add your GitHub repository:"
    echo "1. Create a new repository on GitHub"
    echo "2. Run: git remote add origin YOUR_GITHUB_URL"
    echo ""
    read -p "Enter your GitHub repository URL (or press Enter to skip): " GITHUB_URL

    if [ ! -z "$GITHUB_URL" ]; then
        git remote add origin "$GITHUB_URL"
        echo "✅ Remote added: $GITHUB_URL"
    else
        echo "⏭️  Skipping remote configuration"
        echo ""
        echo "To push later, run:"
        echo "  git remote add origin YOUR_GITHUB_URL"
        echo "  git push -u origin $CURRENT_BRANCH"
        exit 0
    fi
else
    echo "✅ Remote repository: $REMOTE_URL"
fi

echo ""

# Push to GitHub
read -p "Push to GitHub now? (y/n): " PUSH_NOW

if [ "$PUSH_NOW" = "y" ] || [ "$PUSH_NOW" = "Y" ]; then
    echo "🚀 Pushing to GitHub..."

    # Check if branch exists on remote
    if git ls-remote --heads origin $CURRENT_BRANCH | grep -q $CURRENT_BRANCH; then
        git push origin $CURRENT_BRANCH
    else
        git push -u origin $CURRENT_BRANCH
    fi

    if [ $? -eq 0 ]; then
        echo "✅ Successfully pushed to GitHub!"
        echo ""
        echo "🎉 Next Steps:"
        echo "1. Go to https://railway.app/"
        echo "2. Click 'New Project' → 'Deploy from GitHub'"
        echo "3. Select your repository"
        echo "4. Follow: SIMPLE_RAILWAY_DEPLOY.md"
    else
        echo "❌ Push failed. Please check your credentials and try again."
        echo ""
        echo "Troubleshooting:"
        echo "- Ensure you're logged in to GitHub"
        echo "- Check you have push access to the repository"
        echo "- Try: git push -u origin $CURRENT_BRANCH"
    fi
else
    echo "⏭️  Push cancelled"
    echo ""
    echo "To push later, run:"
    echo "  git push origin $CURRENT_BRANCH"
fi

echo ""
echo "📚 Documentation:"
echo "  - README_API_DEPLOYMENT.md - Overview"
echo "  - SIMPLE_RAILWAY_DEPLOY.md - Deployment guide"
echo "  - API_DOCUMENTATION.md - API reference"
