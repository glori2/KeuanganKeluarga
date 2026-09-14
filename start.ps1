# Start FastAPI Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd api; python -m uvicorn index:app --port 8000 --reload"

# Start Telegram Bot Polling (Local Mode)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python local_bot.py"

# Start Next.js Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host "Local Backend API is starting on http://localhost:8000"
Write-Host "Local Web Dashboard is starting on http://localhost:3000"
Write-Host "Local Telegram Bot is polling in the background"
Write-Host "Buka http://localhost:3000 di browser Anda!"
