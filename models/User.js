const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  tiktokUsername: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  telegramChatId: {
    type: String,
    default: null
  },
  credits: {
    type: Number,
    default: 0
  },
  reputationScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
