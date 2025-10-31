require("dotenv").config();

/**
 * Script to verify AWS credentials are properly configured
 * Supports multiple naming conventions
 */

console.log("🔍 Checking AWS Credentials Configuration...\n");

// Check for credentials (support multiple naming conventions)
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
const secretAccessKey =
  process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_ACCESS_SECRET;
const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET;

const missingVars = [];

// Check Access Key ID
if (!accessKeyId || accessKeyId.trim() === "") {
  missingVars.push("AWS_ACCESS_KEY_ID (or AWS_ACCESS_KEY)");
  console.log(`❌ AWS_ACCESS_KEY_ID / AWS_ACCESS_KEY: NOT SET or EMPTY`);
} else {
  console.log(`✅ AWS_ACCESS_KEY_ID: ${accessKeyId}`);
}

// Check Secret Access Key
if (!secretAccessKey || secretAccessKey.trim() === "") {
  missingVars.push("AWS_SECRET_ACCESS_KEY (or AWS_ACCESS_SECRET)");
  console.log(`❌ AWS_SECRET_ACCESS_KEY / AWS_ACCESS_SECRET: NOT SET or EMPTY`);
} else {
  const masked =
    secretAccessKey.substring(0, 4) +
    "..." +
    secretAccessKey.substring(secretAccessKey.length - 4);
  console.log(
    `✅ AWS_SECRET_ACCESS_KEY / AWS_ACCESS_SECRET: ${masked} (${secretAccessKey.length} characters)`
  );
}

// Check Region
if (!region || region.trim() === "") {
  missingVars.push("AWS_REGION");
  console.log(`❌ AWS_REGION: NOT SET or EMPTY`);
} else {
  console.log(`✅ AWS_REGION: ${region}`);
}

// Check Bucket Name
if (!bucketName || bucketName.trim() === "") {
  missingVars.push("AWS_S3_BUCKET_NAME (or AWS_BUCKET)");
  console.log(`❌ AWS_S3_BUCKET_NAME / AWS_BUCKET: NOT SET or EMPTY`);
} else {
  console.log(`✅ AWS_S3_BUCKET_NAME / AWS_BUCKET: ${bucketName}`);
}

console.log("\n" + "=".repeat(60));

if (missingVars.length > 0) {
  console.log("\n❌ Missing or Empty Environment Variables:");
  missingVars.forEach((varName) => {
    console.log(`   - ${varName}`);
  });

  console.log(
    "\n💡 Your .env file should have one of these naming conventions:"
  );
  console.log("\n   Option 1 (Standard):");
  console.log("   AWS_ACCESS_KEY_ID=your_access_key");
  console.log("   AWS_SECRET_ACCESS_KEY=your_secret_key");
  console.log("   AWS_REGION=us-east-1");
  console.log("   AWS_S3_BUCKET_NAME=igdb-logs");

  console.log("\n   Option 2 (Alternative - what you have):");
  console.log("   AWS_ACCESS_KEY_ID=your_access_key");
  console.log("   AWS_ACCESS_SECRET=your_secret_key");
  console.log("   AWS_REGION=us-east-1");
  console.log("   AWS_BUCKET=igdb-logs");

  console.log("\n⚠️  The code now supports BOTH naming conventions!");

  process.exit(1);
} else {
  console.log("\n✅ All AWS credentials are configured!");
  console.log(`\n📝 Using bucket: ${bucketName}`);
  console.log("\n🚀 Next step: Run the test script to verify S3 access:");
  console.log("   node testBucketLogging.js");

  process.exit(0);
}
