# SCANLY - mini serveur local (aucune installation requise)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8777
$prefix = "http://localhost:$port/"
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.css'='text/css';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.ico'='image/x-icon'; '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add($prefix)
try { $l.Start() } catch { Write-Host "Port $port deja utilise : SCANLY est probablement deja ouvert." -ForegroundColor Yellow; Start-Process $prefix; exit }
Write-Host ""
Write-Host "  SCANLY V2.19 - Votre bibliotheque, en un scan." -ForegroundColor Yellow
Write-Host "  Serveur local : $prefix"
Write-Host "  Laisse cette fenetre ouverte (reduis-la). Ferme-la pour arreter SCANLY."
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($edge) { Start-Process $edge "--app=$prefix --start-maximized" } else { Start-Process $prefix }
while ($l.IsListening) {
  try {
    $ctx = $l.GetContext(); $req = $ctx.Request; $res = $ctx.Response
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404 }
    $res.Close()
  } catch { }
}
