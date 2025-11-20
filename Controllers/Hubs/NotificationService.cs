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
            // Lấy ngày hiện tại (bỏ qua giờ phút để tính toán chính xác)
            var today = DateTime.Now.Date;
            var now = DateTime.Now; // Vẫn giữ biến này để so sánh logic query
            var threshold = DateTime.Now.AddDays(2);

            // 1. Tìm thông tin của Leader
            var leader = await _db.Users
                .Select(u => new { u.Id, u.IdDepartment })
                .FirstOrDefaultAsync(u => u.Id == leaderId);

            if (leader == null || string.IsNullOrEmpty(leader.IdDepartment))
            {
                return new List<object>();
            }

            // 2. Lấy ID của Role ADMIN
            var adminRoleId = await _db.Roles
                .Where(r => r.Name == "ADMIN" || r.NormalizedName == "ADMIN")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            // 3. Truy vấn User (Phần này giữ nguyên để lọc đúng người)
            var idleUsers = await _db.Users
                .Where(u =>
                    u.IdDepartment == leader.IdDepartment &&
                    u.Id != leaderId &&
                    !_db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == adminRoleId) &&
                    !u.Tasks.Any(t => t.EndDate > threshold && t.Status.StatusName != TaskStatusModel.Done)
                )
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    LastTaskEnd = u.Tasks.OrderByDescending(t => t.EndDate).Select(t => (DateTime?)t.EndDate).FirstOrDefault()
                })
                .ToListAsync();

            // 4. Sắp xếp và Format kết quả (SỬA ĐỔI Ở ĐÂY)
            var result = idleUsers
                .OrderBy(u => u.LastTaskEnd)
                .Select(u => {
                    // Xử lý ngày kết thúc: Lấy phần Date để tránh lệch giờ
                    var endDate = u.LastTaskEnd?.Date;

                    return new
                    {
                        u.Id,
                        u.FullName,
                        u.Email,
                        FreeSince = u.LastTaskEnd.HasValue ? u.LastTaskEnd.Value.ToString("dd/MM/yyyy") : "Chưa có dự án",
                        IsNew = !u.LastTaskEnd.HasValue,

                        // SỬA: Tính số ngày đã rảnh
                        // Công thức: (Hôm nay - Ngày kết thúc)
                        // Ví dụ: Xong ngày 18, Nay ngày 20 -> Rảnh 2 ngày.
                        DayLeft = endDate.HasValue
                            ? (int)(endDate.Value - today).TotalDays
                            : (int?)null
                    };
                })
                .ToList();

            return result;
        }
    }
}
