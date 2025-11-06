using JIRA_NTB.Models;
using System.Collections.Generic;

namespace JIRA_NTB.ViewModels
{
    public class ProjectDetailViewModel
    {
        public ProjectModel Project { get; set; }
        public List<TaskItemModel> Tasks { get; set; }
        public List<ProjectManagerModel> MemberProjects { get; set; }
        public List<UserModel> Members { get; set; }

        // Biểu đồ trạng thái và ưu tiên
        public ChartData TaskStatusChart { get; set; }
        public ChartData TaskPriorityChart { get; set; }

        // Biểu đồ thời gian từng Task
        public List<GanttTaskData> TaskTimelineData { get; set; }

        public ProjectDetailViewModel()
        {
            Tasks = new List<TaskItemModel>();
            Members = new List<UserModel>();
            TaskStatusChart = new ChartData();
            TaskPriorityChart = new ChartData();
            TaskTimelineData = new List<GanttTaskData>();
        }
    }

    public class ChartData
    {
        public List<string> Labels { get; set; } = new List<string>();
        public List<int> Series { get; set; } = new List<int>();
    }

    public class GanttTaskData
    {
        public string Name { get; set; }
        public string Assignee { get; set; }
        public string Priority { get; set; }
        public long Start { get; set; }
        public long End { get; set; }
        public bool Overdue { get; set; }
        public string Status { get; set; }
    }
}
