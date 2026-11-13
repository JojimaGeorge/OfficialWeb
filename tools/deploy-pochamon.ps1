# ぽちゃもん公式サイト（pochamon.com・Cloudflare Pages「pochamon」＝個人アカウント）を手元のフォルダから上げる台本
# 鍵は chara-chat の台本が Windows のログインで暗号化して置いたもの（%LOCALAPPDATA%\chara-chat\cloudflare-token.xml）を、この PowerShell の中だけで使う
# wrangler のログインは会社のアカウントのままでよい（鍵がログインより優先される）
# 使い方（本人が PowerShell で）: powershell -ExecutionPolicy Bypass -File C:\Users\spitz\Desktop\HP\OfficialWeb\tools\deploy-pochamon.ps1
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$KeyFile = Join-Path $env:LOCALAPPDATA "chara-chat\cloudflare-token.xml"
if (-not (Test-Path $KeyFile)) { throw "個人の鍵が無い。chara-chat の deploy-with-bw.ps1 を一度流して置き直して" }
$sec = Import-Clixml $KeyFile
$env:CLOUDFLARE_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
$env:CLOUDFLARE_ACCOUNT_ID = "9fb6c72af43f05e23a7eca3f44ba9e95"
Set-Location (Split-Path $PSScriptRoot -Parent)
$who = (npx -y wrangler@4 whoami 2>&1 | Out-String)
if ($who -notmatch "spitzspitzspitz8823@gmail\.com") { throw "出し先が個人のアカウントやない（whoami に個人のメールが無い）。止めた" }
npx -y wrangler@4 pages deploy pochamon --project-name pochamon --branch main --commit-dirty=true
