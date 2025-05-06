//process all the games in the db

const connectDB = require("./db");
const Game = require("./game");

/**
 * Process and remove all game entries from the database
 * @param {Function} processFn - Function to process each game data
 * @returns {Promise<void>}
 */
const processAndRemoveAllGames = async (processFn) => {
  await connectDB();

  try {
    let processedCount = 0;
    let gameEntry;

    while ((gameEntry = await Game.findOne()) !== null) {
      console.log("Processing game:", gameEntry.name);
      await processFn(gameEntry);

      await Game.findByIdAndDelete(gameEntry._id);
      console.log("Game removed after processing:", gameEntry.name);

      processedCount++;
    }

    if (processedCount === 0) {
      console.log("No games found to process");
    } else {
      console.log(`Processed and removed ${processedCount} games`);
    }

  } catch (err) {
    console.error("Error processing games:", err);
  }
};

module.exports = processAndRemoveAllGames;
