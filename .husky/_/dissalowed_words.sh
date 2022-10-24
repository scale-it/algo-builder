disallowed="/.only/("

git diff --cached --name-status | while read x file; do
        if [ "$x" == 'D' ]; then continue; fi
        for word in $disallowed
        do
            if egrep $word $file ; then
                echo "ERROR: Disallowed expression \"${word}\" in file: ${file}"
                exit 1
            fi
        done
done || exit $?