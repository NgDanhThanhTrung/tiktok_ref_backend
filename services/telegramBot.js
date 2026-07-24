const { Telegraf } = require('telegraf');
const Task = require('../models/Task');
const Link = require('../models/Link');
const User = require('../models/User');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Helper làm sạch TikTok Username
const sanitizeUsername = (username) => {
  if (!username) return '';
  return username.trim().replace(/^@+/, '').toLowerCase();
};

// Send task notification with inline keyboard
async function sendTaskNotification(chatId, task, link, workerUsername) {
  try {
    const cleanWorker = sanitizeUsername(workerUsername);
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Xác nhận cộng điểm', callback_data: `approve_${task._id}` },
          { text: '❌ Báo cáo gian lận', callback_data: `reject_${task._id}` }
        ]
      ]
    };

    const message = 
      `📸 *BẰNG CHỨNG MỚI CẦN DUYỆT*\n\n` +
      `👤 Người thực hiện: *@${cleanWorker}*\n` +
      `🔗 Link: ${link.url}\n` +
      `🎯 Thưởng: *+${link.rewardPoints} điểm*\n\n` +
      `Hãy kiểm tra ảnh bằng chứng và chọn hành động bên dưới:`;

    await bot.telegram.sendPhoto(chatId, task.proofImageUrl, {
      caption: message,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Lỗi gửi thông báo nhiệm vụ qua Telegram:', error);
  }
}

// Handle /start command
bot.command('start', async (ctx) => {
  const welcomeMessage = 
    `👋 *Chào mừng bạn đến với CrossLink Bot!*\n\n` +
    `Hệ thống hỗ trợ chéo link tương tác TikTok & MXH hoàn toàn tự động.\n\n` +
    `🔥 *DỊCH VỤ ĐẶC BIỆT:* 🔥\n` +
    `Cần buff chém giá TikTok về *1K* siêu tốc? Liên hệ ngay Telegram: *@buffchemgiatiktok*\n` +
    `⚡ Chi phí siêu ưu đãi — *chỉ từ một phần nhỏ so với giá gốc* (tùy thuộc vào từng loại sản phẩm)!\n\n` +
    `📌 *Các lệnh hỗ trợ:* \n` +
    `• \`/login <tiktok_username>\` : Đăng nhập / Liên kết tài khoản TikTok\n` +
    `• \`/logout\` : Đăng xuất tài khoản TikTok hiện tại\n` +
    `• \`/myid\` : Xem Telegram Chat ID của bạn\n\n` +
    `👉 Bắt đầu ngay bằng cú pháp: \`/login username_cua_ban\``;

  await ctx.replyWithMarkdown(welcomeMessage);
});

