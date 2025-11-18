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

        // Lấy danh sách notify
        [HttpGet("{userId}")]
        public async Task<IActionResult> Get(string userId, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20)
        {
            // (PageSize = 20 theo yêu cầu của bạn)
            var data = await _service.GetUserNotifications(userId, pageIndex, pageSize);
            return Ok(data);
        }

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

        // Đánh dấu đã đọc
        [HttpPost("read-all/{userId}")]
        public async Task<IActionResult> ReadAll(string userId)
        {
            await _service.MarkAllAsRead(userId);
            return Ok();
        }

        // =======================
        // CÁI NÀY DÙNG ĐỂ GỬI NOTIFY
        // =======================
        [HttpPost("push")]
        public async Task<IActionResult> Push(NotificationsModel dto)
        {
            var saved = await _service.CreateAsync(dto.UserId, dto.Title, dto.Message);

            await _hub.Clients.Group(dto.UserId.ToString())
                .SendAsync("ReceiveNotification", saved);

            return Ok(saved);
        }
    }
}
