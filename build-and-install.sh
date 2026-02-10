#!/bin/bash
set -e

INSTALL_ONLY=false
if [[ "$1" == "-i" || "$1" == "--install-only" ]]; then
    INSTALL_ONLY=true
fi

get_vsix_name() {
    node -e "const p=require('./package.json'); console.log(p.name+'-'+p.version+'.vsix')"
}

if [ "$INSTALL_ONLY" = false ]; then
    echo -e "\033[36m=== Building extension ===\033[0m"
    npm run build
    vsix=$(get_vsix_name)
else
    echo -e "\033[33m=== Skipping build ===\033[0m"
    vsix=$(get_vsix_name)
fi

echo -e "\033[36m=== Packaging $vsix ===\033[0m"
npm run package -- --allow-missing-repository --no-dependencies

echo -e "\033[36m=== Installing $vsix ===\033[0m"
/opt/homebrew/bin/code --install-extension "$vsix" --force

echo -e "\033[32m=== Done! Reload VS Code to use the updated extension. ===\033[0m"
