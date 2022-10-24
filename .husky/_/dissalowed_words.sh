#!/opt/homebrew/bin/bash
COLOR_REST="$(tput sgr0)"
COLOR_MAGENTA="$(tput setaf 4)"
COLOR_RED="$(tput setaf 1)"
COLOR_YELLOW="$(tput setaf 3)"
status=0
set +o posix
while read x file; do
    if [ "$x" == 'D' ]; then continue; fi
    if ! [[ "${file: -3}" == ".ts" ]] || [[ "${file: -3}" == ".js" ]]; then continue; fi
    if grep -E -q "\.only\(" "$file" ; then
        printf "%40s\n" "${COLOR_RED}ERROR:${COLOR_REST} Disallowed expression${COLOR_YELLOW} .only()${COLOR_REST} in file: $COLOR_MAGENTA${file}$COLOR_REST"
        status=1 
    fi
done < <(git diff --cached --name-status);
exit $status