# Set error action
$ErrorActionPreference = "Stop"

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-south-1" }
$BucketName = if ($env:AWS_S3_BUCKET) { $env:AWS_S3_BUCKET } else { "your-app-face-storage" }
$RoleName = "VaultLivenessGuestRole"
$IdentityPoolName = "Liveliness"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🚀  VAULT OS — PROVISIONING AWS ENVIRONMENT (WINDOWS)" -ForegroundColor Cyan
Write-Host "Region: $Region | Bucket: $BucketName"
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. CREATE S3 BUCKET
Write-Host "`n>>> [1/4] Configuring S3 Bucket..." -ForegroundColor Yellow
$bucketCheck = aws s3api head-bucket --bucket $BucketName --region $Region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  - Bucket '$BucketName' already exists." -ForegroundColor Green
} else {
    Write-Host "  - Creating S3 bucket '$BucketName'..."
    if ($Region -eq "us-east-1") {
        aws s3api create-bucket --bucket $BucketName --region $Region | Out-Null
    } else {
        aws s3api create-bucket --bucket $BucketName --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
    }
}

# Block all public access
aws s3api put-public-access-block --bucket $BucketName --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" | Out-Null

# Apply CORS config
Write-Host "  - Applying CORS configuration..."
$corsConfig = @{
    CORSRules = @(
        @{
            AllowedHeaders = @("*")
            AllowedMethods = @("GET", "PUT", "POST", "HEAD", "DELETE")
            AllowedOrigins = @("http://localhost:3000", "http://localhost:4000", "https://vault-os-xi.vercel.app", "https://*.vercel.app", "https://*.ngrok-free.app")
            ExposeHeaders  = @("ETag", "x-amz-request-id")
            MaxAgeSeconds  = 3600
        }
    )
} | ConvertTo-Json -Depth 5 -Compress

aws s3api put-bucket-cors --bucket $BucketName --region $Region --cors-configuration $corsConfig | Out-Null
Write-Host "  - S3 configuration complete." -ForegroundColor Green

# 2. CREATE COGNITO IDENTITY POOL
Write-Host "`n>>> [2/4] Configuring Cognito Identity Pool ($IdentityPoolName)..." -ForegroundColor Yellow
$pools = aws cognito-identity list-identity-pools --max-results 60 --region $Region --output json | ConvertFrom-Json
$existingPool = $pools.IdentityPools | Where-Object { $_.IdentityPoolName -eq $IdentityPoolName } | Select-Object -First 1

if ($existingPool) {
    $PoolId = $existingPool.IdentityPoolId
    Write-Host "  - Reusing existing pool: $PoolId" -ForegroundColor Green
} else {
    Write-Host "  - Creating new Identity Pool..."
    $newPool = aws cognito-identity create-identity-pool --identity-pool-name $IdentityPoolName --allow-unauthenticated-identities --region $Region --output json | ConvertFrom-Json
    $PoolId = $newPool.IdentityPoolId
    Write-Host "  - Created pool: $PoolId" -ForegroundColor Green
}

# 3. CREATE GUEST IAM ROLE
Write-Host "`n>>> [3/4] Configuring Guest IAM Role ($RoleName)..." -ForegroundColor Yellow

$trustPolicy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Principal = @{ Federated = "cognito-identity.amazonaws.com" }
            Action = "sts:AssumeRoleWithWebIdentity"
            Condition = @{
                StringEquals = @{ "cognito-identity.amazonaws.com:aud" = $PoolId }
                "ForAnyValue:StringLike" = @{ "cognito-identity.amazonaws.com:amr" = "unauthenticated" }
            }
        }
    )
} | ConvertTo-Json -Depth 5 -Compress

$roleExists = aws iam get-role --role-name $RoleName 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  - Updating trust policy..."
    aws iam update-assume-role-policy --role-name $RoleName --policy-document $trustPolicy | Out-Null
} else {
    Write-Host "  - Creating role $RoleName..."
    aws iam create-role --role-name $RoleName --assume-role-policy-document $trustPolicy | Out-Null
}

$roleArn = (aws iam get-role --role-name $RoleName --output json | ConvertFrom-Json).Role.Arn

# Attach Face Liveness policy
Write-Host "  - Attaching Face Liveness permissions..."
$livenessPolicy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Sid = "VaultGuestFaceLivenessStream"
            Effect = "Allow"
            Action = @("rekognition:StartFaceLivenessSession")
            Resource = "*"
        }
    )
} | ConvertTo-Json -Depth 5 -Compress

aws iam put-role-policy --role-name $RoleName --policy-name "VaultLivenessAccess" --policy-document $livenessPolicy | Out-Null

# Link Role to Identity Pool
Write-Host "  - Binding role to Cognito..."
aws cognito-identity set-identity-pool-roles --identity-pool-id $PoolId --roles "unauthenticated=$roleArn" --region $Region | Out-Null

# 4. REKOGNITION NOTICE
Write-Host "`n>>> [4/4] Rekognition Collections..." -ForegroundColor Yellow
Write-Host "  - Collections are auto-instantiated on demand per event." -ForegroundColor DarkGray

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "🎉 PROVISIONING COMPLETE!" -ForegroundColor Green
Write-Host "Add these to your .env and Vercel environment variables:" -ForegroundColor White
Write-Host "----------------------------------------------------------"
Write-Host "AWS_REGION=`"$Region`""
Write-Host "AWS_S3_BUCKET=`"$BucketName`""
Write-Host "NEXT_PUBLIC_AWS_REGION=`"$Region`""
Write-Host "NEXT_PUBLIC_AWS_IDENTITY_POOL_ID=`"$PoolId`""
Write-Host "==========================================================" -ForegroundColor Green