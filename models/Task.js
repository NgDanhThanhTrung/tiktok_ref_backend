const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  linkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Link',
    required: true
  },
  workerUsername: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  proofImageUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'DISPUTED'],
    default: 'PENDING'
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  autoApproved: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true // Tự động tạo và quản lý trường createdAt và updatedAt
});

// Index tối ưu truy vấn cho cron job auto-approve bài chờ sau 24h
taskSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Task', taskSchema);
