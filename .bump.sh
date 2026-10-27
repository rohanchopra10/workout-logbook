#!/bin/sh
# Bump the app version so phones auto-update on next open.
V=$(date -u +%Y%m%d%H%M%S)
sed -i "s/const APP_VER='[^']*';/const APP_VER='$V';/" index.html
echo "APP_VER=$V"
