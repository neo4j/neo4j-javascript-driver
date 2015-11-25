Try
{
    npm install
    npm run start-neo4j
    npm test
}
Catch [system.exception]
{
    "Error found while running tests"
}
Finally
{
    npm run stop-neo4j
}