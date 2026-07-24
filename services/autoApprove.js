const cron = require('node-cron');
const Task = require('../models/Task');
const Link = require('../models/Link');
const User = require('../models/User');

// Auto-approve tasks after 24 hours if still pending
function startAutoApproveScheduler() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running auto-approve check...');
    
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Find pending tasks older than 24 hours
      const pendingTasks = await Task.find({
        status: 'PENDING',
        createdAt: { $lt: twentyFourHoursAgo }
      }).populate('linkId');

      console.log(`Found ${pendingTasks.length} tasks to auto-approve`);

      for (const task of pendingTasks) {
        try {
          task.status = 'APPROVED';
          task.reviewedAt = Date.now();
          task.autoApproved = true;
          await task.save();

          // Update worker credits
          const worker = await User.findOne({ 
            tiktokUsername: task.workerUsername 
          });
          
          if (worker && task.linkId) {
            worker.credits += task.linkId.rewardPoints;
            await worker.save();

            // Update link completed count
            task.linkId.completedCount += 1;
            if (task.linkId.completedCount >= task.linkId.targetCount) {
              task.linkId.status = 'COMPLETED';
            }
            await task.linkId.save();
          }

          console.log(`Auto-approved task ${task._id}`);
        } catch (error) {
          console.error(`Error auto-approving task ${task._id}:`, error);
        }
      }

      console.log('Auto-approve check completed');
    } catch (error) {
      console.error('Error in auto-approve scheduler:', error);
    }
  });

  console.log('Auto-approve scheduler started (runs every hour)');
}

module.exports = { startAutoApproveScheduler };
