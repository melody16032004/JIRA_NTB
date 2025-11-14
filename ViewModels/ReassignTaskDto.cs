namespace JIRA_NTB.ViewModels
{
    public class ReassignTaskDto
    {
        public string TaskId { get; set; }
        public string NewUserId { get; set; }
        public int Progress { get; set; }
        public string? Reason { get; set; }
    }
}
