using JIRA_NTB.Data;
using JIRA_NTB.Models.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection; // Cần cái này để tạo Scope
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

// Nhớ đổi namespace cho đúng project của bạn
namespace JIRA_NTB_WEB.Services
{
    public class TaskOverdueBackgroundService : BackgroundService
    {
        private readonly ILogger<TaskOverdueBackgroundService> _logger;
        private readonly IServiceProvider _serviceProvider; // Dùng để gọi DbContext

        public TaskOverdueBackgroundService(
            ILogger<TaskOverdueBackgroundService> logger,
            IServiceProvider serviceProvider)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Service kiểm tra Task trễ hạn đã khởi động.");

            // Mới vào vòng lặp chạy luôn 1 lần đầu tiên để "catch-up" (bù đắp)
            // Nếu server tắt lúc 1h sáng, 8h sáng bật lại -> Nó sẽ chạy ngay dòng này -> OK
            await ProcessOverdueTasksAsync();

            while (!stoppingToken.IsCancellationRequested)
            {
                // 1. Cấu hình giờ chạy (1h sáng)
                TimeSpan targetTime = new TimeSpan(1, 0, 0);

                // 2. Tính thời gian chờ đến 1h sáng HÔM SAU
                // Lưu ý: Logic tính toán cần đảm bảo luôn trả về thời gian > 0
                TimeSpan timeToWait = CalculateTimeToNextRun(targetTime);

                _logger.LogInformation($"[Task Overdue Job] Đã quét xong. Lần chạy kế tiếp sau {timeToWait.TotalHours:N2} giờ (Lúc {DateTime.Now.Add(timeToWait)}).");

                try
                {
                    // 3. Ngủ đông chờ đến giờ G
                    await Task.Delay(timeToWait, stoppingToken);

                    // 4. Tỉnh dậy thì chạy
                    await ProcessOverdueTasksAsync();
                }
                catch (TaskCanceledException) { break; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[Task Overdue Job] Lỗi khi chờ hoặc chạy job.");
                    // Lỗi thì chờ 5p rồi thử lại
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
            }
        }

        private TimeSpan CalculateTimeToNextRun(TimeSpan targetTime)
        {
            DateTime now = DateTime.Now;
            DateTime nextRun = now.Date.Add(targetTime);

            if (now > nextRun)
            {
                nextRun = nextRun.AddDays(1);
            }

            return nextRun - now;
        }

        // Logic xử lý chính
        private async Task ProcessOverdueTasksAsync()
        {
            _logger.LogInformation("[Task Overdue Job] Bắt đầu quét task trễ hạn...");

            // QUAN TRỌNG: BackgroundService là Singleton, còn DbContext là Scoped.
            // Phải tạo Scope mới lấy được DbContext.
            using (var scope = _serviceProvider.CreateScope())
            {
                // Lấy DbContext từ Scope ra
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var today = DateTime.Now.Date;

                // Chạy lệnh ExecuteUpdateAsync (Code tối ưu đã bàn ở turn trước)
                int rowsAffected = await context.Tasks
                    .Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted)
                    .Where(t => t.EndDate.HasValue && t.EndDate.Value.Date < today)
                    .Where(t => t.Status.StatusName != TaskStatusModel.Done)
                    .Where(t => t.Overdue == false)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Overdue, true));

                _logger.LogInformation($"[Task Overdue Job] Hoàn tất. Đã update {rowsAffected} task thành Overdue.");
            }
        }
    }
}