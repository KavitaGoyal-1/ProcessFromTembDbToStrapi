const {
  logUpdatedDataWithSiteUrl,
  logUpdateData,
  logToken,
  logError,
  logIGDBCall,
  logProcessingSummary,
} = require("./bucketLogger");

/**
 * Test script to verify bucket logging functionality
 * Run this with: node testBucketLogging.js
 */

async function testBucketLogging() {
  console.log("🧪 Starting bucket logging tests...\n");

  try {
    // Test 1: Log token
    console.log("1️⃣ Testing token logging...");
    const testToken = "test_token_12345abcdefghijklmnopqrstuvwxyz";
    const tokenResult = await logToken(testToken, {
      source: "testBucketLogging",
      test: true,
    });
    console.log("✅ Token log result:", tokenResult);
    console.log("");

    // Test 2: Log updatedDataWithSiteUrl
    console.log("2️⃣ Testing updatedDataWithSiteUrl logging...");
    const testUpdatedData = [
      {
        id: 123,
        name: "Test Game",
        url: "https://www.igdb.com/games/test-game",
      },
      {
        id: 456,
        name: "Another Test Game",
        url: "https://www.igdb.com/games/another-test-game",
      },
    ];
    const updatedDataResult = await logUpdatedDataWithSiteUrl(testUpdatedData, {
      source: "testBucketLogging",
      test: true,
    });
    console.log("✅ UpdatedDataWithSiteUrl log result:", updatedDataResult);
    console.log("");

    // Test 3: Log updateData
    console.log("3️⃣ Testing updateData logging...");
    const testUpdateData = {
      data: {
        title: "Test Game Title",
        slug: "test-game-slug",
        site_url: "https://www.igdb.com/games/test-game",
      },
    };
    const updateDataResult = await logUpdateData(testUpdateData, 999, {
      source: "testBucketLogging",
      test: true,
    });
    console.log("✅ UpdateData log result:", updateDataResult);
    console.log("");

    // Test 4: Log IGDB API call
    console.log("4️⃣ Testing IGDB API call logging...");
    const testIGDBResponse = [{ id: 123, name: "Test Game" }];
    const igdbResult = await logIGDBCall(
      "fields name,id; where id = 123;",
      testIGDBResponse,
      {
        source: "testBucketLogging",
        test: true,
      }
    );
    console.log("✅ IGDB API call log result:", igdbResult);
    console.log("");

    // Test 5: Log processing summary
    console.log("5️⃣ Testing processing summary logging...");
    const summaryResult = await logProcessingSummary(
      {
        gamesProcessed: 2,
        gamesCreated: 1,
        gamesUpdated: 1,
        test: true,
      },
      {
        source: "testBucketLogging",
      }
    );
    console.log("✅ Processing summary log result:", summaryResult);
    console.log("");

    // Test 6: Log error
    console.log("6️⃣ Testing error logging...");
    const testError = new Error("This is a test error");
    const errorResult = await logError(testError, {
      source: "testBucketLogging",
      test: true,
    });
    console.log("✅ Error log result:", errorResult);
    console.log("");

    console.log("🎉 All tests completed!");
    console.log("\n📋 Next steps:");
    console.log("1. Check your S3 bucket: igdb-logs");
    console.log("2. Navigate to: tempdbto strapi/<today's date>/");
    console.log("3. You should see JSON files with timestamps");
    console.log("4. Download and open any JSON file to verify the data");
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("\n💡 Troubleshooting:");
    console.error("1. Check your .env file has these variables:");
    console.error("   - AWS_ACCESS_KEY_ID");
    console.error("   - AWS_SECRET_ACCESS_KEY");
    console.error("   - AWS_REGION");
    console.error(
      "   - AWS_S3_BUCKET_NAME (optional, defaults to 'igdb-logs')"
    );
    console.error("2. Verify your AWS credentials have S3 write permissions");
    console.error(
      "3. Make sure the bucket 'igdb-logs' exists and is accessible"
    );
  }
}

// Run the tests
testBucketLogging();
