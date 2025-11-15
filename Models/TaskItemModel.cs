using JIRA_NTB.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JIRA_NTB.Models
{
    public class TaskItemModel
    {
        [Key]
        public string IdTask { get; set; }

        [Required, MaxLength(200)]
        public string NameTask { get; set; }

        public DateTime? CompletedDate { get; set; }

        [MaxLength(20)]
        public string? Priority { get; set; } // Low, Medium, High

        public bool Overdue { get; set; } = false;

        public string? FileNote { get; set; }
        public string? Note { get; set; }

        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        // Foreign Keys
        public string? Assignee_Id { get; set; }

        [ForeignKey("Assignee_Id")]
        public UserModel? Assignee { get; set; }

        [Required]
        public string ProjectId { get; set; }

        [ForeignKey("ProjectId")]
        public ProjectModel? Project { get; set; }

        // Liên kết tới Status
        public string StatusId { get; set; }

        [ForeignKey("StatusId")]
        public Status? Status { get; set; }
        // 🔹 Navigation tới Log
        public ICollection<LogTaskModel> Logs { get; set; } = new List<LogTaskModel>();
        public ICollection<LogStatusUpdate> LogStatusUpdates { get; set; } = new List<LogStatusUpdate>();
    }
}
