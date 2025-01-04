// database.js
const mongoose = require('mongoose');
require('dotenv').config();

const {
    mongoURL
} = process.env;

mongoose.set('strictQuery', true);
mongoose.connect(mongoURL, {
        keepAlive: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    kicks: {
        type: Number,
        default: 0
    },
    bans: {
        type: Number,
        default: 0
    },
});

const UserStats = mongoose.model('UserStats', userSchema);

module.exports = {
    UserStats
};