// Handle /login <tiktok_username>
bot.command('login', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text.trim();
  const args = text.split(' ');

  if (args.length < 2 || !args[1]) {
    return ctx.reply('⚠️ Cú pháp không hợp lệ. Vui lòng nhập: /login <tiktok_username>');
  }

  const cleanUsername = sanitizeUsername(args[1]);

  try {
    let existingChatUser = await User.findOne({ telegramChatId: chatId });
    if (existingChatUser) {
      if (existingChatUser.tiktokUsername === cleanUsername) {
        return ctx.reply(`✅ Bạn đã đăng nhập bằng tài khoản TikTok @${existingChatUser.tiktokUsername} rồi.`);
      } else {
        return ctx.reply(
          `⚠️ Telegram này đang liên kết với *@${existingChatUser.tiktokUsername}*.\n` +
          `Vui lòng gõ /logout trước nếu muốn đổi tài khoản.`,
          { parse_mode: 'Markdown' }
        );
      }
    }

    let user = await User.findOne({ tiktokUsername: cleanUsername });
    if (!user) {
      user = new User({ tiktokUsername: cleanUsername, telegramChatId: chatId });
      await user.save();
      return ctx.reply(
        `🎉 *Đăng ký & Liên kết thành công!*\n\n` +
        `👤 TikTok Username: *@${cleanUsername}*\n` +
        `💰 Điểm hiện có: *${user.credits}*\n` +
        `⭐ Điểm uy tín: *${user.reputationScore}%*\n\n` +
        `💡 *Mẹo:* Cần chém giá TikTok về 1k giá hạt dẻ? Inbox ngay *@buffchemgiatiktok*!`,
        { parse_mode: 'Markdown' }
      );
    } else {
      user.telegramChatId = chatId;
      await user.save();
      return ctx.reply(
        `✅ *Đăng nhập thành công!*\n\n` +
        `👤 Đã liên kết Telegram với TikTok: *@${cleanUsername}*\n` +
        `💰 Điểm hiện có: *${user.credits}*`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Lỗi /login Telegram:', error);
    return ctx.reply('❌ Có lỗi xảy ra trong quá trình đăng nhập. Vui lòng thử lại.');
  }
});

// Handle /logout command
bot.command('logout', async (ctx) => {
  const chatId = ctx.chat.id.toString();

  try {
    const user = await User.findOne({ telegramChatId: chatId });
    if (!user) {
      return ctx.reply('⚠️ Bạn chưa đăng nhập tài khoản TikTok nào.');
    }

    const currentUsername = user.tiktokUsername;
    user.telegramChatId = null;
    await user.save();

    return ctx.reply(
      `🚪 *Đăng xuất thành công!*\n\n` +
      `Đã hủy liên kết với tài khoản *@${currentUsername}*.\n` +
      `Gõ \`/login <tiktok_username>\` để đăng nhập tài khoản khác.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Lỗi /logout Telegram:', error);
    return ctx.reply('❌ Có lỗi xảy ra khi đăng xuất. Vui lòng thử lại.');
  }
});

// Handle /myid command
bot.command('myid', async (ctx) => {
  await ctx.reply(`🆔 Telegram Chat ID của bạn: ${ctx.chat.id}`);
});

// Handle callback queries (Bấm nút Duyệt/Từ chối)
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const [action, taskId] = callbackData.split('_');

  try {
    const task = await Task.findById(taskId);
    if (!task) {
      await ctx.answerCbQuery('❌ Không tìm thấy nhiệm vụ');
      return;
    }

    if (task.status !== 'PENDING') {
      await ctx.answerCbQuery('⚠️ Nhiệm vụ này đã được duyệt trước đó');
      return;
    }

    const link = await Link.findById(task.linkId);
    const cleanWorker = sanitizeUsername(task.workerUsername);
    const worker = await User.findOne({ tiktokUsername: cleanWorker });

    if (action === 'approve') {
      task.status = 'APPROVED';
      task.reviewedAt = new Date();
      await task.save();

      if (worker && link) {
        worker.credits += link.rewardPoints;
        await worker.save();

        link.completedCount += 1;
        if (link.completedCount >= link.targetCount) {
          link.status = 'COMPLETED';
        }
        await link.save();
      }

      await ctx.answerCbQuery('✅ Đã xác nhận cộng điểm!');
      await ctx.editMessageCaption(
        `✅ *ĐÃ DUYỆT BÀI*\n\n👤 Worker: *@${cleanWorker}*\n💰 Đã cộng: *+${link ? link.rewardPoints : 5} điểm*`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } }
      );

      // Thông báo cho Worker nếu đã liên kết Telegram
      if (worker && worker.telegramChatId) {
        try {
          await bot.telegram.sendMessage(
            worker.telegramChatId,
            `🎉 *CHÚC MỪNG!*\nBằng chứng nhiệm vụ của bạn đã được duyệt.\n💰 *+${link ? link.rewardPoints : 5} điểm* đã được cộng vào tài khoản.`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          console.error('Lỗi gửi thông báo cho Worker:', error);
        }
      }

    } else if (action === 'reject') {
      task.status = 'REJECTED';
      task.reviewedAt = new Date();
      await task.save();

      if (worker) {
        worker.reputationScore = Math.max(0, worker.reputationScore - 10);
        await worker.save();
      }

      await ctx.answerCbQuery('❌ Đã báo cáo gian lận!');
      await ctx.editMessageCaption(
        `❌ *ĐÃ TỪ CHỐI / BÁO CÁO GIAN LẬN*\n\n👤 Worker: *@${cleanWorker}*\n⚠️ Đã trừ 10 điểm uy tín của tài khoản này.`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } }
      );
    }

  } catch (error) {
    console.error('Lỗi khi xử lý Callback Query:', error);
    await ctx.answerCbQuery('❌ Có lỗi xảy ra');
  }
});

module.exports = { bot, sendTaskNotification };
