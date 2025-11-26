param(
  [string]$Url = "https://tgai-one.vercel.app/api/snapshot-upload2",
  [int]$IntervalSeconds = 60,
  [string]$WindowTitle = "XAUUSD",
  [int]$LoadDelayMs = 900,
  [int]$ZoomSteps = 8
)

try { Add-Type -AssemblyName System.Windows.Forms } catch {}
Add-Type -AssemblyName System.Drawing
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Ex {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
}
"@

function Find-WindowHandle([string]$key) {
  $procs = Get-Process | Where-Object { $_.MainWindowTitle }
  $p = $procs | Where-Object { $_.MainWindowTitle -like "*${key}*" } | Select-Object -First 1
  if ($p) { return $p.MainWindowHandle }
  $p2 = $procs | Where-Object { $_.MainWindowTitle -like "*TradingView*" } | Select-Object -First 1
  if ($p2) { return $p2.MainWindowHandle }
  return [IntPtr]::Zero
}

function Focus-Window([string]$key) {
  $h = Find-WindowHandle $key
  if ($h -eq [IntPtr]::Zero) { return $false }
  try {
    if ([Win32]::IsIconic($h)) { [Win32]::ShowWindow($h, 9) | Out-Null } # SW_RESTORE
    [Win32]::SetForegroundWindow($h) | Out-Null
    Start-Sleep -Milliseconds 250
    return $true
  } catch { return $false }
}

function ZoomCenterAndAlignLatest([string]$key, [int]$wheelSteps) {
  $h = Find-WindowHandle $key
  if ($h -eq [IntPtr]::Zero) { return }
  $rect = New-Object Win32Ex+RECT
  if (-not [Win32Ex]::GetWindowRect($h, [ref]$rect)) { return }
  $cx = [Math]::Floor(($rect.Left + $rect.Right) / 2)
  $cy = [Math]::Floor(($rect.Top + $rect.Bottom) / 2)
  [Win32Ex]::SetCursorPos($cx, $cy) | Out-Null
  for ($i=0; $i -lt $wheelSteps; $i++) { [Win32Ex]::mouse_event(0x0800, 0, 0, 120, 0); Start-Sleep -Milliseconds 60 }
  [System.Windows.Forms.SendKeys]::SendWait('{END}')
  Start-Sleep -Milliseconds 300
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
  for ($i=0; $i -lt 24; $i++) {
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

function ConvertBytesToJpegDataUrl([byte[]]$bytes, [int]$quality = 80) {
  try {
    $msIn = New-Object System.IO.MemoryStream($bytes)
    $img = [System.Drawing.Image]::FromStream($msIn)
    $jpgEnc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $q = [System.Drawing.Imaging.Encoder]::Quality
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($q, [int]$quality)
    $msOut = New-Object System.IO.MemoryStream
    $img.Save($msOut, $jpgEnc, $ep)
    $b64 = [Convert]::ToBase64String($msOut.ToArray())
    $img.Dispose(); $msIn.Dispose(); $msOut.Dispose()
    return "data:image/jpeg;base64,$b64"
  } catch { return $null }
}

function ConvertDataUrlToJpeg([string]$dataUrl, [int]$quality = 80) {
  try {
    $b64 = $dataUrl -replace '^data:image\/\w+;base64,',''
    $bytes = [Convert]::FromBase64String($b64)
    return ConvertBytesToJpegDataUrl $bytes $quality
  } catch { return $null }
}

Write-Host "Dual snapshot agent started. Uploading to $Url every $IntervalSeconds seconds" -ForegroundColor Green
while ($true) {
  try {
    $prev = [Win32]::GetForegroundWindow()
    $img1 = $null; $img2 = $null

    $okAny = Focus-Window $WindowTitle
    if (-not $okAny) { throw "TradingView window not found" }
    # 15m
    [System.Windows.Forms.SendKeys]::SendWait('15')
    Start-Sleep -Milliseconds 250
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Start-Sleep -Milliseconds $LoadDelayMs
    [System.Windows.Forms.SendKeys]::SendWait('%r')
    Start-Sleep -Milliseconds 300
    ZoomCenterAndAlignLatest $WindowTitle $ZoomSteps
    try { [System.Windows.Forms.Clipboard]::Clear() } catch {}
    [System.Windows.Forms.SendKeys]::SendWait('^+s')
    Start-Sleep -Milliseconds 350
    $img1 = Get-ClipboardPngDataUrl
    if (-not $img1) {
      [System.Windows.Forms.SendKeys]::SendWait('^%s')
      $img1 = Get-DownloadedPngDataUrl
    }
    if (-not $img1) { throw "15m snapshot failed" }
    # 1h (TV accepts 60 as 1-hour)
    [System.Windows.Forms.SendKeys]::SendWait('60')
    Start-Sleep -Milliseconds 250
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Start-Sleep -Milliseconds $LoadDelayMs
    [System.Windows.Forms.SendKeys]::SendWait('%r')
    Start-Sleep -Milliseconds 300
    ZoomCenterAndAlignLatest $WindowTitle $ZoomSteps
    try { [System.Windows.Forms.Clipboard]::Clear() } catch {}
    [System.Windows.Forms.SendKeys]::SendWait('^+s')
    Start-Sleep -Milliseconds 350
    $img2 = Get-ClipboardPngDataUrl
    if (-not $img2) {
      [System.Windows.Forms.SendKeys]::SendWait('^%s')
      $img2 = Get-DownloadedPngDataUrl
      if (-not $img2) {
        Start-Sleep -Milliseconds 600
        [System.Windows.Forms.SendKeys]::SendWait('^+s')
        Start-Sleep -Milliseconds 350
        $img2 = Get-ClipboardPngDataUrl
      }
    }
    if (-not $img2) { throw "1h snapshot failed" }

    try { [Win32]::SetForegroundWindow($prev) | Out-Null } catch {}

    $payload = @{ images = @($img1, $img2) } | ConvertTo-Json -Depth 3
    $payload = @{ images = @($img1, $img2) } | ConvertTo-Json -Depth 3
    Invoke-WebRequest -Uri $Url -Method Post -ContentType 'application/json' -Body $payload -ErrorAction Stop | Out-Null
    } catch {
      $urlSingle = $Url -replace 'snapshot-upload2','snapshot-upload'
      try {
        $payload1 = @{ image = $img1 } | ConvertTo-Json -Depth 3
        Invoke-WebRequest -Uri $urlSingle -Method Post -ContentType 'application/json' -Body $payload1 -ErrorAction Stop | Out-Null
        Start-Sleep -Milliseconds 300
        $payload2 = @{ image = $img2 } | ConvertTo-Json -Depth 3
        Invoke-WebRequest -Uri $urlSingle -Method Post -ContentType 'application/json' -Body $payload2 -ErrorAction Stop | Out-Null
      } catch { throw $_ }
    }
    Write-Host "Uploaded dual snapshot at $(Get-Date)" -ForegroundColor Cyan
  } catch {
    Write-Host "Upload failed: $_" -ForegroundColor Red
    Write-Host "Available window titles:" -ForegroundColor DarkGray
    try {
      Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -ExpandProperty MainWindowTitle | ForEach-Object { Write-Host " - $_" -ForegroundColor DarkGray }
    } catch {}
  }
  Start-Sleep -Seconds $IntervalSeconds
}
