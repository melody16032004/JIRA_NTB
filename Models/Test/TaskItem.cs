using JIRA_NTB.Models.Test;

namespace JIRA_NTB.Models
{
    public class TaskItem
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Assignee { get; set; }
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public int? Progress { get; set; }
        public FileItem? File { get; set; }
    }
}
