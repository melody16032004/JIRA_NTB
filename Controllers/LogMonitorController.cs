using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Linq; // Cần LINQ để gom nhóm
using System.Threading.Tasks;
using static JIRA_NTB.ViewModels.LogGroupViewModel;

namespace JIRA_NTB_WEB.Controllers
{
    public class LogMonitorController : Controller
    {
        private readonly string _connectionString;

        public LogMonitorController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        // Thêm tham số để lọc
        public async Task<IActionResult> Index(DateTime? searchDate, TimeSpan? fromTime, TimeSpan? toTime, string searchName)
        {
            // 1. Mặc định lấy ngày hiện tại nếu không chọn
            var targetDate = searchDate ?? DateTime.Now.Date;
            ViewBag.SearchDate = targetDate.ToString("yyyy-MM-dd");
            ViewBag.FromTime = fromTime;
            ViewBag.ToTime = toTime;
            ViewBag.SearchName = searchName;

            var rawLogs = new List<ImageLogViewModel>(); // Class cũ dùng để hứng dữ liệu thô

            // 2. Query SQL có lọc theo Ngày
            string query = @"
                SELECT 
                    L.Id, L.MacAddress, L.UrlImage, L.CreateAt,
                    ISNULL(U.FullName, 'Unknown Device') as FullName
                FROM ImageLogs L
                LEFT JOIN Users U ON L.MacAddress = U.DeviceAddress
                WHERE CAST(L.CreateAt AS DATE) = @Date";

            // Lọc theo tên (nếu có)
            if (!string.IsNullOrEmpty(searchName))
            {
                query += " AND U.FullName LIKE @Name";
            }

            // Lọc theo giờ (nếu có)
            if (fromTime.HasValue) query += " AND CAST(L.CreateAt AS TIME) >= @FromTime";
            if (toTime.HasValue) query += " AND CAST(L.CreateAt AS TIME) <= @ToTime";

            query += " ORDER BY L.CreateAt DESC";

            using (var conn = new SqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                using (var cmd = new SqlCommand(query, conn))
                {
                    cmd.Parameters.AddWithValue("@Date", targetDate);
                    if (!string.IsNullOrEmpty(searchName)) cmd.Parameters.AddWithValue("@Name", "%" + searchName + "%");
                    if (fromTime.HasValue) cmd.Parameters.AddWithValue("@FromTime", fromTime);
                    if (toTime.HasValue) cmd.Parameters.AddWithValue("@ToTime", toTime);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            rawLogs.Add(new ImageLogViewModel
                            {
                                Id = reader["Id"].ToString(),
                                MacAddress = reader["MacAddress"].ToString(),
                                UrlImage = reader["UrlImage"].ToString(),
                                CreateAt = Convert.ToDateTime(reader["CreateAt"]),
                                FullName = reader["FullName"].ToString()
                            });
                        }
                    }
                }
            }

            // 3. GOM NHÓM DỮ LIỆU (Grouping Logic)
            // Gom theo: MacAddress + Ngày
            var groupedData = rawLogs
                .GroupBy(x => new { x.MacAddress, x.FullName, Date = x.CreateAt.Date })
                .Select(g => new UserDailyGroupViewModel
                {
                    MacAddress = g.Key.MacAddress,
                    FullName = g.Key.FullName,
                    Date = g.Key.Date,
                    TotalImages = g.Count(),
                    Logs = g.Select(img => new ImageLogDetail
                    {
                        Id = img.Id,
                        UrlImage = img.UrlImage,
                        Time = img.CreateAt
                    }).OrderByDescending(t => t.Time).ToList()
                })
                .ToList();

            return View(groupedData);
        }
        // --- Lấy dữ liệu thật từ bảng SetTimes ---
        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            var data = new List<SetTimeViewModel>();
            string query = "SELECT Id, Time, Title FROM SetTimes";

            using (var conn = new SqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                using (var cmd = new SqlCommand(query, conn))
                {
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            // Xử lý convert Time từ SQL (thường là TimeSpan)
                            TimeSpan timeVal = TimeSpan.Zero;
                            if (reader["Time"] != DBNull.Value)
                            {
                                timeVal = (TimeSpan)reader["Time"];
                            }

                            data.Add(new SetTimeViewModel
                            {
                                Id = reader["Id"].ToString(),
                                Time = timeVal,
                                Title = reader["Title"].ToString()
                            });
                        }
                    }
                }
            }

            return PartialView("~/Views/LogMonitor/PartialView/_SettingsModalPartial.cshtml", data);
        }

        // --- SỬA LẠI: Dùng SQL thuần để Update ---
        [HttpPost]
        public async Task<IActionResult> SaveSettings(List<SetTimeViewModel> model)
        {
            if (ModelState.IsValid && model != null)
            {
                using (var conn = new SqlConnection(_connectionString))
                {
                    await conn.OpenAsync();

                    // Dùng Transaction để đảm bảo toàn vẹn dữ liệu
                    using (var transaction = conn.BeginTransaction())
                    {
                        try
                        {
                            string updateQuery = "UPDATE SetTimes SET Time = @Time WHERE Id = @Id";

                            foreach (var item in model)
                            {
                                using (var cmd = new SqlCommand(updateQuery, conn, transaction))
                                {
                                    cmd.Parameters.AddWithValue("@Time", item.Time);
                                    cmd.Parameters.AddWithValue("@Id", item.Id);
                                    await cmd.ExecuteNonQueryAsync();
                                }
                            }
                            transaction.Commit(); // Xác nhận lưu
                        }
                        catch (Exception)
                        {
                            transaction.Rollback(); // Hoàn tác nếu lỗi
                            throw;
                        }
                    }
                }
            }

            // Quay lại trang Index sau khi lưu
            return RedirectToAction("Index");
        }
    }
}