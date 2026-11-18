@echo off
setlocal
title Install Poker Night
set "SRC=%~dp0App Files"
if not exist "%SRC%\Poker Night.exe" goto notextracted
tasklist /FI "IMAGENAME eq Poker Night.exe" | find /I "Poker Night.exe" >nul && goto stillopen
set "DEST=%LOCALAPPDATA%\Programs\Poker Night"
echo.
echo Installing Poker Night. This takes a few seconds...
robocopy "%SRC%" "%DEST%" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto copyfailed
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=$env:DEST; Get-ChildItem -LiteralPath $d -Recurse -File | Unblock-File; $w=New-Object -ComObject WScript.Shell; foreach($f in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){$s=$w.CreateShortcut((Join-Path $f 'Poker Night.lnk')); $s.TargetPath=(Join-Path $d 'Poker Night.exe'); $s.WorkingDirectory=$d; $s.IconLocation=(Join-Path $d 'resources\app\assets\icon.ico'); $s.Save()}"
if errorlevel 1 goto noshortcut
start "" "%DEST%\Poker Night.exe"
echo.
echo All done. Poker Night is opening now.
echo From now on, use the Poker Night icon on your desktop.
echo.
echo You can close this window.
echo.
pause
exit /b 0

:noshortcut
start "" "%DEST%\Poker Night.exe"
echo.
echo Poker Night is installed and opening, but the desktop icon could not be made.
echo You can find Poker Night in this folder:
echo %DEST%
echo.
pause
exit /b 1

:notextracted
echo.
echo The installer needs to be unzipped first.
echo.
echo Close this window. Right-click the Poker Night zip file, choose Extract All,
echo click Extract, then run Install Poker Night from the new folder.
echo.
pause
exit /b 1

:stillopen
echo.
echo Poker Night is still open. Close it, then run this installer again.
echo Your records are safe.
echo.
pause
exit /b 1

:copyfailed
echo.
echo Poker Night could not be copied onto this computer.
echo Restart the computer and try again. Your records are safe.
echo.
pause
exit /b 1
