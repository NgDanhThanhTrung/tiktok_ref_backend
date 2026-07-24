require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { bot } = require('./services/telegramBot');
const { startAutoApproveScheduler } = require('./services/autoApprove');

// Import routes
const authRoutes = require('./routes/auth');
const linkRoutes = require('./routes/links');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (to prevent sleep)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/tasks', taskRoutes);

// Telegram Webhook endpoint
app.use(`/telegram/${bot.token}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Set Telegram webhook
async function setWebhook() {
  const webhookUrl = `${process.env.WEBHOOK_URL}/telegram/${bot.token}`;
  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`Telegram webhook set to: ${webhookUrl}`);
  } catch (error) {
    console.error('Error setting webhook:', error);
  }
}

// Start auto-approve scheduler
startAutoApproveScheduler();

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set webhook only in production
  if (process.env.NODE_ENV === 'production') {
    setWebhook();
  } else {
    console.log('Running in development mode - webhook not set');
    // Start bot polling in development
    bot.launch();
    console.log('Telegram bot polling started');
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
