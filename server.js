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

// Kết nối Cơ sở dữ liệu MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (Dùng cho UptimeRobot / Cron ping giữ server không bị sleep)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Khai báo API Routes
app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/tasks', taskRoutes);

// Telegram Webhook endpoint
app.post(`/telegram/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Hàm thiết lập Webhook Telegram
async function setupTelegramWebhook() {
  const webhookUrl = `${process.env.WEBHOOK_URL}/telegram/${process.env.TELEGRAM_BOT_TOKEN}`;
  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`🤖 Telegram Webhook đã được thiết lập: ${webhookUrl}`);
  } catch (error) {
    console.error('❌ Lỗi khi thiết lập Telegram Webhook:', error);
  }
}

// Khởi chạy Cronjob Auto Approve 24h
startAutoApproveScheduler();

// Khởi chạy Express Server
app.listen(PORT, async () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);

  // Đăng ký danh sách câu lệnh menu gợi ý cho Bot trên ứng dụng Telegram
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Bắt đầu & Lời chào' },
      { command: 'login', description: 'Đăng nhập (/login tiktok_username)' },
      { command: 'logout', description: 'Đăng xuất tài khoản hiện tại' },
      { command: 'myid', description: 'Xem Telegram Chat ID' }
    ]);
  } catch (err) {
    console.error('⚠️ Không thể thiết lập Bot Commands:', err.message);
  }

  // Chế độ Production (Sử dụng Webhook) hoặc Development (Sử dụng Polling)
  if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
    setupTelegramWebhook();
  } else {
    console.log('🛠️ Đang chạy ở môi trường Development (hoặc thiếu WEBHOOK_URL) — Bật Polling');
    bot.launch();
    console.log('🤖 Telegram Bot polling đã bắt đầu');
  }
});

// Tắt bot an toàn khi ngắt ứng dụng
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
