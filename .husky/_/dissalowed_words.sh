git diff --cached --name-status | while read x file; do
        if [ "$x" == 'D' ]; then continue; fi
        if grep -rq --include $file  it.only ; then
                echo 'ERROR: Dissalowed it.only() in your tests in file: ${file}'
                exit 1
        fi
done || exit $?