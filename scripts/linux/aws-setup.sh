#!/usr/bin/env bash
set -eo pipefail

REGION="${AWS_REGION:-ap-south-1}"
BUCKET_NAME="${AWS_S3_BUCKET:-your-app-face-storage}"
ROLE_NAME="VaultLivenessGuestRole"
IDENTITY_POOL_NAME="Liveliness"

echo "=========================================================="
echo "🚀  VAULT OS — PROVISIONING COMPLETE AWS ENVIRONMENT"
echo "Region: $REGION | Bucket: $BUCKET_NAME"
echo "=========================================================="

# 1. CREATE S3 BUCKET (Private)
echo ">>> [1/4] Configuring S3 Bucket..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
  echo "  - Bucket $BUCKET_NAME already exists."
else
  echo "  - Creating S3 bucket $BUCKET_NAME..."
  if [ "$REGION" == "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
fi

# Block Public Access strictly
aws s3api put-public-access-block --bucket "$BUCKET_NAME" --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" >/dev/null

# Set CORS for client PUT uploads & previews
echo "  - Applying CORS configuration..."
aws s3api put-bucket-cors --bucket "$BUCKET_NAME" --region "$REGION" --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD", "DELETE"],
      "AllowedOrigins": [
        "http://localhost:3000",
        "http://localhost:4000",
        "https://*.vercel.app",
        "https://*.ngrok-free.app"
      ],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}'
echo "  - S3 configuration complete."

# 2. CREATE COGNITO IDENTITY POOL
echo ">>> [2/4] Configuring Cognito Identity Pool ($IDENTITY_POOL_NAME)..."
POOL_ID=$(aws cognito-identity list-identity-pools --max-results 60 --region "$REGION" \
  --query "IdentityPools[?IdentityPoolName=='$IDENTITY_POOL_NAME'].IdentityPoolId" --output text 2>/dev/null || true)

if [ -z "$POOL_ID" ] || [ "$POOL_ID" == "None" ]; then
  echo "  - Creating new Identity Pool..."
  POOL_ID=$(aws cognito-identity create-identity-pool \
    --identity-pool-name "$IDENTITY_POOL_NAME" \
    --allow-unauthenticated-identities \
    --region "$REGION" \
    --query "IdentityPoolId" --output text)
else
  echo "  - Reusing existing Identity Pool: $POOL_ID"
fi

# 3. CREATE GUEST IAM ROLE
echo ">>> [3/4] Configuring Guest IAM Role ($ROLE_NAME)..."
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "$POOL_ID"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "unauthenticated"
        }
      }
    }
  ]
}
EOF
)

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "  - Updating role trust policy..."
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST_POLICY" >/dev/null
else
  echo "  - Creating role $ROLE_NAME..."
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY" >/dev/null
fi

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query "Role.Arn" --output text)

# Attach Face Liveness streaming permissions to the guest role
echo "  - Attaching Face Liveness permissions to guest role..."
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "VaultLivenessAccess" --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "VaultGuestFaceLivenessStream",
      "Effect": "Allow",
      "Action": [
        "rekognition:StartFaceLivenessSession"
      ],
      "Resource": "*"
    }
  ]
}' >/dev/null

# Bind Role to Identity Pool
echo "  - Binding guest role to Identity Pool..."
aws cognito-identity set-identity-pool-roles \
  --identity-pool-id "$POOL_ID" \
  --roles "unauthenticated=$ROLE_ARN" \
  --region "$REGION" >/dev/null

# 4. REKOGNITION NOTE
echo ">>> [4/4] Rekognition Collections..."
echo "  - Rekognition collections are automatically instantiated per event on demand."

echo "=========================================================="
echo "🎉 SETUP COMPLETE!"
echo "Put these lines in your local .env and Vercel dashboard:"
echo "----------------------------------------------------------"
echo "AWS_REGION=\"$REGION\""
echo "AWS_S3_BUCKET=\"$BUCKET_NAME\""
echo "NEXT_PUBLIC_AWS_REGION=\"$REGION\""
echo "NEXT_PUBLIC_AWS_IDENTITY_POOL_ID=\"$POOL_ID\""
echo "=========================================================="