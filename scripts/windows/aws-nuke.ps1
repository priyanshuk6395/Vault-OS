$ErrorActionPreference = "Continue"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

# 1. Parse .env file if present in current directory
$envFile = Join-Path (Get-Location) ".env"
$envMap = @{}
if (Test-Path $envFile) {
    Write-Host "Found .env file. Loading configuration..." -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $key = $parts[0].Trim()
            $val = $parts[1].Trim().Trim('"').Trim("'")
            $envMap[$key] = $val
        }
    }
}

$Region = if ($envMap["AWS_REGION"]) { $envMap["AWS_REGION"] } elseif ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-south-1" }
$BucketName = if ($envMap["AWS_S3_BUCKET"]) { $envMap["AWS_S3_BUCKET"] } elseif ($env:AWS_S3_BUCKET) { $env:AWS_S3_BUCKET } else { "your-app-face-storage" }
$RoleName = "VaultLivenessGuestRole"
$LambdaRoleName = "VaultMediaProcessorRole"
$LambdaName = "vault-media-processor"
$IdentityPoolName = "Liveliness"

Write-Host "==========================================================" -ForegroundColor Red
Write-Host "VAULT OS - AWS VERBOSE PURGE SCRIPT" -ForegroundColor Red
Write-Host "Target Region : $Region" -ForegroundColor Yellow
Write-Host "Target Bucket : $BucketName" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Red

# 1. DELETE REKOGNITION COLLECTIONS
Write-Host "`n>>> [1/5] Listing and Purging Rekognition Collections..." -ForegroundColor Cyan
$rawCollections = (aws rekognition list-collections --region $Region --query "CollectionIds" --output json 2>$null | ConvertFrom-Json)
if ($rawCollections -and $rawCollections.Count -gt 0) {
    foreach ($col in $rawCollections) {
        Write-Host "  -> Deleting Rekognition Collection: $col" -ForegroundColor Yellow
        aws rekognition delete-collection --collection-id "$col" --region $Region 2>&1 | Out-Null
    }
} else {
    Write-Host "  No Rekognition collections detected." -ForegroundColor DarkGray
}

# 2. DELETE LAMBDA & ROLE
Write-Host "`n>>> [2/5] Purging Lambda Processor..." -ForegroundColor Cyan
aws lambda delete-function --function-name $LambdaName --region $Region 2>&1 | Out-Null
aws iam delete-role-policy --role-name $LambdaRoleName --policy-name "VaultProcessingPermissions" 2>&1 | Out-Null
aws iam detach-role-policy --role-name $LambdaRoleName --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" 2>&1 | Out-Null
aws iam delete-role --role-name $LambdaRoleName 2>&1 | Out-Null
Write-Host "  Lambda and processor role purged." -ForegroundColor DarkGray

# 3. EMPTY AND DELETE S3 BUCKET
Write-Host "`n>>> [3/5] Inspecting S3 Bucket: $BucketName..." -ForegroundColor Cyan
$bucketCheck = aws s3api head-bucket --bucket $BucketName --region $Region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  - Aborting multipart uploads..." -ForegroundColor Yellow
    $multipartRaw = (aws s3api list-multipart-uploads --bucket $BucketName --query "Uploads[].{Key:Key,UploadId:UploadId}" --output json 2>$null | ConvertFrom-Json)
    if ($multipartRaw) {
        foreach ($u in $multipartRaw) {
            aws s3api abort-multipart-upload --bucket $BucketName --key $u.Key --upload-id $u.UploadId 2>&1 | Out-Null
        }
    }

    Write-Host "  - Deleting all objects in bucket..." -ForegroundColor Yellow
    aws s3 rm "s3://$BucketName" --recursive 2>&1

    Write-Host "  - Purging versions and delete markers..." -ForegroundColor Yellow
    $versionsRaw = (aws s3api list-object-versions --bucket $BucketName --output json 2>$null | ConvertFrom-Json)
    if ($versionsRaw) {
        if ($versionsRaw.Versions) {
            foreach ($v in $versionsRaw.Versions) {
                aws s3api delete-object --bucket $BucketName --key $v.Key --version-id $v.VersionId 2>&1 | Out-Null
            }
        }
        if ($versionsRaw.DeleteMarkers) {
            foreach ($d in $versionsRaw.DeleteMarkers) {
                aws s3api delete-object --bucket $BucketName --key $d.Key --version-id $d.VersionId 2>&1 | Out-Null
            }
        }
    }

    Write-Host "  - Deleting bucket $BucketName..." -ForegroundColor Yellow
    aws s3api delete-bucket --bucket $BucketName --region $Region 2>&1
    Write-Host "  Bucket deleted successfully." -ForegroundColor Green
} else {
    Write-Host "  Bucket '$BucketName' was not found or is already deleted." -ForegroundColor DarkGray
}

# 4. DELETE COGNITO IDENTITY POOL
Write-Host "`n>>> [4/5] Searching Cognito Identity Pools..." -ForegroundColor Cyan
$poolsRaw = (aws cognito-identity list-identity-pools --max-results 60 --region $Region --output json 2>$null | ConvertFrom-Json)
if ($poolsRaw -and $poolsRaw.IdentityPools) {
    $matchedPools = $poolsRaw.IdentityPools | Where-Object { $_.IdentityPoolName -eq $IdentityPoolName }
    foreach ($p in $matchedPools) {
        Write-Host "  -> Deleting Identity Pool: $($p.IdentityPoolId) ($($p.IdentityPoolName))" -ForegroundColor Yellow
        aws cognito-identity delete-identity-pool --identity-pool-id $p.IdentityPoolId --region $Region 2>&1 | Out-Null
    }
} else {
    Write-Host "  No Cognito Identity Pools found." -ForegroundColor DarkGray
}

# 5. DELETE GUEST IAM ROLE
Write-Host "`n>>> [5/5] Purging Guest IAM Role ($RoleName)..." -ForegroundColor Cyan
aws iam delete-role-policy --role-name $RoleName --policy-name "VaultLivenessAccess" 2>&1 | Out-Null
aws iam delete-role-policy --role-name $RoleName --policy-name "VaultAllowGuestLivenessStreaming" 2>&1 | Out-Null

$attachedPolicies = (aws iam list-attached-role-policies --role-name $RoleName --output json 2>$null | ConvertFrom-Json)
if ($attachedPolicies -and $attachedPolicies.AttachedPolicies) {
    foreach ($p in $attachedPolicies.AttachedPolicies) {
        aws iam detach-role-policy --role-name $RoleName --policy-arn $p.PolicyArn 2>&1 | Out-Null
    }
}
aws iam delete-role --role-name $RoleName 2>&1 | Out-Null
Write-Host "  IAM check completed." -ForegroundColor DarkGray

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "Purge complete. Verification query running..." -ForegroundColor Green
Write-Host "Collections remaining:" -ForegroundColor Cyan
aws rekognition list-collections --region $Region --output table
Write-Host "Buckets remaining:" -ForegroundColor Cyan
aws s3 ls
Write-Host "==========================================================" -ForegroundColor Green