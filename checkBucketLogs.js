const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { DateTime } = require("luxon");
require("dotenv").config();

/**
 * Script to check and list logs in the S3 bucket
 * Usage: node checkBucketLogs.js [date]
 * Example: node checkBucketLogs.js nov1
 */

// Support multiple naming conventions for AWS credentials
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
const secretAccessKey =
  process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_ACCESS_SECRET;

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

const BUCKET_NAME =
  process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET || "igdb-logs";
const FOLDER_PATH = "tempdbto strapi";

/**
 * Get formatted date string (e.g., "oct31", "nov1")
 */
const getFormattedDate = (dateInput) => {
  if (dateInput) {
    return dateInput.toLowerCase();
  }
  const now = DateTime.now();
  const month = now.toFormat("LLL").toLowerCase();
  const day = now.toFormat("d");
  return `${month}${day}`;
};

/**
 * Read and display the single daily log file
 */
async function readDailyLogFile(dateInput = null) {
  try {
    const dateFolder = getFormattedDate(dateInput);
    const now = DateTime.now();
    // Try to parse date or use today
    let dateStr;
    if (dateInput) {
      try {
        dateStr = DateTime.fromFormat(
          dateInput.replace(/(\w{3})(\d+)/, "$1 $2"),
          "LLL d"
        ).toFormat("yyyyMMdd");
      } catch {
        dateStr = now.toFormat("yyyyMMdd");
      }
    } else {
      dateStr = now.toFormat("yyyyMMdd");
    }

    const fileName = `logs_${dateStr}.json`;
    const key = `${FOLDER_PATH}/${dateFolder}/${fileName}`;

    console.log(`🔍 Checking logs in bucket: ${BUCKET_NAME}`);
    console.log(`📁 File: ${key}\n`);

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);

    // Convert stream to string
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const bodyString = Buffer.concat(chunks).toString("utf-8");
    const logsData = JSON.parse(bodyString);

    // Display log file info
    console.log(`✅ Found daily log file: ${fileName}\n`);
    console.log(`📅 Date: ${logsData.date}`);
    console.log(`🕐 Created: ${new Date(logsData.created).toLocaleString()}`);
    console.log(
      `🕐 Last Updated: ${new Date(logsData.lastUpdated).toLocaleString()}`
    );
    console.log(`📊 Total Log Entries: ${logsData.totalLogs || "N/A"}\n`);

    // Display logs by type
    console.log("📝 Logs by Type:\n");
    Object.keys(logsData.logs).forEach((logType) => {
      const entries = logsData.logs[logType];
      if (Array.isArray(entries) && entries.length > 0) {
        console.log(
          `   ${logType.toUpperCase()}: ${entries.length} entry/entries`
        );
        if (entries.length <= 3) {
          entries.forEach((entry, idx) => {
            console.log(
              `      ${idx + 1}. [${new Date(
                entry.timestamp
              ).toLocaleTimeString()}] ${logType}`
            );
          });
        } else {
          console.log(
            `      First: [${new Date(
              entries[0].timestamp
            ).toLocaleTimeString()}]`
          );
          console.log(
            `      Last: [${new Date(
              entries[entries.length - 1].timestamp
            ).toLocaleTimeString()}]`
          );
        }
      }
    });

    // Summary
    const fileSize = Buffer.byteLength(bodyString);
    console.log(`\n📊 Summary:`);
    console.log(`   File Size: ${(fileSize / 1024).toFixed(2)} KB`);
    console.log(`   Total Entries: ${logsData.totalLogs}`);
    console.log(
      `   Log Types: ${Object.keys(logsData.logs)
        .filter((k) => logsData.logs[k].length > 0)
        .join(", ")}`
    );
    console.log(`\n📍 To download the file, use AWS CLI:`);
    console.log(`   aws s3 cp s3://${BUCKET_NAME}/${key} ./`);
    console.log(`\n💡 All logs are now stored in a single file per day!`);

    return logsData;
  } catch (error) {
    if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
      console.log(`⚠️  No log file found for date: ${dateInput || "today"}`);
      console.log(
        `\n💡 Try running your process or test script to create logs:`
      );
      console.log(`   node testBucketLogging.js`);
      return null;
    }
    throw error;
  }
}

