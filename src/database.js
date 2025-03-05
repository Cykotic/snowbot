const mongoose = require('mongoose');
require('dotenv').config();

const { mongoURL } = process.env;

mongoose.set('strictQuery', true);

mongoose
  .connect(mongoURL, {
    keepAlive: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

/**
 * User Schema
 */
const userSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  kicks: { type: Number, default: 0 }, 
});

/**
 * Click Schema - Tracks users' bonk interactions
 */
const clickSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  clicks: { type: Number, default: 0 },
});

/**
 * User ID Schema
 */
const userIdSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  roleIds: { type: [String], default: [] },
});

/**
 * Channel Schema - bonk channels
 */
const channelSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
});

const ClickStats = mongoose.model('ClickStats', clickSchema);
const UserStats = mongoose.model('UserStats', userSchema);
const UserIds = mongoose.model('UserIds', userIdSchema);
const Channels = mongoose.model('BonkChannels', channelSchema);

module.exports = {
  UserStats,
  ClickStats,
  UserIds,
  Channels,
};
