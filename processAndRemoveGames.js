// const connectDB = require("./db");
// const Game = require("./game");
// const mongoose = require("mongoose");

// /**
//  * @param {Function} processFn
//  * @returns {Promise<void>}
//  */
// const processAndRemoveAllGames = async (processFn) => {
//   await connectDB();

//   try {
//     let processedCount = 0;
//     let gameEntry;

//     while ((gameEntry = await Game.findOne()) !== null) {
//       // Store the game ID before processing
//       const gameId = gameEntry._id;
//       const gameName = gameEntry.name;

//       console.log("Processing game:", gameName);

//       try {
//         // Process the game
//         await processFn(gameEntry);

//         // Remove the game using the stored ID
//         const deletedGame = await Game.findByIdAndDelete(gameId);

//         if (deletedGame) {
//           console.log("Game removed after processing:", gameName);
//           processedCount++;
//         } else {
//           console.warn(
//             `Failed to delete game with ID ${gameId} - game may have been deleted already`
//           );
//         }
//       } catch (processError) {
//         console.error(`Error processing game ${gameName}:`, processError);
//       }
//     }

//     if (processedCount === 0) {
//       console.log("No games found to process");
//       mongoose.disconnect();
//       console.log("db disconnect");
//       process.exit(0);
//     } else {
//       console.log(`Processed and removed ${processedCount} games`);
//     }
//   } catch (err) {
//     console.error("Error in processAndRemoveAllGames:", err);
//   }
// };

// module.exports = processAndRemoveAllGames;

const connectDB = require("./db");
const Game = require("./game");
const mongoose = require("mongoose");

const processAndRemoveAllGames = async (processFn, sortOrder = 1) => {
  await connectDB();

  try {
    let processedCount = 0;
    let gameEntry;

    while (
      (gameEntry = await Game.findOneAndUpdate(
        { processing: { $ne: true } },
        { $set: { processing: true } },
        { sort: { created_at: sortOrder }, new: true }
      ))
    ) {
      const gameId = gameEntry._id;
      const gameName = gameEntry.name;

      console.log("Processing game:", gameName);

      try {
        await processFn(gameEntry);
        await Game.findByIdAndDelete(gameId);

        console.log("Removed after processing:", gameName);
        processedCount++;
      } catch (err) {
        console.error(`Error processing game ${gameName}:`, err);
        await Game.findByIdAndUpdate(gameId, { $unset: { processing: "" } });
      }
    }

    console.log(
      processedCount === 0
        ? "No games found to process"
        : `Processed and removed ${processedCount} games`
    );
  } catch (err) {
    console.error("Error in processAndRemoveAllGames:", err);
  } finally {
    await mongoose.disconnect();
    console.log("DB disconnected");
    process.exit(0);
  }
};

module.exports = processAndRemoveAllGames;
