npm install -g gulp typescript jest esdoc
                    
Set-Location -Path .\core
npm ci
npm run build
Set-Location -Path ..\bolt-connection
npm ci
npm run build
Set-Location -Path ..
npm ci

Set-Location -Path .\core
npm test 
Set-Location -Path ..\bolt-connection
npm test

Set-Location -Path .\neo4j-driver-lite
npm ci
npm run build
npm test

Set-Location -Path ..

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
