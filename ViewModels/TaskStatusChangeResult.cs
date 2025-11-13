namespace JIRA_NTB.ViewModels
{
    public class TaskStatusChangeResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public string TaskId { get; set; }
        public string PreviousStatusId { get; set; }
        public string NewStatusId { get; set; }
        public string PreviousStatusName { get; set; }
        public string NewStatusName { get; set; }
        public DateTime? PreviousCompletedDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public bool IsCompleted { get; set; } = false;
    }
    // Request Models
    public class UpdateStatusRequest
    {
        public string TaskId { get; set; }
        public string NewStatusId { get; set; }
    }

    public class UndoStatusRequest
    {
        public string TaskId { get; set; }
        public string PreviousStatusId { get; set; }
        public DateTime? previousCompletedDate { get; set; }
    }
}
