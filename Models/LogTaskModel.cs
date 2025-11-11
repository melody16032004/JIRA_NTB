using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JIRA_NTB.Models
{
    public class LogTaskModel
    {
        [Key]
        public string LogId { get; set; } = Guid.NewGuid().ToString();

        public int Progress { get; set; }

        public DateTime ReassignedAt { get; set; } = DateTime.UtcNow;

        public string? Reason { get; set; }

        // 🔹 Người bị thay thế
        public string OldUserId { get; set; }
        [ForeignKey(nameof(OldUserId))]
        public UserModel OldUser { get; set; }

        // 🔹 Task liên quan
        public string TaskId { get; set; }
        [ForeignKey(nameof(TaskId))]
        public TaskItemModel Task { get; set; }

        // 🔹 Người thực hiện việc thay đổi (Leader/Admin)
        public string ReassignedById { get; set; }
        [ForeignKey(nameof(ReassignedById))]
        public UserModel ReassignedBy { get; set; }
    }
}
