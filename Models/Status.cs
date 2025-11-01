using JIRA_NTB.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models
{
    public class Status
    {
        [Key]
        public string StatusId { get; set; }

        [Required]
        public TaskStatusModel StatusName { get; set; }

        public ICollection<TaskItemModel>? Tasks { get; set; }
        public ICollection<ProjectModel>? Projects { get; set; }
    }
}