/**
 * List all log files in the bucket for a specific date
 */
async function listLogs(dateInput = null) {
  try {
    const dateFolder = getFormattedDate(dateInput);
    const prefix = `${FOLDER_PATH}/${dateFolder}/`;

    console.log(`🔍 Checking logs in bucket: ${BUCKET_NAME}`);
    console.log(`📁 Folder: ${prefix}\n`);

    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    };

    const command = new ListObjectsV2Command(params);
    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      console.log(`⚠️  No logs found for date: ${dateFolder}`);
      console.log(
        `\n💡 Try checking other dates or run the test script first:`
      );
      console.log(`   node testBucketLogging.js`);
      return;
    }

    console.log(`✅ Found ${response.Contents.length} log file(s):\n`);

    // Group logs by type
    const logsByType = {};
    response.Contents.forEach((object) => {
      const fileName = object.Key.split("/").pop();
      const logType = fileName.split("_")[0];

      if (!logsByType[logType]) {
        logsByType[logType] = [];
      }
      logsByType[logType].push({
        key: object.Key,
        fileName,
        size: object.Size,
        lastModified: object.LastModified,
      });
    });

    // Display logs grouped by type
    Object.keys(logsByType).forEach((logType) => {
      console.log(
        `📝 ${logType.toUpperCase()}: ${logsByType[logType].length} file(s)`
      );
      logsByType[logType].forEach((log, index) => {
        const date = new Date(log.lastModified);
        console.log(`   ${index + 1}. ${log.fileName}`);
        console.log(`      Size: ${(log.size / 1024).toFixed(2)} KB`);
        console.log(`      Time: ${date.toLocaleString()}`);
        console.log(`      Full path: s3://${BUCKET_NAME}/${log.key}`);
      });
      console.log("");
    });

    // Summary
    console.log("📊 Summary:");
    console.log(`   Total files: ${response.Contents.length}`);
    console.log(`   Log types: ${Object.keys(logsByType).join(", ")}`);
    console.log(`\n📍 To download a file, use AWS CLI:`);
    console.log(
      `   aws s3 cp s3://${BUCKET_NAME}/${response.Contents[0].Key} ./`
    );
  } catch (error) {
    console.error("❌ Error listing logs:", error.message);
    if (error.name === "NoSuchBucket") {
      console.error(`\n💡 The bucket '${BUCKET_NAME}' does not exist.`);
      console.error(
        "   Create it first or check your AWS_S3_BUCKET_NAME environment variable."
      );
    } else if (error.name === "AccessDenied") {
      console.error(
        `\n💡 Access denied. Check your AWS credentials and bucket permissions.`
      );
    } else {
      console.error("\n💡 Troubleshooting:");
      console.error("1. Check your .env file has correct AWS credentials");
      console.error("2. Verify the bucket exists and is accessible");
      console.error("3. Check your AWS IAM permissions");
    }
  }
}

/**
 * List all available date folders
 */
async function listDateFolders() {
  try {
    const prefix = `${FOLDER_PATH}/`;

    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      Delimiter: "/",
    };

    const command = new ListObjectsV2Command(params);
    const response = await s3Client.send(command);

    if (!response.CommonPrefixes || response.CommonPrefixes.length === 0) {
      console.log(`⚠️  No date folders found in ${prefix}`);
      return [];
    }

    console.log(`📅 Available date folders:\n`);
    const folders = response.CommonPrefixes.map((prefix) => {
      const folderName = prefix.Prefix.split("/").filter(Boolean).pop();
      return folderName;
    });

    folders.forEach((folder, index) => {
      console.log(`   ${index + 1}. ${folder}`);
    });

    return folders;
  } catch (error) {
    console.error("❌ Error listing date folders:", error.message);
    return [];
  }
}

// Main execution
async function main() {
  const dateInput = process.argv[2];

  if (dateInput === "--list" || dateInput === "-l") {
    await listDateFolders();
  } else {
    try {
      // Try to read the daily log file first (new format)
      const logData = await readDailyLogFile(dateInput);
      if (!logData) {
        // Fallback to old format listing
        await listLogs(dateInput);
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
      await listLogs(dateInput);
    }
  }
}

main();
