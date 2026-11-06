#!/usr/bin/env bash
set -eo pipefail

REGION="${AWS_REGION:-ap-south-1}"
BUCKET_NAME="${AWS_S3_BUCKET:-your-app-face-storage}"
ROLE_NAME="VaultLivenessGuestRole"
LAMBDA_ROLE_NAME="VaultMediaProcessorRole"
LAMBDA_NAME="vault-media-processor"
IDENTITY_POOL_NAME="Liveliness"

echo "=========================================================="
echo "⚠️  VAULT OS — AWS COMPLETE TEARDOWN (COST ELIMINATION)"
echo "Region: $REGION | Bucket: $BUCKET_NAME"
echo "=========================================================="
read -p "Are you sure you want to delete all AWS resources? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# 1. DELETE ALL REKOGNITION COLLECTIONS
echo ">>> [1/5] Purging Rekognition Collections..."
COLLECTIONS=$(aws rekognition list-collections --region "$REGION" --query "CollectionIds[]" --output text 2>/dev/null || true)
if [ -n "$COLLECTIONS" ] && [ "$COLLECTIONS" != "None" ]; then
  for col in $COLLECTIONS; do
    echo "  - Deleting Collection: $col"
    aws rekognition delete-collection --collection-id "$col" --region "$REGION" >/dev/null 2>&1 || true
  done
else
  echo "  No Rekognition collections found."
fi

# 2. DELETE LAMBDA FUNCTION & ROLE (IF CREATED)
echo ">>> [2/5] Purging Media Processor Lambda..."
aws lambda delete-function --function-name "$LAMBDA_NAME" --region "$REGION" >/dev/null 2>&1 || true

# Delete Lambda IAM policies and role
aws iam delete-role-policy --role-name "$LAMBDA_ROLE_NAME" --policy-name "VaultProcessingPermissions" >/dev/null 2>&1 || true
aws iam detach-role-policy --role-name "$LAMBDA_ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" >/dev/null 2>&1 || true
aws iam delete-role --role-name "$LAMBDA_ROLE_NAME" >/dev/null 2>&1 || true

# 3. EMPTY AND DELETE S3 BUCKET (including aborting multipart uploads)
echo ">>> [3/5] Purging S3 Bucket ($BUCKET_NAME)..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
  echo "  - Aborting incomplete multipart uploads..."
  MULTIPARTS=$(aws s3api list-multipart-uploads --bucket "$BUCKET_NAME" --query "Uploads[].{Key:Key,UploadId:UploadId}" --output json 2>/dev/null || true)
  if [ "$MULTIPARTS" != "null" ] && [ -n "$MULTIPARTS" ]; then
    echo "$MULTIPARTS" | jq -c '.[]?' | while read -r item; do
      KEY=$(echo "$item" | jq -r '.Key')
      UPLOAD_ID=$(echo "$item" | jq -r '.UploadId')
      aws s3api abort-multipart-upload --bucket "$BUCKET_NAME" --key "$KEY" --upload-id "$UPLOAD_ID" >/dev/null 2>&1 || true
    done
  fi

  echo "  - Deleting all objects & versioned data..."
  aws s3 rm "s3://$BUCKET_NAME" --recursive >/dev/null 2>&1 || true

  # Also delete object versions if bucket had versioning
  VERSIONS=$(aws s3api list-object-versions --bucket "$BUCKET_NAME" --query "Versions[].{Key:Key,VersionId:VersionId}" --output json 2>/dev/null || true)
  if [ "$VERSIONS" != "null" ] && [ -n "$VERSIONS" ]; then
    echo "$VERSIONS" | jq -c '.[]?' | while read -r item; do
      KEY=$(echo "$item" | jq -r '.Key')
      VID=$(echo "$item" | jq -r '.VersionId')
      aws s3api delete-object --bucket "$BUCKET_NAME" --key "$KEY" --version-id "$VID" >/dev/null 2>&1 || true
    done
  fi

  echo "  - Deleting S3 bucket itself..."
  aws s3api delete-bucket --bucket "$BUCKET_NAME" --region "$REGION" >/dev/null 2>&1 || true
  echo "  Bucket deleted."
else
  echo "  Bucket does not exist."
fi

# 4. DELETE COGNITO IDENTITY POOL
echo ">>> [4/5] Purging Cognito Identity Pools..."
POOL_IDS=$(aws cognito-identity list-identity-pools --max-results 60 --region "$REGION" --query "IdentityPools[?IdentityPoolName=='$IDENTITY_POOL_NAME'].IdentityPoolId" --output text 2>/dev/null || true)
if [ -n "$POOL_IDS" ] && [ "$POOL_IDS" != "None" ]; then
  for pid in $POOL_IDS; do
    echo "  - Deleting Identity Pool: $pid"
    aws cognito-identity delete-identity-pool --identity-pool-id "$pid" --region "$REGION" >/dev/null 2>&1 || true
  done
else
  echo "  No Identity Pool matching '$IDENTITY_POOL_NAME' found."
fi

# 5. DELETE GUEST IAM ROLE
echo ">>> [5/5] Purging Guest IAM Role ($ROLE_NAME)..."
aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "VaultLivenessAccess" >/dev/null 2>&1 || true
aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "VaultAllowGuestLivenessStreaming" >/dev/null 2>&1 || true

# Detach any attached policies
ATTACHED_POLICIES=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null || true)
if [ -n "$ATTACHED_POLICIES" ]; then
  for p_arn in $ATTACHED_POLICIES; do
    aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "$p_arn" >/dev/null 2>&1 || true
  done
fi

aws iam delete-role --role-name "$ROLE_NAME" >/dev/null 2>&1 || true
echo "  IAM role deleted."

echo "=========================================================="
echo "✅  ALL AWS BILLABLE RESOURCES DELETED SUCCESSFULLY!"
echo "Your active infrastructure is now at $0 baseline."
echo "=========================================================="