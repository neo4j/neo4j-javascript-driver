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
		$env:NEOCTRL_ARGS="$args"
		npm run start-neo4j
	}

	npm test
	if($LastExitCode -ne 0) #failed to execute npm test without error
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
