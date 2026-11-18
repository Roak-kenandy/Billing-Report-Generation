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
  console.log('Connecting to CRM MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 100,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 120000,
    serverSelectionTimeoutMS: 15000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    retryReads: true,
  });
  console.log('Connected to CRM MongoDB Atlas (default connection)');
}

// Connect to MTV database
async function connectMTV() {
  console.log('Connecting to MTV MongoDB Atlas...');
  const mtvUri = process.env.MTV_MONGO_URI || process.env.MONGO_URI.replace('CRM', 'MTV');
  mtvConnection = mongoose.createConnection(mtvUri, {
    maxPoolSize: 50,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 60000,
    serverSelectionTimeoutMS: 15000,
  });
  await mtvConnection.asPromise();
  console.log('Connected to MTV MongoDB Atlas');
  return mtvConnection;
}

const isMongoOptional = () => (
  process.env.MONGO_OPTIONAL === 'true' || process.env.MONGO_OPTIONAL === '1'
);

const logMongoConnectionHelp = (err) => {
  if (err.message.includes('whitelist') || err.message.includes('IP')) {
    console.error('\nFix: Add your current IP to MongoDB Atlas → Network Access → Add IP Address');
    console.error('Docs: https://www.mongodb.com/docs/atlas/security-whitelist/\n');
  } else if (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED')) {
    console.error('\nFix: DNS cannot reach MongoDB Atlas (SRV lookup failed). Try:');
    console.error('  1. Check internet connection / VPN (connect or disconnect and retry)');
    console.error('  2. Switch DNS to 8.8.8.8 or 1.1.1.1 in System Settings → Network');
    console.error('  3. Test: nslookup _mongodb._tcp.crm.mlnxc.mongodb.net');
    console.error('  4. Confirm MongoDB Atlas cluster is running and MONGO_URI is correct\n');
  }
};

// Initialize both connections
async function connectDB() {
  try {
    await Promise.all([connectCRM(), connectMTV()]);
    console.log('All database connections initialized successfully');
    return { connected: true };
  } catch (err) {
    console.error('Failed to initialize database connections');
    console.error(err.message);
    logMongoConnectionHelp(err);

    if (isMongoOptional()) {
      console.warn(
        '\nMONGO_OPTIONAL is enabled — server will start without MongoDB.\n'
        + 'CRM API bulk uploads (termination, Dhiraagu, CSMS cancel, etc.) will work.\n'
        + 'Reports, login, and bulk history require MongoDB Atlas.\n'
      );
      return { connected: false };
    }

    throw err;
  }
}

function isMongoConnected() {
  return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
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
  isMongoConnected,
  isMongoOptional,
};