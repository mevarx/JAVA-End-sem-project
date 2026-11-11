@echo off
set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.10.7-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
call mvnw.cmd %*
