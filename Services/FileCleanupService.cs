using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace JIRA_NTB_WEB.Services
{
    public class FileCleanupService : BackgroundService
    {
        private readonly ILogger<FileCleanupService> _logger;
        private readonly string _connectionString;
        private readonly IWebHostEnvironment _environment;
        private readonly int _retentionDays;

        public FileCleanupService(
            ILogger<FileCleanupService> logger,
            IConfiguration configuration,
            IWebHostEnvironment environment)
        {
            _logger = logger;
            _environment = environment;
            _connectionString = configuration.GetConnectionString("DefaultConnection");

            string daysConfig = configuration["RetentionDays"];
            if (!int.TryParse(daysConfig, out _retentionDays))
            {
                _retentionDays = 30;
            }
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Service dọn dẹp ảnh log tự động đã khởi động.");

            while (!stoppingToken.IsCancellationRequested)
            {
                // 1. Lấy giờ chạy mong muốn từ Database
                TimeSpan targetTime = await GetScheduleTimeFromDb();

                // 2. Tính toán thời gian chờ
                TimeSpan timeToWait = CalculateTimeToNextRun(targetTime);

                _logger.LogInformation($"Lịch chạy kế tiếp: {targetTime}. Hệ thống sẽ chờ {timeToWait.TotalHours:N2} giờ (Lúc {DateTime.Now.Add(timeToWait)}).");

                try
                {
                    // 3. Ngủ đông chờ đến giờ G
                    await Task.Delay(timeToWait, stoppingToken);

                    // 4. Chạy dọn dẹp
                    await DoCleanupAsync();
                }
                catch (TaskCanceledException) { break; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi trong quá trình chờ hoặc chạy Job.");
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
            }
        }

        //Lấy giờ từ DB
        private async Task<TimeSpan> GetScheduleTimeFromDb()
        {
            TimeSpan defaultTime = new TimeSpan(2, 0, 0); // Mặc định 2h sáng nếu lỗi/không tìm thấy

            string query = "SELECT [Time] FROM SetTimes WHERE Id = 'CLEANUP_TIME'";

            try
            {
                using (var conn = new SqlConnection(_connectionString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new SqlCommand(query, conn))
                    {
                        var result = await cmd.ExecuteScalarAsync();
                        if (result != null && result != DBNull.Value)
                        {
                            return (TimeSpan)result;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Không lấy được lịch chạy từ DB ({ex.Message}). Dùng mặc định 02:00:00.");
            }

            return defaultTime;
        }

        // 🟢 HÀM MỚI: Tính toán thời gian chờ
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

        private async Task DoCleanupAsync()
        {
            DateTime thresholdDate = DateTime.Now.AddDays(-_retentionDays);
            _logger.LogInformation($"[START CLEANUP] Quét ảnh cũ hơn: {thresholdDate}");

            List<string> filesToDelete = new List<string>();
            string selectQuery = "SELECT Id, UrlImage FROM ImageLogs WHERE CreateAt < @Threshold";

            using (var conn = new SqlConnection(_connectionString))
            {
                await conn.OpenAsync();

                using (var cmd = new SqlCommand(selectQuery, conn))
                {
                    cmd.Parameters.AddWithValue("@Threshold", thresholdDate);
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            if (reader["UrlImage"] != DBNull.Value)
                            {
                                filesToDelete.Add(reader["UrlImage"].ToString());
                            }
                        }
                    }
                }

                if (filesToDelete.Count == 0)
                {
                    _logger.LogInformation("[END CLEANUP] Không có ảnh nào cần xóa.");
                    return;
                }

                int deletedFilesCount = 0;
                foreach (var relativePath in filesToDelete)
                {
                    try
                    {
                        string absolutePath = Path.Combine(_environment.WebRootPath, relativePath.TrimStart('/').Replace("/", "\\"));
                        if (File.Exists(absolutePath))
                        {
                            File.Delete(absolutePath);
                            deletedFilesCount++;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"Không thể xóa file {relativePath}: {ex.Message}");
                    }
                }

                string deleteQuery = "DELETE FROM ImageLogs WHERE CreateAt < @Threshold";
                using (var cmdDelete = new SqlCommand(deleteQuery, conn))
                {
                    cmdDelete.Parameters.AddWithValue("@Threshold", thresholdDate);
                    int rowsAffected = await cmdDelete.ExecuteNonQueryAsync();
                    _logger.LogInformation($"[DONE] Đã xóa {deletedFilesCount} file ảnh và {rowsAffected} dòng DB.");
                }
            }
        }
    }
}