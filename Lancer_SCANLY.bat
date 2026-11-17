@echo off
title SCANLY
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serveur.ps1"
