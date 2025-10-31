const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { DateTime } = require("luxon");
require("dotenv").config();

/**
 * Bucket Logger - Saves logs to S3 bucket
 *
 * Required Environment Variables:
 * - AWS_ACCESS_KEY_ID: AWS access key ID
 * - AWS_SECRET_ACCESS_KEY: AWS secret access key
 * - AWS_REGION: AWS region (default: "us-east-1")
 * - AWS_S3_BUCKET_NAME: S3 bucket name (default: "igdb-logs")
 *
 * Folder structure in bucket: igdb-logs/tempdbto strapi/<date>/<log_file>.json
 * Date format: "oct31", "nov1", etc.
 */

// Validate AWS credentials before initializing S3 client
// Supports multiple naming conventions for flexibility
const validateAWSCredentials = () => {
  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
  // Support both AWS_SECRET_ACCESS_KEY and AWS_ACCESS_SECRET
  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_ACCESS_SECRET;

  if (!accessKeyId || accessKeyId.trim() === "") {
    throw new Error(
      "AWS_ACCESS_KEY_ID (or AWS_ACCESS_KEY) is not set or is empty in .env file"
    );
  }

  if (!secretAccessKey || secretAccessKey.trim() === "") {
    throw new Error(
      "AWS_SECRET_ACCESS_KEY (or AWS_ACCESS_SECRET) is not set or is empty in .env file"
    );
  }

  return {
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
  };
};

// Initialize S3 client with validated credentials
let s3Client;
try {
  const credentials = validateAWSCredentials();
  s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
} catch (error) {
  console.error("❌ AWS Credentials Error:", error.message);
  console.error("\n💡 Please add these to your .env file:");
  console.error("   AWS_ACCESS_KEY_ID=your_access_key");
  console.error(
    "   AWS_SECRET_ACCESS_KEY=your_secret_key (or AWS_ACCESS_SECRET)"
  );
  console.error("   AWS_REGION=us-east-1");
  console.error("   AWS_S3_BUCKET_NAME=igdb-logs (or AWS_BUCKET)");
}

// Support multiple bucket name variable names
const BUCKET_NAME =
  process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET || "igdb-logs";
const FOLDER_PATH = "tempdbto strapi";

/**
 * Get formatted date string (e.g., "oct31", "nov1")
 */
const getFormattedDate = () => {
  const now = DateTime.now();
  const month = now.toFormat("LLL").toLowerCase(); // "oct", "nov", etc.
  const day = now.toFormat("d"); // "31", "1", etc.
  return `${month}${day}`;
};

/**
 * Generate the single log file name for the day
 */
const getDailyLogFileName = () => {
  const now = DateTime.now();
  const dateStr = now.toFormat("yyyyMMdd");
  return `logs_${dateStr}.json`;
};

/**
 * Read existing logs from S3 for today
 */
const readExistingLogs = async () => {
  try {
    if (!s3Client) {
      return null;
    }

    const dateFolder = getFormattedDate();
    const fileName = getDailyLogFileName();
    const key = `${FOLDER_PATH}/${dateFolder}/${fileName}`;

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

    return JSON.parse(bodyString);
  } catch (error) {
    // File doesn't exist yet or other error - return null to create new
    if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
      return null;
    }
    console.error(`Warning: Could not read existing logs: ${error.message}`);
    return null;
  }
};

/**
 * Upload log to S3 bucket - accumulates all logs in a single JSON file per day
 * @param {string} logType - Type of log (e.g., "updatedDataWithSiteUrl", "updateData", "token", "error")
 * @param {any} data - Data to log
 * @param {object} additionalInfo - Additional metadata to include in log
 */
