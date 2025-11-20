namespace JIRA_NTB.ViewModels
{
    public class LogStatusDTO
    {
        public string LogId { get; set; }
        public string TaskName { get; set; }
        public string UserName { get; set; }
        public string PreviousStatus { get; set; }
        public string NewStatus { get; set; }
        public DateTime UpdateAt { get; set; }
    }

}
