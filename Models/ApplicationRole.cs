using Microsoft.AspNetCore.Identity;

namespace JIRA_NTB.Models
{
    public class ApplicationRole : IdentityRole
    {
        // Bạn có thể thêm mô tả role ở đây nếu cần
        public string? Description { get; set; }
    }
}
