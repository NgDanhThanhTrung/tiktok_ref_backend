const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  ownerUsername: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  targetCount: {
    type: Number,
    required: true,
    default: 10
  },
  completedCount: {
    type: Number,
    default: 0
  },
  rewardPoints: {
    type: Number,
    required: true,
    default: 5
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'PAUSED'],
    default: 'ACTIVE'
  }
}, { 
  timestamps: true // Mongoose sẽ tự quản lý createdAt & updatedAt cho bạn
});

module.exports = mongoose.model('Link', linkSchema);
