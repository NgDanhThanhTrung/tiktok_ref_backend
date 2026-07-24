const { Telegraf } = require('telegraf');
const Task = require('../models/Task');
const Link = require('../models/Link');
const User = require('../models/User');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Send task notification with inline keyboard
async function sendTaskNotification(chatId, task, link, workerUsername) {
  try {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Xác nhận cộng điểm', callback_data: `approve_${task._id}` },
          { text: '❌ Báo cáo gian lận', callback_data: `reject_${task._id}` }
        ]
      ]
    };

    const message = `
📸 *Bằng chứng mới cần duyệt*

👤 Người thực hiện: @${workerUsername}
🔗 Link: ${link.url}
🎯 Thưởng: ${link.rewardPoints} điểm

Hãy kiểm tra bằng chứng và chọn hành động bên dưới:
    `;

    await bot.telegram.sendPhoto(chatId, task.proofImageUrl, {
      caption: message,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error sending task notification:', error);
  }
}

// Handle callback queries
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const [action, taskId] = callbackData.split('_');

  try {
    const task = await Task.findById(taskId);
    if (!task) {
      await ctx.answerCbQuery('Không tìm thấy nhiệm vụ');
      return;
    }

    if (task.status !== 'PENDING') {
      await ctx.answerCbQuery('Nhiệm vụ đã được duyệt');
      return;
    }

    const link = await Link.findById(task.linkId);
    const worker = await User.findOne({ 
      tiktokUsername: task.workerUsername 
    });

    if (action === 'approve') {
      task.status = 'APPROVED';
      task.reviewedAt = Date.now();
      await task.save();

      // Update worker credits
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

      await ctx.answerCbQuery('✅ Đã xác nhận cộng điểm!');
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      
      // Notify worker if they have telegram chat ID
      if (worker && worker.telegramChatId) {
        try {
          await bot.telegram.sendMessage(
            worker.telegramChatId,
            `🎉 Chúc mừng! Bằng chứng của bạn đã được duyệt.\n+${link.rewardPoints} điểm đã được cộng vào tài khoản.`
          );
        } catch (error) {
          console.error('Error notifying worker:', error);
        }
      }

    } else if (action === 'reject') {
      task.status = 'REJECTED';
      task.reviewedAt = Date.now();
      await task.save();

      // Update worker reputation
      if (worker) {
        worker.reputationScore = Math.max(0, worker.reputationScore - 10);
        await worker.save();
      }

      await ctx.answerCbQuery('❌ Đã báo cáo gian lận!');
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }

  } catch (error) {
    console.error('Error handling callback query:', error);
    await ctx.answerCbQuery('Có lỗi xảy ra');
  }
});

// Handle /start command
bot.command('start', async (ctx) => {
  const message = `
👋 Chào mừng đến với CrossLink Bot!

Để nhận thông báo khi có bằng chứng cần duyệt, hãy liên kết tài khoản TikTok của bạn:

1. Truy cập Web App
2. Đăng nhập với TikTok Username
3. Nhập Telegram Chat ID của bạn

Chat ID của bạn: ${ctx.chat.id}
  `;
  await ctx.reply(message);
});

// Handle /myid command
bot.command('myid', async (ctx) => {
  await ctx.reply(`Chat ID của bạn: ${ctx.chat.id}`);
});

module.exports = { bot, sendTaskNotification };
