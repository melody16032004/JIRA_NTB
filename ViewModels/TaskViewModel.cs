using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;

namespace JIRA_NTB.ViewModels
{
    public class TaskViewModel
    {
        public string IdTask { get; set; }
        public string NameTask { get; set; }
        public string Priority { get; set; }
        public string Note { get; set; }
        public string FileNote { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public bool Overdue { get; set; }
        public string ProjectId { get; set; }
        public string? AssigneeId { get; set; }

        // Thông tin tối thiểu từ bảng liên quan
        public string ProjectName { get; set; }
        public TaskStatusModel StatusName { get; set; }
        public string? AssigneeFullName { get; set; }
        public string AssigneeDisplayName =>
        !string.IsNullOrEmpty(AssigneeFullName)
            ? AssigneeFullName
            : (!string.IsNullOrEmpty(AssigneeId) ? AssigneeId : "Chưa giao");
        public bool IsCompleted { get; set; }

        //Task chưa hoàn thành mà quá hạn
        public bool IsOverdue =>
            EndDate.HasValue &&
            EndDate.Value.Date < DateTime.Now.Date &&
            !IsCompleted;

        //Task hoàn thành trễ
        public bool IsDoneLate =>
           EndDate.HasValue &&
           CompletedDate.HasValue &&
           CompletedDate.Value.Date > EndDate.Value.Date;

        //Task hoàn thành đúng hạn
        public bool IsDoneOnTime =>
            EndDate.HasValue &&
            CompletedDate.HasValue &&
            CompletedDate.Value.Date <= EndDate.Value.Date;

        //Số ngày còn lại (âm nếu trễ)
        public int DaysRemaining =>
         EndDate.HasValue
             ? (EndDate.Value.Date - DateTime.Now.Date).Days
             : 0;
        public int DaysLate
        {
            get
            {
                if (!IsDoneLate) return 0;
                return (CompletedDate!.Value - EndDate!.Value).Days;
            }
        }
        public ProjectInfoViewModel Project => new ProjectInfoViewModel
        {
            IdProject = ProjectId,
            ProjectName = ProjectName
        };

        public AssigneeInfoViewModel? Assignee => !string.IsNullOrEmpty(AssigneeId)
            ? new AssigneeInfoViewModel
            {
                Id = AssigneeId,
                FullName = AssigneeFullName
            }
            : null;
    }

    /// <summary>
    /// Thông tin tối thiểu của Project cho Task Card
    /// </summary>
    public class ProjectInfoViewModel
    {
        public string IdProject { get; set; }
        public string ProjectName { get; set; }
    }
    /// <summary>
    /// Thông tin tối thiểu của Assignee cho Task Card
    /// </summary>
    public class AssigneeInfoViewModel
    {
        public string? Id { get; set; }
        public string? FullName { get; set; }
        public string? Email { get; set; }
    }

    /// <summary>
    /// ViewModel cho một cột trên Kanban Board
    /// </summary>
    public class TaskColumnViewModel
    {
        public string Status { get; set; }
        public string StatusId { get; set; }
        public string StatusTitle { get; set; }
        public string StatusColor { get; set; }
        public int TotalCount { get; set; }
        public int PageSize { get; set; } = 10;
        public List<TaskViewModel> Tasks { get; set; } = new List<TaskViewModel>();
    }

    /// <summary>
    /// ViewModel chính cho trang Kanban Board
    /// </summary>
    public class TaskBoardViewModel
    {
        public List<TaskViewModel> TodoTasks { get; set; } = new List<TaskViewModel>();
        public List<TaskViewModel> InProgressTasks { get; set; } = new List<TaskViewModel>();
        public List<TaskViewModel> DoneTasks { get; set; } = new List<TaskViewModel>();
        public List<TaskViewModel> OverdueTasks { get; set; } = new List<TaskViewModel>();
        public List<ProjectModel> Projects { get; set; } = new();
        public List<Status> Statuses { get; set; } = new();

        // Thông tin thống kê
        public int TotalTasks => TodoTasks.Count + InProgressTasks.Count + DoneTasks.Count;
        public int OverdueCount => OverdueTasks.Count;
        public double CompletionRate => TotalTasks > 0 ? (DoneTasks.Count * 100.0 / TotalTasks) : 0;
    }
}
