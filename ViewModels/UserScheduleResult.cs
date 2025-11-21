namespace JIRA_NTB.ViewModels
{
    public class UserScheduleResult
    {
        public bool HasOverlap { get; set; } // Có trùng lịch không?

        // Khi có trùng lịch
        public int OverlapCount { get; set; }
        public DateTime? OverlapStart { get; set; }
        public DateTime? OverlapEnd { get; set; }

        // Khi không trùng
        public double? FreeDays { get; set; }
        public DateTime? FreeFrom { get; set; }
        public DateTime? FreeTo { get; set; }

        // Message hiển thị cho Manager
        public string Message { get; set; }
    }
}
