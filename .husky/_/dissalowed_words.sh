RED='\033[0;31m'
NC='\033[0m' # No Color
PURPLE='\033[0;35m'
YELLOW='\033[1;33m'
status=0;

git diff --cached --name-status | while read x file; do
    if [ "$x" == 'D' ]; then continue; fi
        if egrep -q "\.only\(" $file ; then
            echo "${RED}ERROR:${NC} Disallowed expression ${YELLOW}.only()${NC} in file: ${PURPLE}${file}${NC}"
            status=1;
        fi
done
echo "value of status ${status}"
exit $status