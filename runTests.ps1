param(
[string]$input
)

npm installs

If ($input)
{
	npm run start-neo4j -- --neorun.start.args=\'"$input"\'
}
else
{
	npm run start-neo4j
}
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
