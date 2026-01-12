const fs = require('fs');

// Try to read the .env file directly
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const lines = envContent.split('\n');
  let mongoUri = '';
  
  for (const line of lines) {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.split('=')[1];
      break;
    }
  }
  
  if (!mongoUri) {
    console.error('MONGODB_URI not found in .env file');
    process.exit(1);
  }
  
  console.log('Connecting to:', mongoUri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
  
  const mongoose = require('mongoose');
  
  mongoose.connect(mongoUri)
.then(async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Check all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Check emails-sent collection
    const emailsCount = await mongoose.connection.db.collection('emails-sent').countDocuments();
    console.log('Emails-sent count:', emailsCount);
    
    // Check campaign collection  
    const campaignsCount = await mongoose.connection.db.collection('campaign').countDocuments();
    console.log('Campaign count:', campaignsCount);
    
    // Check companies collection
    const companiesCount = await mongoose.connection.db.collection('companies').countDocuments();
    console.log('Companies count:', companiesCount);
    
    // Check user collection
    const usersCount = await mongoose.connection.db.collection('user').countDocuments();
    console.log('Users count:', usersCount);
    
    // Sample an email to check structure
    if (emailsCount > 0) {
      const sampleEmail = await mongoose.connection.db.collection('emails-sent').findOne();
      console.log('Sample email keys:', Object.keys(sampleEmail || {}));
      if (sampleEmail.emailEvents) {
        console.log('Email events sample:', JSON.stringify(sampleEmail.emailEvents, null, 2));
      }
    }
    
    // Sample a campaign to check structure
    if (campaignsCount > 0) {
      const sampleCampaign = await mongoose.connection.db.collection('campaign').findOne();
      console.log('Sample campaign keys:', Object.keys(sampleCampaign || {}));
      console.log('Campaign status:', sampleCampaign?.status);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Connection error:', err);
  process.exit(1);
});

} catch (error) {
  console.error('Error reading .env file:', error);
  process.exit(1);
}
