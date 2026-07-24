const express = require('express');
const router = express.Router();
const Link = require('../models/Link');
const User = require('../models/User');

// Helper làm sạch TikTok Username
const sanitizeUsername = (username) => {
  if (!username) return '';
  return username.trim().replace(/^@+/, '').toLowerCase();
};

// Get all active links
router.get('/', async (req, res) => {
  try {
    const links = await Link.find({ status: 'ACTIVE' })
      .sort({ createdAt: -1 });
    
    res.json(links);
  } catch (error) {
    console.error('Get links error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get links by owner
router.get('/owner/:username', async (req, res) => {
  try {
    const cleanUsername = sanitizeUsername(req.params.username);
    const links = await Link.find({ 
      ownerUsername: cleanUsername 
    }).sort({ createdAt: -1 });
    
    res.json(links);
  } catch (error) {
    console.error('Get owner links error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new link
router.post('/', async (req, res) => {
  try {
    const { url, ownerUsername, targetCount, rewardPoints } = req.body;
    
    if (!url || !ownerUsername) {
      return res.status(400).json({ error: 'URL and ownerUsername are required' });
    }

    const cleanOwner = sanitizeUsername(ownerUsername);

    // Verify user exists
    const user = await User.findOne({ 
      tiktokUsername: cleanOwner 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const link = new Link({
      url: url.trim(),
      ownerUsername: cleanOwner,
      targetCount: targetCount || 10,
      rewardPoints: rewardPoints || 5,
      status: 'ACTIVE'
    });

    await link.save();
    res.status(201).json(link);
  } catch (error) {
    console.error('Create link error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update link status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['ACTIVE', 'COMPLETED', 'PAUSED'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value. Must be ACTIVE, COMPLETED, or PAUSED' });
    }

    const link = await Link.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json(link);
  } catch (error) {
    console.error('Update link status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
