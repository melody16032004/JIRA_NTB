namespace JIRA_NTB.ViewModels
{
    public class UserTaskStatViewModel
    {
        public string UserId { get; set; } // Dùng để tạo ID duy nhất cho thẻ HTML
        public string UserName { get; set; }
        public string UserAvatarUrl { get; set; } // Thêm avatar cho đẹp
        public int TotalTasks { get; set; }

        // Biểu đồ 1: Cột theo Status
        public ChartData StatusChart { get; set; }

        // Biểu đồ 2: Donut theo Priority
        public ChartData PriorityChart { get; set; }
        public List<UserTaskBriefViewModel> Tasks { get; set; } = new();
    }
    // 🆕 Model con hiển thị task
    public class UserTaskBriefViewModel
    {
        public string TaskId { get; set; }
        public string NameTask { get; set; }
        public string Status { get; set; }
        public string Priority { get; set; }
        public bool Overdue { get; set; }
    }
}
