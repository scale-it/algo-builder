RED='\033[0;31m'
NC='\033[0m' # No Color
PURPLE='\033[0;35m'
YELLOW='\033[1;33m'
failing=0;

git diff --cached --name-status | while read x file; do
    if [ "$x" == 'D' ]; then continue; fi
    if ! [[ ${file: -3} == ".ts" ]]; then echo "przeszło"; fi
    if egrep -q "\.only\(" $file ; then
        echo "${RED}ERROR:${NC} Disallowed expression ${YELLOW}.only()${NC} in file: ${PURPLE}${file}${NC}"
        ((failing+=1));
    fi
done
if [ $failing != 0 ]; then exit 1; else exit 0; fi
exit;