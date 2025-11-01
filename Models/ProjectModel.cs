using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JIRA_NTB.Models
{
    public class ProjectModel
    {
        [Key]
        public required string IdProject { get; set; }

        [Required, MaxLength(200)]
        public required string ProjectName { get; set; }

        public DateTime? StartDay { get; set; }
        public DateTime? EndDay { get; set; }
        public DateTime? CompletedDate { get; set; }

        public string? FileNote { get; set; }
        public string? Note { get; set; }

        // Người quản lý (có thể null)
        public string? UserId { get; set; }

        [ForeignKey("UserId")]
        public UserModel? Manager { get; set; }

        public string StatusId { get; set; }

        [ForeignKey("StatusId")]
        public Status? Status { get; set; }

        public ICollection<TaskItemModel>? Tasks { get; set; }
        public ICollection<ProjectManagerModel>? ProjectManagers { get; set; }
    }
}
