npm install
npm run start-neo4j
npm test

if(-Not ($?)) #failed to execute npm test
{
    $ErrorFound = $True
}

npm run stop-neo4j

if($ErrorFound -eq $True)
{
	exit 1
}