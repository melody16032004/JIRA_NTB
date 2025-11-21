namespace JIRA_NTB.ViewModels
{
    public class SetTimeViewModel
    {
        public string Id { get; set; } // CAPTURE_INTERVAL, CLEANUP_TIME...
        public TimeSpan Time { get; set; }
        public string Title { get; set; } // Tên hiển thị
    }
}
