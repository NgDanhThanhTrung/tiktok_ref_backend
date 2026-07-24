const express = require('express');
const router = express.Router();
const Link = require('../models/Link');
const User = require('../models/User');

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
    const links = await Link.find({ 
      ownerUsername: req.params.username.toLowerCase() 
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

    // Verify user exists
    const user = await User.findOne({ 
      tiktokUsername: ownerUsername.toLowerCase() 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const link = new Link({
      url,
      ownerUsername: ownerUsername.toLowerCase(),
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
