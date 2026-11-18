// const express = require('express');
// const mongoose = require('mongoose');
// const dotenv = require('dotenv');

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware to parse JSON
// app.use(express.json());

// // Log the connection string for debugging
// console.log('Connecting to MongoDB with URI:', process.env.MONGO_URI);

// // Connect to MongoDB Atlas
// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('Connected to MongoDB Atlas'))
//   .catch(err => console.error('Could not connect to MongoDB Atlas', err));

// // Define a simple route
// app.get('/', (req, res) => {
//   res.send('Hello World!');
// });

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });


// const express = require('express');
// const mongoose = require('mongoose');
// const dotenv = require('dotenv');

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware to parse JSON
// app.use(express.json());

// // Connect to MongoDB Atlas
// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
//   .then(() => console.log('Connected to MongoDB Atlas'))
//   .catch(err => console.error('Could not connect to MongoDB Atlas', err));

// // Define a Mongoose model for Journals
// const JournalSchema = new mongoose.Schema({}, { strict: false }); // Allow dynamic schema
// const Journal = mongoose.model('Journal', JournalSchema, 'Journals'); // Specify collection name explicitly

// // API to fetch all records from the Journals collection
// app.get('/journals', async (req, res) => {
//   try {

//     const journals = await Journal.find();
//     console.log(journals,'journals data');
//     res.json(journals);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch journals', details: err.message });
//   }
// });

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });


const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('Starting backend...');
    const dbStatus = await db.connectDB();

    const server = app.listen(PORT, () => {
      if (dbStatus.connected) {
        console.log(`Server is running on port ${PORT}`);
      } else {
        console.log(`Server is running on port ${PORT} (CRM-only mode — MongoDB not connected)`);
      }
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\nPort ${PORT} is already in use. Stop the other backend process first:`);
        console.error(`  lsof -i :${PORT}`);
        console.error(`  kill <PID>\n`);
        process.exit(1);
      }
      console.error('Server failed to start:', error.message);
      process.exit(1);
    });

    server.timeout = 90 * 60 * 1000;
    server.keepAliveTimeout = 90 * 60 * 1000 + 1000;
    server.headersTimeout = 90 * 60 * 1000 + 2000;
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();