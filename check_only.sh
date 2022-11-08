#!/bin/bash
COLOR_REST="$(tput sgr0)"
COLOR_MAGENTA="$(tput setaf 5)"
COLOR_RED="$(tput setaf 1)"
COLOR_YELLOW="$(tput setaf 3)"
status=0

print "Running check for .only expression in staged files"
for file in $(git diff HEAD  --staged --name-only);
do
    if [ "${file: -3}" != ".ts" ] && [ "${file: -3}" != ".js" ]; then continue; fi
    for line in $(grep -in -E "\.only\("  "$file" | cut -f1 -d:);
    do
        printf "%40s\n" "${COLOR_RED}ERROR:${COLOR_REST} Disallowed expression${COLOR_YELLOW} .only()${COLOR_REST} in file: $COLOR_MAGENTA${line}:${file}$COLOR_REST"
        status=1 
    done
done
exit $status
