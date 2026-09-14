# Start FastAPI Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend/api; python -m uvicorn index:app --port 8000 --reload"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Local Backend API is starting on http://localhost:8000"
Write-Host "Local Web Dashboard is starting on http://localhost:3000"
Write-Host "Note: Telegram Bot is now running via Webhook on Vercel. You do not need to run the bot locally anymore."
