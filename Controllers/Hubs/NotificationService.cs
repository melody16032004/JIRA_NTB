using JIRA_NTB.Data;
using JIRA_NTB.Models;
using Microsoft.EntityFrameworkCore;

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
    }
}
