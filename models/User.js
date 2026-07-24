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
  }
}, { 
  timestamps: true // Tự động tạo và cập nhật createdAt, updatedAt
});

module.exports = mongoose.model('User', userSchema);
