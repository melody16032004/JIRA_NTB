namespace JIRA_NTB.ViewModels
{
    public class RestoreTaskRequest
    {
        public string TaskId { get; set; }
        public string PreviousStatusId { get; set; }
        public DateTime? PreviousCompletedDate { get; set; }
    }
}
