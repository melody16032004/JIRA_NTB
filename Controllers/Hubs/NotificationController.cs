using JIRA_NTB.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace JIRA_NTB.Controllers.Hubs
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationController : Controller
    {
        private readonly NotificationService _service;
        private readonly IHubContext<NotifyHub> _hub;
        public NotificationController(NotificationService service, IHubContext<NotifyHub> hub)
        {
            _service = service;
            _hub = hub;
        }

        #region GET: api/notification/{userId}?pageIndex=1&pageSize=20 -> Lấy danh sách thông báo của user theo phân trang
        [HttpGet("{userId}")]
        public async Task<IActionResult> Get(string userId, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20)
        {
            // (PageSize = 20 theo yêu cầu của bạn)
            var data = await _service.GetUserNotifications(userId, pageIndex, pageSize);
            return Ok(data);
        }
        #endregion

        #region GET: api/notification/users/idle -> Lấy danh sách users không có công việc trong 2 ngày tới
        [HttpGet("users/idle")]
        public async Task<IActionResult> GetIdleUsers()
        {
            try
            {
                // 1. Lấy ID của người dùng đang gọi API (Leader)
                // Lưu ý: User.FindFirst... trả về null nếu chưa đăng nhập, nhưng middleware của bạn đã chặn rồi.
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(currentUserId))
                {
                    return Unauthorized();
                }

                // 2. Truyền ID vào service
                var data = await _service.GetIdleUsersAsync(currentUserId);
                return Ok(data);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
            }
        }
        #endregion

        #region POST: api/notification/read/{notificationId} -> Đánh dấu đã đọc một thông báo
        [HttpPost("read/{notificationId}")]
        public async Task<IActionResult> ReadOne(string notificationId)
        {
            if (string.IsNullOrEmpty(notificationId))
            {
                return BadRequest("Notification ID is required.");
            }
            await _service.MarkAsRead(notificationId);
            return Ok(new { success = true });
        }
        #endregion

        #region POST: api/notification/read-all/{userId} -> Đánh dấu đã đọc tất cả thông báo của user
        [HttpPost("read-all/{userId}")]
        public async Task<IActionResult> ReadAll(string userId)
        {
            await _service.MarkAllAsRead(userId);
            return Ok();
        }
        #endregion

        #region POST: api/notification/push -> Tạo và gửi thông báo mới đến user
        [HttpPost("push")]
        public async Task<IActionResult> Push(NotificationsModel dto)
        {
            var saved = await _service.CreateAsync(dto.UserId, dto.Title, dto.Message);

            await _hub.Clients.Group(dto.UserId.ToString())
                .SendAsync("ReceiveNotification", saved);

            return Ok(saved);
        }
        #endregion
    }
}
