# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn main:app --reload"

# Start Telegram Bot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python bot.py"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Backend is starting on http://localhost:8000"
Write-Host "Frontend is starting on http://localhost:3000"
Write-Host "Telegram Bot is starting in the background"
