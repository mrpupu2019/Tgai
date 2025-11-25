param(
  [string]$Url = "http://localhost:3000/api/snapshot-upload",
  [int]$IntervalSeconds = 60,
  [int]$X = 0,
  [int]$Y = 0,
  [int]$Width = 0,
  [int]$Height = 0,
  [string]$WindowTitle = "XAUUSD",
  [switch]$UseActiveWindow,
  [ValidateSet("CopyImage","DownloadImage")] [string]$SnapshotAction = "CopyImage"
)

try { Add-Type -AssemblyName System.Windows.Forms } catch {}
Add-Type -AssemblyName System.Drawing
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

# Native helpers for accurate window bounds
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@
function Get-CaptureBounds {
  # If a window is requested, try to capture its exact bounds
  if ($UseActiveWindow -or ($WindowTitle -ne "")) {
    $hWnd = [IntPtr]::Zero
    if ($UseActiveWindow) {
      $hWnd = [Win32]::GetForegroundWindow()
    } elseif ($WindowTitle -ne "") {
      $proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*$WindowTitle*" } | Select-Object -First 1
      if ($proc) { $hWnd = $proc.MainWindowHandle }
    }
    if ($hWnd -ne [IntPtr]::Zero) {
      $rect = New-Object Win32+RECT
      if ([Win32]::GetWindowRect($hWnd, [ref]$rect)) {
        return @{ X = $rect.Left; Y = $rect.Top; Width = ($rect.Right - $rect.Left); Height = ($rect.Bottom - $rect.Top) }
      }
    }
  }

  # Default: full virtual screen (handles multi‑monitor and negative origins)
  $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $cx = $X; $cy = $Y; $cw = $Width; $ch = $Height
  if ($cw -le 0) { $cw = $vs.Width }
  if ($ch -le 0) { $ch = $vs.Height }
  if ($cx -eq 0 -and $cy -eq 0) { $cx = $vs.Left; $cy = $vs.Top }
  return @{ X = $cx; Y = $cy; Width = $cw; Height = $ch }
}

function Capture-Image {
  $b = Get-CaptureBounds
  $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size)
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $b64 = [Convert]::ToBase64String($bytes)
  $dataUrl = "data:image/png;base64,$b64"
  $ms.Dispose(); $gfx.Dispose(); $bmp.Dispose()
  return $dataUrl
}

function Activate-Window {
  param([string]$title)
  try {
    $ws = New-Object -ComObject WScript.Shell
    if ($UseActiveWindow) { return $true }
    if ([string]::IsNullOrWhiteSpace($title)) { return $false }
    return $ws.AppActivate($title)
  } catch { return $false }
}

function Restore-ForegroundWindow {
  param([IntPtr]$hWnd)
  try { [Win32]::SetForegroundWindow($hWnd) | Out-Null } catch {}
}

function Get-ClipboardPngDataUrl {
  try { [System.Windows.Forms.Clipboard]::Clear() } catch {}
  for ($i=0; $i -lt 20; $i++) {
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($img) {
      $ms = New-Object System.IO.MemoryStream
      $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $b64 = [Convert]::ToBase64String($ms.ToArray())
      $ms.Dispose(); $img.Dispose()
      return "data:image/png;base64,$b64"
    }
    Start-Sleep -Milliseconds 250
  }
  return $null
}

function Get-DownloadedPngDataUrl {
  $dl = Join-Path $env:USERPROFILE 'Downloads'
  $before = Get-ChildItem $dl -Filter *.png | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  # Wait for a new file
  for ($i=0; $i -lt 20; $i++) {
    $after = Get-ChildItem $dl -Filter *.png | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($after -and (!$before -or $after.FullName -ne $before.FullName)) {
      $bytes = [System.IO.File]::ReadAllBytes($after.FullName)
      $b64 = [Convert]::ToBase64String($bytes)
      return "data:image/png;base64,$b64"
    }
    Start-Sleep -Milliseconds 250
  }
  return $null
}

Write-Host "Snapshot agent started. Uploading to $Url every $IntervalSeconds seconds" -ForegroundColor Green
$lastHash = $null
while ($true) {
  try {
    $dataUrl = $null
    # Strict TradingView snapshot only (no screen fallback)
    $prev = [Win32]::GetForegroundWindow()
    if ($UseActiveWindow -or ($WindowTitle -ne "")) {
      $null = Activate-Window -title $WindowTitle
      Start-Sleep -Milliseconds 300
    }
    if ($SnapshotAction -eq 'CopyImage') {
      [System.Windows.Forms.SendKeys]::SendWait('^+s') # Ctrl+Shift+S -> Copy image
      $dataUrl = Get-ClipboardPngDataUrl
    } else {
      [System.Windows.Forms.SendKeys]::SendWait('^%s') # Ctrl+Alt+S -> Download image
      $dataUrl = Get-DownloadedPngDataUrl
    }
    Restore-ForegroundWindow -hWnd $prev

    if (-not $dataUrl) {
      Write-Host "Snapshot not captured from TradingView." -ForegroundColor Yellow
      throw "No snapshot available"
    }

    # Prevent resending identical clipboard/download snapshots
    $bytes = [Convert]::FromBase64String(($dataUrl -replace '^data:image\/png;base64,',''))
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hash = ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '')
    if ($hash -eq $lastHash) {
      Write-Host "Duplicate snapshot skipped." -ForegroundColor DarkYellow
      throw "Duplicate snapshot"
    }
    $lastHash = $hash

    $payload = @{ image = $dataUrl } | ConvertTo-Json -Depth 2
    $resp = Invoke-WebRequest -Uri $Url -Method Post -ContentType 'application/json' -Body $payload -ErrorAction Stop
    Write-Host "Uploaded snapshot at $(Get-Date)" -ForegroundColor Cyan
  } catch {
    Write-Host "Upload failed: $_" -ForegroundColor Red
  }
  Start-Sleep -Seconds $IntervalSeconds
}