disallowed="\.only\("


git diff --cached --name-status | while read x file; do
        if [ "$x" == 'D' ]; then continue; fi
            if egrep $dissalowed $file ; then
                echo "ERROR: Disallowed expression \"${word}\" in file: ${file}"
                exit 1
            fi
done || exit $?