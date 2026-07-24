const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Login/Register with TikTok Username
router.post('/login', async (req, res) => {
  try {
    const { tiktokUsername, telegramChatId } = req.body;
    
    if (!tiktokUsername) {
      return res.status(400).json({ error: 'TikTok username is required' });
    }

    // Clean username (remove @ if present)
    const cleanUsername = tiktokUsername.replace('@', '').toLowerCase();

    let user = await User.findOne({ tiktokUsername: cleanUsername });

    if (!user) {
      // Create new user
      user = new User({
        tiktokUsername: cleanUsername,
        telegramChatId: telegramChatId || null,
        credits: 0,
        reputationScore: 100
      });
      await user.save();
    } else if (telegramChatId && !user.telegramChatId) {
      // Update telegram chat ID if provided
      user.telegramChatId = telegramChatId;
      await user.save();
    }

    res.json({
      success: true,
      user: {
        tiktokUsername: user.tiktokUsername,
        credits: user.credits,
        reputationScore: user.reputationScore,
        telegramChatId: user.telegramChatId
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
router.get('/profile/:tiktokUsername', async (req, res) => {
  try {
    const user = await User.findOne({ 
      tiktokUsername: req.params.tiktokUsername.toLowerCase() 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      tiktokUsername: user.tiktokUsername,
      credits: user.credits,
      reputationScore: user.reputationScore,
      telegramChatId: user.telegramChatId
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Telegram Chat ID
router.post('/telegram', async (req, res) => {
  try {
    const { tiktokUsername, telegramChatId } = req.body;
    
    if (!tiktokUsername || !telegramChatId) {
      return res.status(400).json({ error: 'Both tiktokUsername and telegramChatId are required' });
    }

    const user = await User.findOneAndUpdate(
      { tiktokUsername: tiktokUsername.toLowerCase() },
      { telegramChatId },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, telegramChatId: user.telegramChatId });
  } catch (error) {
    console.error('Telegram update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
