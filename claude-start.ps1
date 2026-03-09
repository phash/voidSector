# Claude Code Launcher
param (
    [Parameter(Mandatory=$false, Position=0)]
    [ValidateSet("local", "cloud")]
    [string]$Mode
)

# Falls kein Parameter übergeben wurde, Auswahlmenü anzeigen
if (-not $Mode) {
    Clear-Host
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host "   Claude Code Launcher" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host "1) Lokal (Ollama)" -ForegroundColor Yellow
    Write-Host "2) Cloud (Anthropic API)" -ForegroundColor Green
    Write-Host ""
    $choice = Read-Host "Wähle einen Modus (1 oder 2)"

    if ($choice -eq "1") { $Mode = "local" }
    else { $Mode = "cloud" }
}

if ($Mode -eq "local") {
    # HINWEIS: Stelle sicher, dass dieses Modell in Ollama vorhanden ist (ollama pull qwen2.5-coder:7b)
    $Model = "qwen2.5-coder:7b" 
    
    Write-Host "`n[INFO] Starte Claude LOKAL mit Modell: $Model" -ForegroundColor Yellow
    Write-Host "[INFO] Nutze Endpoint: http://localhost:11434/v1`n" -ForegroundColor Gray
    
    # Umgebungsvariablen für diese Session setzen
    $env:ANTHROPIC_BASE_URL = "http://localhost:11434/v1"
    $env:ANTHROPIC_API_KEY = "ollama"
    
    # Claude starten
    claude --model $Model --dangerously-skip-permissions
}
else {
    Write-Host "`n[INFO] Starte Claude CLOUD (Anthropic API)..." -ForegroundColor Green
    
    # Lokale URL für diese Session entfernen
    $env:ANTHROPIC_BASE_URL = $null
    
    # Claude normal starten
    claude --dangerously-skip-permissions
}
