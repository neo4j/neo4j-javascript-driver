npm ci

$ErrorFound = $False

try
{
	If ($args.Length -gt 0)
	{
		$env:NEOCTRL_ARGS="$args"
	}

	npm run start-neo4j
	if($LastExitCode -ne 0) #failed to execute npm test without error
	{
		Write-Host "Unable to start neo4j"
		exit 1
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
	if($ErrorFound)
	{
		Write-Host "Exit with code 1"
		exit 1
	}
	Write-Host "Exit with code 0"
}
