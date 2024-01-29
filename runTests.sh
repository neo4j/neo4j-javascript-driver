npm install -g gulp typescript jest

npm ci
npm run build -- --no-private

if [ -n "$2" ]; then
  export NEOCTRL_ARGS="$2"
fi

trap "npm run stop-neo4j" EXIT

npm run start-neo4j

if [ $? -ne 0 ]; then
  echo "Unable to start neo4j"
  exit 1
fi

npm test -- --no-private

if [ $? -eq 0 ]; then
  echo "Exit with code 0"
else
  echo "Exit with code 1"
  exit 1
fi