const uploadLogToBucket = async (logType, data, additionalInfo = {}) => {
  try {
    // Check if S3 client was initialized successfully
    if (!s3Client) {
      const errorMsg =
        "S3 client not initialized - AWS credentials missing or invalid";
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const dateFolder = getFormattedDate();
    const fileName = getDailyLogFileName();
    const key = `${FOLDER_PATH}/${dateFolder}/${fileName}`;

    // Read existing logs or create new structure
    let logsData = await readExistingLogs();

    if (!logsData) {
      // Create new log structure
      logsData = {
        date: dateFolder,
        created: DateTime.now().toISO(),
        logs: {
          updatedDataWithSiteUrl: [],
          updateData: [],
          token: [],
          error: [],
          igdbApiCall: [],
          processingSummary: [],
        },
      };
    }

    // Create log entry
    const logEntry = {
      timestamp: DateTime.now().toISO(),
      logType,
      data,
      ...additionalInfo,
    };

    // Add to appropriate array
    if (logsData.logs[logType]) {
      logsData.logs[logType].push(logEntry);
    } else {
      // If log type doesn't exist, create it
      logsData.logs[logType] = [logEntry];
    }

    // Update last modified timestamp
    logsData.lastUpdated = DateTime.now().toISO();
    logsData.totalLogs = Object.values(logsData.logs).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    // Upload updated logs
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(logsData, null, 2),
      ContentType: "application/json",
    };

    await s3Client.send(new PutObjectCommand(params));
    console.log(
      `✅ Log added to daily file: s3://${BUCKET_NAME}/${key} (${logType}: ${logsData.logs[logType].length} entries)`
    );
    return {
      success: true,
      key,
      fullPath: `s3://${BUCKET_NAME}/${key}`,
      logCount: logsData.totalLogs,
    };
  } catch (error) {
    let errorMessage = error.message;

    // Provide more helpful error messages
    if (
      error.name === "InvalidAccessKeyId" ||
      error.message.includes("credential")
    ) {
      errorMessage =
        "Invalid AWS credentials. Please check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file";
    } else if (error.name === "NoSuchBucket") {
      errorMessage = `Bucket '${BUCKET_NAME}' does not exist. Please create it or check AWS_S3_BUCKET_NAME in your .env file`;
    } else if (error.name === "AccessDenied") {
      errorMessage =
        "Access denied. Check your AWS IAM permissions for S3 write access";
    }

    console.error(`❌ Failed to upload log to bucket: ${errorMessage}`);
    // Don't throw - logging failure shouldn't break the main process
    return { success: false, error: errorMessage };
  }
};

/**
 * Log updatedDataWithSiteUrl
 */
const logUpdatedDataWithSiteUrl = async (
  updatedDataWithSiteUrl,
  context = {}
) => {
  return await uploadLogToBucket(
    "updatedDataWithSiteUrl",
    updatedDataWithSiteUrl,
    {
      context,
      recordCount: Array.isArray(updatedDataWithSiteUrl)
        ? updatedDataWithSiteUrl.length
        : 1,
    }
  );
};

/**
 * Log updateData sent to Strapi
 */
const logUpdateData = async (updateData, gameId, context = {}) => {
  return await uploadLogToBucket("updateData", updateData, {
    gameId,
    context,
    action: gameId ? "update" : "create",
  });
};

/**
 * Log token information (masked for security)
 */
const logToken = async (token, context = {}) => {
  const maskedToken = token
    ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}`
    : null;
  return await uploadLogToBucket(
    "token",
    {
      tokenPrefix: maskedToken,
      tokenLength: token ? token.length : 0,
      // Store full token only if needed - remove this line if you want to keep it masked
      // fullToken: token, // Uncomment if you need full token logged
    },
    context
  );
};

/**
 * Log errors
 */
const logError = async (error, context = {}) => {
  return await uploadLogToBucket(
    "error",
    {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(error.response && {
        response: {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        },
      }),
    },
    {
      ...context,
      errorType: "application_error",
    }
  );
};

/**
 * Log IGDB API calls
 */
const logIGDBCall = async (query, response, context = {}) => {
  return await uploadLogToBucket(
    "igdbApiCall",
    {
      query,
      responseSize: Array.isArray(response) ? response.length : 1,
      responseSample:
        Array.isArray(response) && response.length > 0 ? response[0] : response,
    },
    context
  );
};

/**
 * Log game processing summary
 */
const logProcessingSummary = async (summary, context = {}) => {
  return await uploadLogToBucket("processingSummary", summary, {
    ...context,
    summaryType: "game_processing",
  });
};

module.exports = {
  uploadLogToBucket,
  logUpdatedDataWithSiteUrl,
  logUpdateData,
  logToken,
  logError,
  logIGDBCall,
  logProcessingSummary,
};
