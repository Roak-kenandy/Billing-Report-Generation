// const mongoose = require('mongoose');
// const dotenv = require('dotenv');

// dotenv.config();

// let mtvConnection;

// // Connect to CRM database (default connection)
// async function connectCRM() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log('Connected to CRM MongoDB Atlas (default connection)');
//   } catch (err) {
//     console.error('Could not connect to CRM MongoDB Atlas', err);
//     process.exit(1);
//   }
// }

// // Connect to MTV database
// async function connectMTV() {
//   try {
//     // Use MTV_MONGO_URI if provided, else assume same cluster with 'MTV' database
//     const mtvUri = process.env.MTV_MONGO_URI || process.env.MONGO_URI.replace('CRM', 'MTV');
//     mtvConnection = mongoose.createConnection(mtvUri, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     await mtvConnection.asPromise(); // Ensure connection is established
//     console.log('Connected to MTV MongoDB Atlas');
//     return mtvConnection;
//   } catch (err) {
//     console.error('Could not connect to MTV MongoDB Atlas', err);
//     process.exit(1);
//   }
// }

// // Initialize both connections
// async function connectDB() {
//   try {
//     await Promise.all([connectCRM(), connectMTV()]);
//   } catch (err) {
//     console.error('Failed to initialize database connections', err);
//     process.exit(1);
//   }
// }

// // Getters for connections
// function getCRMConnection() {
//   if (!mongoose.connection || mongoose.connection.readyState !== 1) {
//     throw new Error('CRM connection not initialized');
//   }
//   return mongoose.connection;
// }

// function getMTVConnection() {
//   if (!mtvConnection) {
//     throw new Error('MTV connection not initialized');
//   }
//   return mtvConnection;
// }

// module.exports = {
//   connectDB,
//   getCRMConnection,
//   getMTVConnection,
// };


const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

let mtvConnection;

// Connect to CRM database (default connection)
async function connectCRM() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 50, // Adjust based on workload
      connectTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 60000, // 60 seconds socket timeout
    });
    console.log('Connected to CRM MongoDB Atlas (default connection)');
  } catch (err) {
    console.error('Could not connect to CRM MongoDB Atlas', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

// Connect to MTV database
async function connectMTV() {
  try {
    // Use MTV_MONGO_URI if provided, else replace 'CRM' with 'MTV' in MONGO_URI
    const mtvUri = process.env.MTV_MONGO_URI || process.env.MONGO_URI.replace('CRM', 'MTV');
    mtvConnection = mongoose.createConnection(mtvUri, {
      maxPoolSize: 50, // Adjust based on workload
      connectTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 60000, // 60 seconds socket timeout
    });
    await mtvConnection.asPromise(); // Ensure connection is established
    console.log('Connected to MTV MongoDB Atlas');
    return mtvConnection;
  } catch (err) {
    console.error('Could not connect to MTV MongoDB Atlas', {
      error: err.message,
      stack: err.stack,
      mtvUri: mtvUri.replace(/\/\/.*@/, '//<hidden>@'), // Hide credentials
    });
    process.exit(1);
  }
}

// Initialize both connections
async function connectDB() {
  try {
    await Promise.all([connectCRM(), connectMTV()]);
    console.log('All database connections initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database connections', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

// Getters for connections
function getCRMConnection() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    throw new Error(`CRM connection not initialized or not ready (state: ${mongoose.connection.readyState})`);
  }
  return mongoose.connection;
}

function getMTVConnection() {
  if (!mtvConnection || mtvConnection.readyState !== 1) {
    throw new Error(`MTV connection not initialized or not ready (state: ${mtvConnection?.readyState || 'undefined'})`);
  }
  return mtvConnection;
}

module.exports = {
  connectDB,
  getCRMConnection,
  getMTVConnection,
};