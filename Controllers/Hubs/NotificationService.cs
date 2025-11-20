using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using Microsoft.EntityFrameworkCore;
using MimeKit;

namespace JIRA_NTB.Controllers.Hubs
{
    public class NotificationService
    {
        private readonly AppDbContext _db;

        public NotificationService(AppDbContext db)
        {
            _db = db;
        }

        // Tạo notify mới
        public async Task<NotificationsModel> CreateAsync(string userId, string title, string message)
        {
            var notify = new NotificationsModel
            {
                UserId = userId,
                Title = title,
                Message = message,
                IsRead = false,
                CreatedAt = DateTime.Now
            };

            _db.Notifications.Add(notify);
            await _db.SaveChangesAsync();

            return notify;
        }

        // Lấy danh sách notify theo user
        public async Task<object> GetUserNotifications(string userId, int pageIndex, int pageSize)
        {
            var query = _db.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt);

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

            var items = await query
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Trả về một object chuẩn (giống các API khác của bạn)
            return new
            {
                Items = items,
                PageIndex = pageIndex,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages
            };
        }

        // Đánh dấu đã đọc
        public async Task MarkAllAsRead(string userId)
        {
            var items = await _db.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
            items.ForEach(n => n.IsRead = true);

            await _db.SaveChangesAsync();
        }

        // Đánh dấu 1 thông báo là đã đọc
        public async Task MarkAsRead(string notificationId)
        {
            // Tìm thông báo chưa đọc bằng Id
            var item = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == notificationId && !n.IsRead);

            if (item != null)
            {
                item.IsRead = true;
                await _db.SaveChangesAsync();
            }
            // Nếu không tìm thấy (hoặc đã đọc rồi) thì không làm gì cả.
        }

        // Lấy danh sách user nhàn rỗi
        public async Task<object> GetIdleUsersAsync(string leaderId)
        {
            var today = DateTime.Now.Date;
            var now = DateTime.Now;

            // [SỬA] Ngưỡng: Hôm nay + 1 ngày tới (tức là hết ngày mai)
            // Ví dụ: Nay 20/11. AddDays(2) -> 22/11 00:00 -> AddTicks(-1) -> 21/11 23:59:59
            var threshold = DateTime.Now.Date.AddDays(2).AddTicks(-1);

            // 1. Tìm thông tin của Leader
            var leader = await _db.Users
                .Select(u => new { u.Id, u.IdDepartment })
                .FirstOrDefaultAsync(u => u.Id == leaderId);

            if (leader == null || string.IsNullOrEmpty(leader.IdDepartment))
            {
                return new List<object>();
            }

            // 2. Lấy Role ADMIN
            var adminRoleId = await _db.Roles
                .Where(r => r.Name == "ADMIN" || r.NormalizedName == "ADMIN")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            // 3. Truy vấn User
            var idleUsers = await _db.Users
                .Where(u =>
                    u.IdDepartment == leader.IdDepartment &&
                    u.Id != leaderId &&
                    !_db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == adminRoleId) &&

                    // [LOGIC CHÍNH]: Lọc những người KHÔNG CÓ task nào chen vào khoảng [Hiện tại -> Hết ngày mai]
                    !u.Tasks.Any(t =>
                        // Task chưa bắt đầu hoặc đang làm mà Deadline vẫn còn hạn trong tương lai
                        t.StartDate <= threshold &&
                        t.EndDate >= now
                    // (Lưu ý: Đã bỏ điều kiện !Done để tính cả các task Done nhưng chưa hết hạn giữ chỗ)
                    )
                )
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    // Lấy task kết thúc gần nhất trong quá khứ
                    LastTaskEnd = u.Tasks
                        .Where(t => t.EndDate < now)
                        .OrderByDescending(t => t.EndDate)
                        .Select(t => (DateTime?)t.EndDate)
                        .FirstOrDefault()
                })
                .ToListAsync();

            // 4. Sắp xếp: Người rảnh lâu nhất lên đầu (LastTaskEnd càng bé càng tốt)
            var result = idleUsers
                .OrderBy(u => u.LastTaskEnd)
                .Select(u => {
                    var endDate = u.LastTaskEnd?.Date;

                    return new
                    {
                        u.Id,
                        u.FullName,
                        u.Email,
                        // Ngày bắt đầu rảnh = Ngày kết thúc task cũ + 1
                        FreeSince = u.LastTaskEnd.HasValue ? u.LastTaskEnd.Value.AddDays(1).ToString("dd/MM/yyyy") : "Chưa có công việc",
                        IsNew = !u.LastTaskEnd.HasValue,
                        // Số ngày đã rảnh = Hôm nay - Ngày kết thúc
                        DayLeft = endDate.HasValue ? (int)(endDate.Value - today).TotalDays : (int?)null
                    };
                })
                .ToList();

            return result;
        }
    }
}
