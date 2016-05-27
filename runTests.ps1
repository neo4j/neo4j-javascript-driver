npm install

$ErrorFound = $False

try
{
	If ($args.Length -eq 0)
	{
		npm run start-neo4j
	}
	else
	{
		npm run start-neo4j -- --neorun.start.args="$args"
	}

	npm test
	if(-Not ($?)) #failed to execute npm test
	{
		$ErrorFound = $True
	}
}
finally
{
	npm run stop-neo4j
	if($ErrorFound -eq $True)
	{
		Write-Host "Exit with code 1"
		exit 1
	}
	Write-Host "Exit with code 0"
}
