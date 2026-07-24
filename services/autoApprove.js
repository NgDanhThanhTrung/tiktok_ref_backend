const cron = require('node-cron');
const Task = require('../models/Task');
const Link = require('../models/Link');
const User = require('../models/User');

// Helper làm sạch TikTok Username
const sanitizeUsername = (username) => {
  if (!username) return '';
  return username.trim().replace(/^@+/, '').toLowerCase();
};

// Auto-approve tasks after 24 hours if still pending
function startAutoApproveScheduler() {
  // Chạy định kỳ vào phút đầu tiên của mỗi giờ ('0 * * * *')
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ [Cronjob] Đang kiểm tra nhiệm vụ quá hạn 24 giờ...');
    
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Tìm các task PENDING được tạo từ 24 tiếng trước trở về trước
      const pendingTasks = await Task.find({
        status: 'PENDING',
        createdAt: { $lt: twentyFourHoursAgo }
      }).populate('linkId');

      if (pendingTasks.length === 0) {
        console.log('✅ [Cronjob] Không có nhiệm vụ nào cần tự động duyệt.');
        return;
      }

      console.log(`🔍 [Cronjob] Phát hiện ${pendingTasks.length} nhiệm vụ cần auto-approve.`);

      for (const task of pendingTasks) {
        try {
          task.status = 'APPROVED';
          task.reviewedAt = new Date();
          task.autoApproved = true;
          await task.save();

          const cleanWorker = sanitizeUsername(task.workerUsername);

          // Cập nhật điểm thưởng cho Worker
          const worker = await User.findOne({ 
            tiktokUsername: cleanWorker 
          });
          
          if (worker && task.linkId) {
            worker.credits += task.linkId.rewardPoints || 5;
            await worker.save();

            // Cập nhật số lượt đã hoàn thành của Link
            task.linkId.completedCount += 1;
            if (task.linkId.completedCount >= task.linkId.targetCount) {
              task.linkId.status = 'COMPLETED';
            }
            await task.linkId.save();
          }

          console.log(`🎉 [Cronjob] Đã tự động duyệt Task ID: ${task._id} cho user @${cleanWorker}`);
        } catch (error) {
          console.error(`❌ [Cronjob] Lỗi khi duyệt Task ID ${task._id}:`, error);
        }
      }

      console.log('✅ [Cronjob] Hoàn tất tiến trình tự động duyệt.');
    } catch (error) {
      console.error('❌ [Cronjob] Lỗi hệ thống trong Auto-approve scheduler:', error);
    }
  });

  console.log('🚀 Auto-approve scheduler đã khởi tạo (chạy kiểm tra mỗi giờ một lần).');
}

module.exports = { startAutoApproveScheduler };
