const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Task = require('../models/Task');
const Link = require('../models/Link');
const User = require('../models/User');
const { sendTaskNotification } = require('../services/telegramBot');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn ảnh tối đa 10MB
});

// Helper làm sạch TikTok Username
const sanitizeUsername = (username) => {
  if (!username) return '';
  return username.trim().replace(/^@+/, '').toLowerCase();
};

// Create new task with image upload
router.post('/', upload.single('proofImage'), async (req, res) => {
  try {
    const { linkId, workerUsername } = req.body;
    
    if (!linkId || !workerUsername || !req.file) {
      return res.status(400).json({ 
        error: 'linkId, workerUsername, and proofImage are required' 
      });
    }

    const cleanWorker = sanitizeUsername(workerUsername);

    // Verify link exists and is active
    const link = await Link.findById(linkId);
    if (!link || link.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Link not found or not active' });
    }

    // Kiểm tra xem worker đã nộp task đang PENDING cho link này chưa (chống spam)
    const existingPendingTask = await Task.findOne({
      linkId,
      workerUsername: cleanWorker,
      status: 'PENDING'
    });

    if (existingPendingTask) {
      return res.status(400).json({ error: 'You already submitted a proof for this link. Please wait for review.' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: 'crosslink-proofs',
          resource_type: 'image'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Create task
    const task = new Task({
      linkId,
      workerUsername: cleanWorker,
      proofImageUrl: result.secure_url,
      status: 'PENDING'
    });

    await task.save();

    // Get link owner's telegram chat ID
    const owner = await User.findOne({ 
      tiktokUsername: link.ownerUsername 
    });

    // Send Telegram notification if owner has chat ID
    if (owner && owner.telegramChatId) {
      try {
        await sendTaskNotification(
          owner.telegramChatId,
          task,
          link,
          cleanWorker
        );
      } catch (tgError) {
        console.error('Lỗi khi gửi thông báo Telegram:', tgError);
      }
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get tasks by worker
router.get('/worker/:username', async (req, res) => {
  try {
    const cleanUsername = sanitizeUsername(req.params.username);
    const tasks = await Task.find({ 
      workerUsername: cleanUsername 
    })
    .populate('linkId')
    .sort({ createdAt: -1 });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get worker tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get tasks by link owner
router.get('/owner/:username', async (req, res) => {
  try {
    const cleanUsername = sanitizeUsername(req.params.username);
    
    // Get all links owned by this user
    const links = await Link.find({ 
      ownerUsername: cleanUsername 
    });
    
    const linkIds = links.map(link => link._id);
    
    const tasks = await Task.find({ 
      linkId: { $in: linkIds } 
    })
    .populate('linkId')
    .sort({ createdAt: -1 });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get owner tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve/Reject task
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['APPROVED', 'REJECTED', 'DISPUTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status !== 'PENDING') {
      return res.status(400).json({ error: 'Task already reviewed' });
    }

    task.status = status;
    task.reviewedAt = new Date();
    await task.save();

    // Update credits if approved
    if (status === 'APPROVED') {
      const link = await Link.findById(task.linkId);
      const worker = await User.findOne({ 
        tiktokUsername: task.workerUsername 
      });
      
      if (worker && link) {
        worker.credits += link.rewardPoints;
        await worker.save();
        
        // Update link completed count
        link.completedCount += 1;
        if (link.completedCount >= link.targetCount) {
          link.status = 'COMPLETED';
        }
        await link.save();
      }
    }

    // Update reputation if rejected
    if (status === 'REJECTED') {
      const worker = await User.findOne({ 
        tiktokUsername: task.workerUsername 
      });
      
      if (worker) {
        worker.reputationScore = Math.max(0, worker.reputationScore - 10);
        await worker.save();
      }
    }

    res.json(task);
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
