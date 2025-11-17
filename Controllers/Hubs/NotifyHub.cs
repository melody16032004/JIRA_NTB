using Microsoft.AspNetCore.SignalR;

namespace JIRA_NTB.Controllers.Hubs
{
    public class NotifyHub : Hub
    {
        // Gửi notify đến user cụ thể
        public async Task SendNotification(int userId, object data)
        {
            await Clients.Group(userId.ToString()).SendAsync("ReceiveNotification", data);
        }

        // Khi user kết nối → join group theo userId
        public override async Task OnConnectedAsync()
        {
            var http = Context.GetHttpContext();
            var userId = http!.Request.Query["userId"].ToString();

            if (!string.IsNullOrEmpty(userId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);
            }

            await base.OnConnectedAsync();
        }
    }
}
