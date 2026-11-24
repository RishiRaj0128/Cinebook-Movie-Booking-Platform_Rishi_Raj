# scripts/verify-postgres-permissions.ps1
# Runs PostgreSQL permissions verification against local or containerized instance

param (
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$Database = "cinebook",
    [string]$User = "postgres"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  CineBook PostgreSQL & Database Security Verifier" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$tcp = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue

if (-not $tcp.TcpTestSucceeded) {
    Write-Host "`n[ERROR] Cannot connect to PostgreSQL on $HostName`:$Port." -ForegroundColor Red
    Write-Host "Docker Desktop daemon or local PostgreSQL service is currently offline.`n" -ForegroundColor Yellow
    Write-Host "To execute this verification once Docker is running:" -ForegroundColor White
    Write-Host "  1. Start Docker Desktop" -ForegroundColor Gray
    Write-Host "  2. Run: docker compose up postgres -d" -ForegroundColor Gray
    Write-Host "  3. Run: docker exec -i cinebook-postgres psql -U postgres -d cinebook -f /docker-entrypoint-initdb.d/setup-ai-db-role.sql" -ForegroundColor Gray
    Write-Host "  4. Run: Get-Content scripts/verify-postgres-permissions.sql | docker exec -i cinebook-postgres psql -U postgres -d cinebook`n" -ForegroundColor Gray
    exit 1
}

Write-Host "`n[INFO] PostgreSQL connection detected on $HostName`:$Port. Executing verification suite...`n" -ForegroundColor Green
Get-Content scripts/verify-postgres-permissions.sql | docker exec -i cinebook-postgres psql -U postgres -d cinebook
