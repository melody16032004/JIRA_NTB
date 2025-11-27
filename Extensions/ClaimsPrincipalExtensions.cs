using System.Security.Claims;

namespace JIRA_NTB.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        public static string GetUserId(this ClaimsPrincipal user)
        {
            // Thử lấy từ custom claim trước
            var userId = user.FindFirstValue("UserId");

            // Nếu không có thì lấy từ NameIdentifier (default của Identity)
            return userId ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? throw new UnauthorizedAccessException("User ID not found");
        }

        public static List<string> GetUserRoles(this ClaimsPrincipal user)
        {
            return user.Claims
                .Where(c => c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .ToList();
        }

        public static string GetFullName(this ClaimsPrincipal user)
        {
            return user.FindFirstValue("FullName") ?? "";
        }
    }
}
